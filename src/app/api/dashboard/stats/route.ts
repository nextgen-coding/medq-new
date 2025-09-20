import { NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function getHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user with their niveau information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        role: true, 
        niveauId: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Build where clause for user's niveau
    const whereClause: Record<string, unknown> = { userId };

    if (user.role !== 'admin' && user.niveauId) {
      whereClause.lecture = {
        specialty: {
          niveauId: user.niveauId
        }
      };
    }

    // Get user progress data
    const progressData = await prisma.userProgress.findMany({
      where: whereClause,
      include: {
        lecture: {
          select: {
            id: true,
            title: true,
            specialtyId: true,
            specialty: {
              select: {
                id: true,
                name: true
              }
            },
            lectureGroups: {
              include: { courseGroup: true }
            }
          }
        }
      },
      orderBy: {
        lastAccessed: 'desc'
      }
    }) as any[];

    // Filter out rows without a questionId for question-based stats
    const questionProgress = progressData.filter(p => p.questionId);

    // Calculate statistics (question-level)
    const totalQuestions = questionProgress.length;
    const completedItems = questionProgress.filter(p => p.completed && typeof p.score === 'number') as Array<typeof questionProgress[number]>;
    const completedQuestions = completedItems.length;
    // Weighted average by course group coefficient; default coeff=1 when no group
    let weightedSum = 0;
    let weightTotal = 0;
    for (const p of completedItems as any[]) {
      const groups = p?.lecture?.lectureGroups as any[] | undefined;
      const coeff = groups && groups.length ? (groups[0]?.courseGroup?.coefficient ?? 1) : 1;
      weightedSum += ((p.score as number) || 0) * coeff;
      weightTotal += coeff;
    }
    const averageScore = weightTotal > 0 ? (weightedSum / weightTotal) * 100 : null;

    // Calculate learning streak (consecutive days with activity)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activityDates = new Set(
      progressData.map(p => {
        const date = new Date(p.lastAccessed);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
    );

    let learningStreak = 0;
    let currentDate = new Date(today);    while (activityDates.has(currentDate.getTime())) {
      learningStreak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    // Get total unique lectures
    const uniqueLectures = new Set(progressData.map(p => p.lectureId)).size;

    // Get last accessed lecture progress (group per lecture)
  const lastLecture = progressData.length > 0 ? (progressData[0] as any) : null;
    let lastLecturePayload: any = null;
    if (lastLecture) {
      const lectureEntries = questionProgress.filter(p => p.lectureId === lastLecture.lectureId);
      const lectureTotalQuestions = lectureEntries.length;
      const lectureCompleted = lectureEntries.filter(p => p.completed).length;
      const lectureProgressPct = lectureTotalQuestions === 0 ? 0 : Math.round((lectureCompleted / lectureTotalQuestions) * 100);
      lastLecturePayload = {
        id: lastLecture.lecture.id,
        title: lastLecture.lecture.title,
        specialtyId: lastLecture.lecture.specialtyId,
        specialty: lastLecture.lecture.specialty,
        progress: lectureProgressPct,
        totalQuestions: lectureTotalQuestions,
        completedQuestions: lectureCompleted,
        lastAccessed: lastLecture.lastAccessed
      };
    }

    return NextResponse.json({
      averageScore: averageScore === null ? null : Math.round(averageScore * 10) / 10, // Round to 1 decimal
      totalQuestions,
      completedQuestions,
      learningStreak,
      totalLectures: uniqueLectures,
  lastLecture: lastLecturePayload
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler); 