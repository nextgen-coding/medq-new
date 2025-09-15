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
    const whereClause: Record<string, unknown> = {};

    if (user.role !== 'admin' && user.niveauId) {
      whereClause.specialty = {
        niveauId: user.niveauId
      };
    }

    // Get lectures with their statistics
    const lectures = await prisma.lecture.findMany({
      where: whereClause,
      include: {
        specialty: {
          select: {
            name: true
          }
        },
        progress: {
          select: {
            userId: true,
            score: true
          }
        },
        questions: {
          select: {
            id: true
          }
        }
      }
    });

    // Calculate statistics for each lecture
    const coursesWithStats = lectures.map(lecture => {
      const uniqueStudents = new Set(lecture.progress.map(p => p.userId)).size;
      const scores = lecture.progress.map(p => p.score).filter(score => score !== null) as number[];
      const averageScore = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0;
      const questionCount = lecture.questions.length;

      return {
        id: lecture.id,
        title: lecture.title,
        specialty: lecture.specialty,
        questionCount,
        studentCount: uniqueStudents,
        averageScore: Math.round(averageScore * 10) / 10,
        isFree: lecture.isFree
      };
    });

    // Sort by popularity (student count) and then by average score
    const popularCourses = coursesWithStats
      .filter(course => course.studentCount > 0) // Only show courses with students
      .sort((a, b) => {
        // Primary sort by student count
        if (b.studentCount !== a.studentCount) {
          return b.studentCount - a.studentCount;
        }
        // Secondary sort by average score
        return b.averageScore - a.averageScore;
      })
      .slice(0, 5); // Get top 5

    return NextResponse.json(popularCourses);
  } catch (error) {
    console.error('Error fetching popular courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch popular courses' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler); 