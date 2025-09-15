import { NextResponse } from 'next/server';
import { questionsSupportsRappelMedia, questionCommentsSupportsAnonymous } from '@/lib/db-features';

export async function GET() {
  try {
    const [rappel, anon] = await Promise.all([
      questionsSupportsRappelMedia(),
      questionCommentsSupportsAnonymous(),
    ]);
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      features: {
        questionsSupportsRappelMedia: rappel,
        questionCommentsSupportsAnonymous: anon,
      },
    });
  } catch (error) {
    console.error('db-features debug error:', error);
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 });
  }
}
