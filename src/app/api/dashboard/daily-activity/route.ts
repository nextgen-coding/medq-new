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
    const whereClause: Record<string, unknown> = { userId };

    if (user.role !== 'admin' && user.niveauId) {
      whereClause.lecture = {
        specialty: {
          niveauId: user.niveauId
        }
      };
    }

  // Support variable window (?days=7|14|30|60|90) default 7
  const { searchParams } = new URL(request.url);
  const daysParam = parseInt(searchParams.get('days') || '7', 10);
  const allowed = [7,14,30,60,90];
  const windowDays = allowed.includes(daysParam) ? daysParam : 7;
  const debug = searchParams.get('debug') === '1';

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (windowDays - 1));
  startDate.setHours(0, 0, 0, 0);

    // Add date range to where clause
    whereClause.lastAccessed = {
      gte: startDate,
      lte: endDate
    };

    // Primary source: UserActivity events (rich types)
    const activityEvents = await prisma.userActivity.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate }
      },
      select: { createdAt: true, type: true },
      orderBy: { createdAt: 'desc' }
    });

    // Secondary: questionUserData updates (if no events recorded yet)
    let questionData: { updatedAt: Date }[] = [];
    if (activityEvents.length === 0) {
      questionData = await prisma.questionUserData.findMany({
        where: {
          userId,
          updatedAt: { gte: startDate, lte: endDate },
          ...(user.role !== 'admin' && user.niveauId ? {
            question: { lecture: { specialty: { niveauId: user.niveauId } } }
          } : {})
        },
        select: { updatedAt: true }
      });
    }

    // Fallback: userProgress if still nothing
    let progressData: { lastAccessed: Date }[] = [];
    if (activityEvents.length === 0 && questionData.length === 0) {
      progressData = await prisma.userProgress.findMany({
        where: whereClause,
        select: { lastAccessed: true }
      });
    }

  // Use UTC ISO date (YYYY-MM-DD) for stable day keys to prevent local timezone off-by-one
  const dayKey = (d: Date) => d.toISOString().slice(0,10);

    // Build a map dateString -> count (inclusive of today, using local day keys)
    const counts: Record<string, number> = {};
    const perType: Record<string, Record<string, number>> = {}; // date -> type -> count
    const today = new Date();
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      counts[k] = 0;
      perType[k] = {};
    }

    const increment = (dt: Date, type?: string) => {
      const key = dayKey(dt);
      // If event day not pre-initialized (timezone drift), add it if within window range
      if (counts[key] === undefined) {
        counts[key] = 0;
        perType[key] = {};
      }
      counts[key] += 1;
      if (type) {
        const bucket = perType[key];
        bucket[type] = (bucket[type]||0)+1;
      }
    };

  // Prioritize UserActivity when present; otherwise gracefully fall back
  const useActivityEvents = activityEvents.length > 0;
    if (useActivityEvents) {
      activityEvents.forEach((a: any) => increment(a.createdAt, a.type));
    } else if (questionData.length) {
      questionData.forEach(q => increment(q.updatedAt, 'questionUserData'));
    } else {
      progressData.forEach(p => increment(p.lastAccessed, 'userProgress'));
    }

    const dailyData = Object.entries(counts)
      .map(([date, total]) => ({
        date,
        total,
        types: perType[date]
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    const totalEvents = dailyData.reduce((a,c)=> a + c.total, 0);

    // Metrics
    const activeDays = dailyData.filter(d=>d.total>0).length;
    const avgPerWindow = windowDays ? totalEvents / windowDays : 0;
    const avgPerActiveDay = activeDays ? totalEvents / activeDays : 0;
    const todayKey = dayKey(new Date());
    // Current streak (consecutive days ending today with total>0)
    let streakCurrent = 0;
    for (let i = dailyData.length-1; i>=0; i--) {
      const d = dailyData[i];
      if (i === dailyData.length-1 && d.date !== todayKey) break; // only count streak if today present
      if (d.total>0) streakCurrent++; else break;
    }
    // Max streak
    let maxStreak = 0, cur = 0;
    dailyData.forEach(d=> { if (d.total>0) { cur++; if (cur>maxStreak) maxStreak=cur; } else { cur=0; } });
    const firstActive = dailyData.find(d=>d.total>0)?.date || null;
    const lastActive = [...dailyData].reverse().find(d=>d.total>0)?.date || null;
    // Aggregate type totals
    const typeTotals: Record<string, number> = {};
    Object.values(perType).forEach(dayMap => {
      Object.entries(dayMap).forEach(([t,c]) => { typeTotals[t] = (typeTotals[t]||0)+c; });
    });

    const responsePayload = {
      windowDays,
      dailyData,
      source: useActivityEvents ? 'userActivity' : (questionData.length ? 'questionUserData' : 'userProgress'),
      activityEventsCount: activityEvents.length,
      questionDataCount: questionData.length,
      progressDataCount: progressData.length,
      totalEvents,
      serverNow: new Date().toISOString(),
      tzOffsetMinutes: new Date().getTimezoneOffset(),
      note: 'Activity includes per-type breakdown and metrics.',
      rawSample: debug ? activityEvents.slice(0,5) : undefined,
      metrics: {
        activeDays,
        avgPerWindow: Number(avgPerWindow.toFixed(2)),
        avgPerActiveDay: Number(avgPerActiveDay.toFixed(2)),
        streakCurrent,
        maxStreak,
        firstActive,
        lastActive,
        typeTotals
      }
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error fetching daily activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily activity' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler); 