import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { questionsSupportsRappelMedia } from '@/lib/db-features';

async function getHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const { questionId } = await params;

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

    // Build the where clause for the question
    let whereClause: unknown = { id: questionId };
    
    // If user is not admin, forbid hidden and restrict by niveau if present
    if (user.role !== 'admin') {
      whereClause = {
        ...whereClause as Record<string, unknown>,
        hidden: false,
        ...(user.niveauId
          ? {
              lecture: {
                specialty: {
                  niveauId: user.niveauId,
                },
              },
            }
          : {}),
      };
    }

  const supportsRappel = await questionsSupportsRappelMedia();
  const question = await prisma.question.findUnique({
      where: whereClause as { id: string },
      select: {
        id: true,
        lectureId: true,
        type: true,
        text: true,
        options: true,
        correctAnswers: true,
        explanation: true,
        courseReminder: true,
        number: true,
        session: true,
        mediaUrl: true,
        mediaType: true,
    ...(supportsRappel ? { courseReminderMediaUrl: true, courseReminderMediaType: true } : {}),
        caseNumber: true,
        caseText: true,
        caseQuestionNumber: true,
        createdAt: true,
        lecture: {
          select: {
            id: true,
            title: true,
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

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json(question);
  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json(
      { error: 'Failed to fetch question' },
      { status: 500 }
    );
  }
}

async function putHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params;
    const supportsRappel = await questionsSupportsRappelMedia();
    const {
      type,
      text,
      options,
      correctAnswers,
      explanation,
      courseReminder,
      number,
      session,
      mediaUrl,
      mediaType,
      courseReminderMediaUrl,
      courseReminderMediaType,
      caseNumber,
      caseText,
      caseQuestionNumber,
      hidden
    } = await request.json();

  const question = await prisma.question.update({
      where: { id: questionId },
      data: {
        type,
        text,
        options,
        correctAnswers,
        explanation,
        courseReminder,
        number,
        session,
        mediaUrl,
        mediaType,
    ...(supportsRappel ? { courseReminderMediaUrl, courseReminderMediaType } : {}),
        caseNumber,
        caseText,
  caseQuestionNumber,
  ...(typeof hidden === 'boolean' ? { hidden } : {})
      },
      select: {
        id: true,
        lectureId: true,
        type: true,
        text: true,
        options: true,
        correctAnswers: true,
        explanation: true,
        courseReminder: true,
        number: true,
        session: true,
        mediaUrl: true,
        mediaType: true,
    ...(supportsRappel ? { courseReminderMediaUrl: true, courseReminderMediaType: true } : {}),
        caseNumber: true,
        caseText: true,
  caseQuestionNumber: true,
        createdAt: true,
        lecture: {
          select: {
            id: true,
            title: true,
            specialty: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Note: Cache invalidation is handled by the client-side hook
    // The useLecture hook will clear its cache when needed

    return NextResponse.json(question);
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    );
  }
}

async function deleteHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params;

    // Clean related data to avoid FK issues
    await prisma.userProgress.deleteMany({ where: { questionId } });
    await prisma.report.deleteMany({ where: { questionId } });
    await prisma.question.delete({ where: { id: questionId } });

    return NextResponse.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler);
export const PUT = requireAdmin(putHandler);
export const DELETE = requireAdmin(deleteHandler); 