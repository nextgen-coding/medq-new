import { NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function getHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.userId;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user to restrict by niveau when applicable
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, niveauId: true }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Build where clause for user progress tied to user's niveau (non-admin)
    const whereClause: any = { userId };
    if (user.role !== 'admin' && user.niveauId) {
      whereClause.lecture = { specialty: { niveauId: user.niveauId } };
    }

    // Pull per-question progress with lecture, specialty, and group coefficient
    const progress = await prisma.userProgress.findMany({
      where: whereClause,
      include: {
        lecture: {
          select: {
            id: true,
            specialtyId: true,
            specialty: { select: { id: true, name: true } },
            lectureGroups: { include: { courseGroup: true } }
          }
        }
      }
    });

    // Consider only answered/completed questions with numeric scores
    const completed = progress.filter(p => p.completed && typeof p.score === 'number');

    // Aggregate weighted sum per specialty
    const agg = new Map<string, { name: string; wsum: number; wtot: number }>();
    for (const p of completed as any[]) {
      const specId: string | undefined = p.lecture?.specialtyId || p.lecture?.specialty?.id;
      const specName: string = p.lecture?.specialty?.name || 'Unknown';
      if (!specId) continue;
      const groups = (p.lecture?.lectureGroups || []) as any[];
      const coeff = groups.length ? (groups[0]?.courseGroup?.coefficient ?? 1) : 1; // assume single group typical
      const cur = agg.get(specId) || { name: specName, wsum: 0, wtot: 0 };
      cur.wsum += (p.score as number) * coeff;
      cur.wtot += coeff;
      agg.set(specId, cur);
    }

    // Build payload; convert to 0-100 scale to match dashboard.stats
    const payload = Array.from(agg.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      average: v.wtot > 0 ? (v.wsum / v.wtot) * 100 : null
    }));

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching specialty averages:', error);
    return NextResponse.json({ error: 'Failed to fetch specialty averages' }, { status: 500 });
  }
}

export const GET = requireAuth(getHandler);
