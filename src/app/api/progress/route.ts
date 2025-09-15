import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Update progress
export async function POST(request: NextRequest) {
  try {
    const { lectureId, questionId, completed, score, userId } = await request.json();

    if (!lectureId || !userId) {
      return NextResponse.json(
        { error: 'Lecture ID and user ID are required' },
        { status: 400 }
      );
    }

    // Optimized upsert with minimal data selection
    const progress = await prisma.userProgress.upsert({
      where: {
        userId_lectureId_questionId: {
          userId,
          lectureId,
          questionId: questionId || null
        }
      },
      update: {
        completed: completed ?? true,
        score: score,
        lastAccessed: new Date()
      },
      create: {
        userId,
        lectureId,
        questionId: questionId || null,
        completed: completed ?? true,
        score: score,
        lastAccessed: new Date()
      },
      select: {
        id: true,
        completed: true,
        score: true,
        lastAccessed: true
      }
    });

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}

// GET - Fetch progress
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lectureId = searchParams.get('lectureId');
    const specialtyId = searchParams.get('specialtyId');
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
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

    const whereClause: Record<string, unknown> = { userId };

    if (lectureId) {
      whereClause.lectureId = lectureId;
    }

    if (specialtyId) {
      // Get all lectures for this specialty
      const lectures = await prisma.lecture.findMany({
        where: { specialtyId },
        select: { id: true }
      });
      whereClause.lectureId = { in: lectures.map(l => l.id) };
    }

    // If user is not admin and has a niveau, filter by specialty niveau
    if (user.role !== 'admin' && user.niveauId) {
      whereClause.lecture = {
        specialty: {
          niveauId: user.niveauId
        }
      };
    }

    const progress = await prisma.userProgress.findMany({
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
                name: true,
                niveauId: true,
                niveau: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
} 