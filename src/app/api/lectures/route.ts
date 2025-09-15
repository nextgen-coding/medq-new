import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
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
  const { searchParams } = new URL(request.url);
  const specialtyId = searchParams.get('specialtyId');
  const semesterParam = searchParams.get('semester'); // 'none' | <semesterId>

    // Get user with their niveau information
  const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        role: true, 
    niveauId: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Build the where clause for lectures
  const where: Record<string, any> = {};
    
    if (specialtyId) {
      where.specialtyId = specialtyId;
    }

    // If user is not admin and has a niveau, filter by specialty niveau
    if (user.role !== 'admin' && user.niveauId) {
      where.specialty = {
        niveauId: user.niveauId
      };
    }

    // Optional semester filter
    if (semesterParam) {
      where.specialty = where.specialty || {};
      if (semesterParam === 'none') {
        where.specialty.semesterId = null;
      } else if (semesterParam !== 'all') {
        where.specialty.semesterId = semesterParam;
      }
  }

    const lectures = await prisma.lecture.findMany({
      where,
      orderBy: [
        { isFree: 'desc' }, // Free content first
        { specialty: { niveau: { order: 'asc' } } },
        { title: 'asc' }
      ],
      select: {
        id: true,
        specialtyId: true,
        title: true,
        description: true,
        isFree: true,
        createdAt: true,
        specialty: {
          select: {
            id: true,
            name: true,
            niveauId: true,
            isFree: true,
            niveau: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
  _count: { select: { questions: true, comments: true } }
      }
    });

    // Calculate progress for each lecture
    const lecturesWithProgress = await Promise.all(
      lectures.map(async (lecture) => {
        // Get user progress for this lecture
        const userProgress = await prisma.userProgress.findMany({
          where: {
            userId: userId,
            lectureId: lecture.id
          }
        });

  const totalQuestions = (lecture as any)._count?.questions ?? 0;
  const commentsCount = (lecture as any)._count?.comments ?? 0;
        const completedQuestions = userProgress.filter(p => p.completed).length;
        const correctAnswers = userProgress.filter(p => p.completed && (p.score || 0) > 0.7).length;
        const partialAnswers = userProgress.filter(p => p.completed && (p.score || 0) > 0.3 && (p.score || 0) <= 0.7).length;
        const incorrectAnswers = userProgress.filter(p => p.completed && (p.score || 0) <= 0.3).length;

        const percentage = totalQuestions > 0 ? (completedQuestions / totalQuestions) * 100 : 0;

  // Culmon note (/20): average score of completed questions (0..1) scaled to 20 (two decimals)
  const answeredEntries = userProgress.filter(p => p.completed && typeof p.score === 'number');
  const avgScore = answeredEntries.length > 0 ? answeredEntries.reduce((sum, p) => sum + (p.score || 0), 0) / answeredEntries.length : 0;
  const culmonNote = Math.round(avgScore * 20 * 100) / 100;


        // Get reports count for admins
        let reportsCount = 0;
        if (user.role === 'admin') {
          const reports = await prisma.report.findMany({
            where: {
              lectureId: lecture.id
            }
          });
          reportsCount = reports.length;
        }

        return {
          ...lecture,
          progress: {
            totalQuestions,
            completedQuestions,
            percentage: Math.round(percentage),
            correctAnswers,
            incorrectAnswers,
            partialAnswers,
            lastAccessed: userProgress.length > 0 ? 
              userProgress.reduce((latest, p) => 
                p.lastAccessed > latest ? p.lastAccessed : latest, 
                userProgress[0].lastAccessed
              ) : undefined
          },
          reportsCount: user.role === 'admin' ? reportsCount : undefined,
          commentsCount
          ,culmonNote
        };
      })
    );
    
    return NextResponse.json(lecturesWithProgress);
  } catch (error) {
    console.error('Error fetching lectures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lectures' },
      { status: 500 }
    );
  }
}

async function postHandler(request: AuthenticatedRequest) {
  try {
  const { title, description, specialtyId, isFree } = await request.json();

    if (!title || !specialtyId) {
      return NextResponse.json(
        { error: 'Title and specialtyId are required' },
        { status: 400 }
      );
    }

  const lecture = await prisma.lecture.create({
      data: {
        title,
        description,
        specialty: { connect: { id: specialtyId } },
        // default to false if not provided
        isFree: Boolean(isFree)
      },
      include: {
        specialty: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

  return NextResponse.json(lecture, { status: 201 });
  } catch (error) {
    console.error('Error creating lecture:', error);
    return NextResponse.json(
      { error: 'Failed to create lecture' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler);
export const POST = requireAdmin(postHandler); 