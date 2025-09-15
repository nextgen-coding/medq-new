import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

async function getHandler(
  request: AuthenticatedRequest,
  context: any
) {
  try {
    const { params } = context as { params: Promise<{ lectureId: string }> };
    const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const { lectureId } = await params;
    const { searchParams } = new URL(request.url);
    const includeQuestions = searchParams.get('includeQuestions') === 'true';

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

    // Build the where clause for the lecture using Prisma type
    const whereClause: Prisma.LectureWhereInput =
      user.role !== 'admin' && user.niveauId
        ? { id: lectureId, specialty: { niveauId: user.niveauId } }
        : { id: lectureId };

    if (includeQuestions) {
      // Optimized query: fetch lecture with questions in a single request
      // For non-admins, exclude hidden questions
      const questionsInclude: Prisma.LectureInclude['questions'] = {
        orderBy: [
          { caseNumber: 'asc' },
          { caseQuestionNumber: 'asc' },
          { number: 'asc' },
          { type: 'asc' },
          { id: 'asc' }
        ]
      };

      const lectureWithQuestions = await prisma.lecture.findFirst({
        where: whereClause,
        include: {
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
          },
          questions: questionsInclude,
          _count: {
            select: {
              questions: true
            }
          }
        }
      });

      if (!lectureWithQuestions) {
        console.log('Lecture not found with lectureId:', lectureId, 'and whereClause:', whereClause);
        return NextResponse.json(
          { error: 'Lecture not found or access denied' },
          { status: 404 }
        );
      }

      console.log('Lecture found:', {
        id: lectureWithQuestions.id,
        title: lectureWithQuestions.title
      });

      // For non-admins, filter out hidden questions and normalize the count
      if (user.role !== 'admin') {
        const filteredQuestions = (lectureWithQuestions.questions || []).filter((q: any) => !q.hidden);
        return NextResponse.json({
          ...lectureWithQuestions,
          questions: filteredQuestions,
          _count: {
            ...lectureWithQuestions._count,
            questions: filteredQuestions.length,
          },
        });
      }

      return NextResponse.json(lectureWithQuestions);
    } else {
      // Original query: fetch lecture only
      const lecture = await prisma.lecture.findFirst({
        where: whereClause,
        include: {
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
          },
          _count: {
            select: {
              questions: true
            }
          }
        }
      });

      if (!lecture) {
        return NextResponse.json(
          { error: 'Lecture not found or access denied' },
          { status: 404 }
        );
      }

      return NextResponse.json(lecture);
    }
  } catch (error) {
    console.error('Error fetching lecture:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lecture' },
      { status: 500 }
    );
  }
}

async function putHandler(
  request: AuthenticatedRequest,
  context: any
) {
  try {
    const { params } = context as { params: Promise<{ lectureId: string }> };
    const { lectureId } = await params;
    const { title, description, specialtyId, isFree } = await request.json();

    console.log('Updating lecture:', { lectureId, title, description, specialtyId, isFree });

    const lecture = await prisma.lecture.update({
      where: { id: lectureId },
      data: {
        title,
        description,
        specialty: { connect: { id: specialtyId } },
        isFree
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

    console.log('Updated lecture:', { id: lecture.id, title: lecture.title, isFree: lecture.isFree });

    return NextResponse.json(lecture);
  } catch (error) {
    console.error('Error updating lecture:', error);
    return NextResponse.json(
      { error: 'Failed to update lecture' },
      { status: 500 }
    );
  }
}

async function deleteHandler(
  request: AuthenticatedRequest,
  context: any
) {
  try {
    const { params } = context as { params: Promise<{ lectureId: string }> };
    const { lectureId } = await params;

    // First delete all questions in this lecture
    await prisma.question.deleteMany({
      where: { lectureId: lectureId }
    });

    // Then delete the lecture
    await prisma.lecture.delete({
      where: { id: lectureId }
    });

    return NextResponse.json({ message: 'Lecture deleted successfully' });
  } catch (error) {
    console.error('Error deleting lecture:', error);
    return NextResponse.json(
      { error: 'Failed to delete lecture' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler);
export const PUT = requireAdmin(putHandler);
export const DELETE = requireAdmin(deleteHandler);