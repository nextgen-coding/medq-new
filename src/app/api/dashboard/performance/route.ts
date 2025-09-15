import { NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

// Thresholds (percent values) used after normalisation (0-100 scale)
const CORRECT_THRESHOLD = 80;
const PARTIAL_THRESHOLD = 50; // inclusive lower bound for partial

async function getHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.userId;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, niveauId: true }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const baseWhere: any = { userId };
    if (user.role !== 'admin' && user.niveauId) {
      baseWhere.lecture = { specialty: { niveauId: user.niveauId } };
    }

  // Window (days) param: default 30, allow 1-180 (frontend now has 1d option)
  const url = new URL(request.url);
  const daysParam = parseInt(url.searchParams.get('days') || '30', 10);
  const windowDays = isNaN(daysParam) ? 30 : Math.min(180, Math.max(1, daysParam));
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

    // Finer granularity (per-question) first
    const questionData = await prisma.questionUserData.findMany({
      where: { userId, updatedAt: { gte: since } },
      select: { lastScore: true }
    });

    // Fallback: aggregate userProgress scores
    const progress = questionData.length === 0 ? await prisma.userProgress.findMany({
      where: { ...baseWhere, lastAccessed: { gte: since }, score: { not: null } },
      select: { score: true }
    }) : [];

    const rawScores: number[] = [];
    questionData.forEach(q => { if (q.lastScore != null) rawScores.push(q.lastScore); });
    if (rawScores.length === 0) progress.forEach(p => { if (p.score != null) rawScores.push(p.score); });

    if (rawScores.length === 0) {
  return NextResponse.json({ correct: 0, partial: 0, wrong: 0, total: 0, windowDays });
    }

    // Detect scale: if max <=1.5 then scores are 0-1; convert to 0-100
    const maxScore = Math.max(...rawScores);
    const scaleFactor = maxScore <= 1.5 ? 100 : 1;

    let correct = 0, partial = 0, wrong = 0;
    rawScores.forEach(s => {
      const pct = s * scaleFactor; // normalised percentage
      if (pct >= CORRECT_THRESHOLD) correct++;
      else if (pct >= PARTIAL_THRESHOLD) partial++;
      else wrong++;
    });

    const total = correct + partial + wrong;
    const percentCorrect = total ? +(correct / total * 100).toFixed(1) : 0;
    const percentPartial = total ? +(partial / total * 100).toFixed(1) : 0;
    const percentWrong = total ? +(wrong / total * 100).toFixed(1) : 0;

    return NextResponse.json({
      correct,
      partial,
      wrong,
      total,
      percentCorrect,
      percentPartial,
      percentWrong,
      windowDays,
      scale: scaleFactor === 100 ? '0-1' : '0-100'
    });
  } catch (error) {
    console.error('Error fetching performance summary:', error);
    return NextResponse.json({ error: 'Failed to fetch performance' }, { status: 500 });
  }
}

export const GET = requireAuth(getHandler);
