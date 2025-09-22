import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/user-case-highlights?userId=&questionId=
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const questionId = searchParams.get('questionId');

    if (!userId || !questionId) {
      return NextResponse.json({ error: 'userId and questionId are required' }, { status: 400 });
    }

    console.log('GET /api/user-case-highlights:', { userId, questionId });

    try {
      // Look for existing case highlights in clinicalCaseNotes table
      const result = await prisma.clinicalCaseNotes.findFirst({
        where: {
          userId: userId,
          questionId: questionId, // Using questionId to store the case text identifier
        },
      });

      console.log('Case highlights query result:', result);

      if (result && result.highlights) {
        // Return in the same format as user-question-state API
        return NextResponse.json({
          userId: result.userId,
          questionId: questionId,
          highlights: result.highlights,
          notes: result.notes || '',
        });
      }

      // No highlights found, return null like user-question-state does
      return NextResponse.json(null);
    } catch (dbError) {
      console.error('Database query failed:', dbError);
      return NextResponse.json(null);
    }
  } catch (e) {
    console.error('GET user-case-highlights error', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/user-case-highlights
export async function POST(req: Request) {
  try {
    const { userId, questionId, highlights, notes } = await req.json();

    if (!userId || !questionId || !Array.isArray(highlights)) {
      return NextResponse.json({ error: 'userId, questionId, and highlights array are required' }, { status: 400 });
    }

    console.log('POST /api/user-case-highlights:', { userId, questionId, highlights: highlights.length });

    try {
      // Save to clinicalCaseNotes table using the unique constraint
      await prisma.clinicalCaseNotes.upsert({
        where: {
          userId_questionId: {
            userId: userId,
            questionId: questionId,
          },
        },
        update: {
          highlights: highlights,
          notes: notes || '',
          updatedAt: new Date(),
        },
        create: {
          userId: userId,
          questionId: questionId,
          highlights: highlights,
          notes: notes || '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('Successfully saved case highlights');
      return NextResponse.json({ success: true });
    } catch (dbError) {
      console.error('Database save failed:', dbError);
      return NextResponse.json({ error: 'Failed to save highlights' }, { status: 500 });
    }
  } catch (e) {
    console.error('POST user-case-highlights error', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
