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
    const whereClause: Record<string, unknown> = { 
      userId,
      completed: true,
      score: { not: null }
    };

    if (user.role !== 'admin' && user.niveauId) {
      whereClause.lecture = {
        specialty: {
          niveauId: user.niveauId
        }
      };
    }

    // Get recent completed quizzes with scores
    const recentResults = await prisma.userProgress.findMany({
      where: whereClause,
      include: {
        lecture: {
          select: {
            id: true,
            title: true,
            specialty: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        lastAccessed: 'desc'
      },
      take: 5 // Get last 5 results
    });

    // Group by lecture to get the best score per lecture
    const lectureResults = new Map();
    
    recentResults.forEach(result => {
      const lectureId = result.lectureId;
      const existing = lectureResults.get(lectureId);
      
      if (!existing || (result.score && existing.score && result.score > existing.score)) {
        lectureResults.set(lectureId, {
          id: result.id,
          lectureTitle: result.lecture.title,
          specialtyName: result.lecture.specialty.name,
          score: result.score || 0,
          totalQuestions: 1, // This would need to be calculated from questions table
          completedAt: result.lastAccessed || new Date()
        });
      }
    });

    // Convert to array and sort by completion date
    const results = Array.from(lectureResults.values())
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 5);

    // Add improvement indicators (simplified - could be enhanced with historical data)
    const resultsWithImprovement = results.map((result, index) => ({
      ...result,
      isImprovement: index === 0 && result.score >= 80 // Mark as improvement if recent and high score
    }));

    return NextResponse.json(resultsWithImprovement);
  } catch (error) {
    console.error('Error fetching recent results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent results' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler); 