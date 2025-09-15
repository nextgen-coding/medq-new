import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

const getHandler = async (request: AuthenticatedRequest) => {
  try {
    const userId = request.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For non-admins, exclude hidden questions via relation filter
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });

    const pinnedQuestions = await prisma.pinnedQuestion.findMany({
      where: {
        userId,
        // DB-level hidden filter omitted due to client type drift; we'll filter below
      },
      include: {
        question: {
          select: {
            id: true,
            text: true,
            type: true,
            number: true,
            session: true,
            // @ts-ignore - hidden exists on Question in current schema
            hidden: true,
          },
        },
      },
    });

    const safeResults = user?.role !== 'admin'
      ? pinnedQuestions.filter((pq: any) => pq?.question && pq.question.hidden !== true)
      : pinnedQuestions;

    return NextResponse.json(safeResults);
  } catch (error) {
    console.error('Error fetching pinned questions:', error);
    return NextResponse.json({ error: 'Failed to fetch pinned questions' }, { status: 500 });
  }
};

const postHandler = async (request: AuthenticatedRequest) => {
  try {
    const userId = request.user?.userId;
    const { questionId } = await request.json();

    if (!userId || !questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }

    // Check if already pinned
    const existingPin = await prisma.pinnedQuestion.findUnique({
      where: {
        userId_questionId: {
          userId,
          questionId,
        },
      },
    });

    if (existingPin) {
      return NextResponse.json({ message: 'Question already pinned' }, { status: 200 });
    }

    const pinnedQuestion = await prisma.pinnedQuestion.create({
      data: {
        userId,
        questionId,
      },
    });

    return NextResponse.json(pinnedQuestion, { status: 201 });
  } catch (error) {
    console.error('Error pinning question:', error);
    return NextResponse.json({ error: 'Failed to pin question' }, { status: 500 });
  }
};

const deleteHandler = async (request: AuthenticatedRequest) => {
  try {
    const userId = request.user?.userId;
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');

    if (!userId || !questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }

    await prisma.pinnedQuestion.delete({
      where: {
        userId_questionId: {
          userId,
          questionId,
        },
      },
    });

    return NextResponse.json({ message: 'Question unpinned successfully' });
  } catch (error) {
    console.error('Error unpinning question:', error);
    return NextResponse.json({ error: 'Failed to unpin question' }, { status: 500 });
  }
};

export const GET = requireAuth(getHandler);
export const POST = requireAuth(postHandler);
export const DELETE = requireAuth(deleteHandler);
