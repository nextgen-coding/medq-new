import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { questionsSupportsRappelMedia } from '@/lib/db-features';

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
  const lectureId = searchParams.get('lectureId');
  const type = searchParams.get('type');
  const semesterParam = searchParams.get('semester'); // 'none' | <semesterId> | null

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

  const where: Record<string, any> = {};
    if (lectureId) where.lectureId = lectureId;
    if (type) where.type = type;

    // If user is not admin, never return hidden questions
    if (user.role !== 'admin') {
      where.hidden = false;
    }

    // If user is not admin and has a niveau, filter by specialty niveau
    if (user.role !== 'admin' && user.niveauId) {
      where.lecture = {
        specialty: {
          niveauId: user.niveauId
        }
      };
    }

    // Optional semester filter
    if (semesterParam) {
      where.lecture = where.lecture || {};
      where.lecture.specialty = where.lecture.specialty || {};
      if (semesterParam === 'none') {
        where.lecture.specialty.semesterId = null;
      } else if (semesterParam !== 'all') {
        where.lecture.specialty.semesterId = semesterParam;
      }
    }

  const supportsRappel = await questionsSupportsRappelMedia();
  const questions = await prisma.question.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { number: 'asc' },
        { id: 'asc' }
      ],
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
    
    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

async function postHandler(request: AuthenticatedRequest) {
  try {
    const {
      lectureId,
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
      caseQuestionNumber
    } = await request.json();

    if (!lectureId || !type || !text) {
      return NextResponse.json(
        { error: 'lectureId, type, and text are required' },
        { status: 400 }
      );
    }

  const supportsRappel = await questionsSupportsRappelMedia();
  const question = await prisma.question.create({
      data: {
        lecture: { connect: { id: lectureId } },
        type,
        text,
        options,
        correctAnswers: correctAnswers || [],
        explanation,
        courseReminder,
        number,
        session,
        mediaUrl,
        mediaType,
    ...(supportsRappel ? { courseReminderMediaUrl, courseReminderMediaType } : {}),
        caseNumber,
        caseText,
        caseQuestionNumber
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
    // The useLecture hook will clear its cache when isAddQuestionOpen changes

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler);
export const POST = requireAdmin(postHandler);

async function putHandler(request: AuthenticatedRequest) {
  try {
    const { 
      id, 
      lectureId, 
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

    if (!id) {
      return NextResponse.json(
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    if (!lectureId || !type || !text || !correctAnswers) {
      return NextResponse.json(
        { error: 'Lecture ID, type, text, and correct answers are required' },
        { status: 400 }
      );
    }

  const supportsRappel = await questionsSupportsRappelMedia();
  const question = await prisma.question.update({
      where: { id },
      data: {
        lecture: { connect: { id: lectureId } },
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
      include: {
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

    return NextResponse.json(question);
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    );
  }
}

async function deleteHandler(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    // Delete related user progress first
    await prisma.userProgress.deleteMany({
      where: { questionId: id }
    });

    // Delete related reports
    await prisma.report.deleteMany({
      where: { questionId: id }
    });

    await prisma.question.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    );
  }
}

export const PUT = requireAdmin(putHandler);
export const DELETE = requireAdmin(deleteHandler); 