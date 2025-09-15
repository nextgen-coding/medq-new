import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Lightweight in-memory cache (per process) to reduce query load
let cache: { key: string; ts: number; data: any } | null = null;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') === '30' ? 30 : 7; // days
    const key = `stats-${range}`;
    const now = Date.now();
    if (cache && cache.key === key && now - cache.ts < 15_000) {
      return NextResponse.json(cache.data);
    }

    const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [users, questions, sessions, comments, reportsOpen, activities24h] = await Promise.all([
      prisma.user.count(),
      prisma.question.count(),
      prisma.session.count(),
      prisma.comment.count(),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.userActivity.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    ]);

    const rawActivity = await prisma.$queryRawUnsafe<Array<{ day: string; count: number }>>(`
      SELECT to_char(date_trunc('day', "created_at"), 'YYYY-MM-DD') as day, COUNT(DISTINCT "user_id")::int as count
      FROM user_activity
      WHERE created_at >= $1
      GROUP BY 1
      ORDER BY 1 ASC
    `, since);

    const contentActivity = await prisma.$queryRawUnsafe<Array<{ day: string; questions: number; sessions: number; reports: number }>>(`
      WITH days AS (
        SELECT generate_series(date_trunc('day', NOW()) - interval '6 days', date_trunc('day', NOW()), interval '1 day') AS d
      )
      SELECT to_char(d.d, 'YYYY-MM-DD') as day,
        COALESCE(q.c,0)::int as questions,
        COALESCE(s.c,0)::int as sessions,
        COALESCE(r.c,0)::int as reports
      FROM days d
      LEFT JOIN (
        SELECT date_trunc('day', created_at) dd, count(*) c FROM questions WHERE created_at >= $1 GROUP BY 1
      ) q ON q.dd = d.d
      LEFT JOIN (
        SELECT date_trunc('day', created_at) dd, count(*) c FROM sessions WHERE created_at >= $1 GROUP BY 1
      ) s ON s.dd = d.d
      LEFT JOIN (
        SELECT date_trunc('day', created_at) dd, count(*) c FROM reports WHERE created_at >= $1 GROUP BY 1
      ) r ON r.dd = d.d
      ORDER BY d.d ASC
    `, since7);

    const topSpecialties = await prisma.$queryRawUnsafe<Array<{ name: string; questions: number }>>(`
      SELECT s.name, COUNT(q.id)::int AS questions
      FROM specialties s
      JOIN lectures l ON l.specialty_id = s.id
      JOIN questions q ON q.lecture_id = l.id
      GROUP BY s.id
      ORDER BY questions DESC
      LIMIT 10
    `);

    // User growth (new signups per day)
    const userGrowthRaw = await prisma.$queryRawUnsafe<Array<{ day: string; count: number }>>(`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, COUNT(*)::int as count
      FROM profiles
      WHERE created_at >= $1
      GROUP BY 1
      ORDER BY 1 ASC
    `, since);

    // Users by role
    const usersByRole = await prisma.$queryRawUnsafe<Array<{ role: string; count: number }>>(`
      SELECT role, COUNT(*)::int as count FROM profiles GROUP BY role
    `);

    // Users by niveau distribution
    const usersByNiveau = await prisma.$queryRawUnsafe<Array<{ name: string; count: number }>>(`
      SELECT n.name, COALESCE(COUNT(u.id),0)::int as count
      FROM niveaux n
      LEFT JOIN profiles u ON u.niveau_id = n.id
      GROUP BY n.id
      ORDER BY n.order
    `);

    // Users by semester distribution
    const usersBySemester = await prisma.$queryRawUnsafe<Array<{ name: string; count: number }>>(`
      SELECT s.name, COALESCE(COUNT(u.id),0)::int as count
      FROM semesters s
      LEFT JOIN profiles u ON u.semester_id = s.id
      GROUP BY s.id
      ORDER BY s.order
    `);

    // Profile completion & subscription status
    const [profileCompleted, profileIncomplete, subscriptionActive, subscriptionInactive] = await Promise.all([
      prisma.user.count({ where: { profileCompleted: true } }),
      prisma.user.count({ where: { profileCompleted: false } }),
      prisma.user.count({ where: { hasActiveSubscription: true } }),
      prisma.user.count({ where: { hasActiveSubscription: false } })
    ]);

    // Top active users last 7 days
    const topActiveUsers = await prisma.$queryRawUnsafe<Array<{ email: string; activity: number }>>(`
      SELECT u.email, COUNT(a.id)::int as activity
      FROM user_activity a
      JOIN profiles u ON u.id = a.user_id
      WHERE a.created_at >= $1
      GROUP BY u.id
      ORDER BY activity DESC
      LIMIT 5
    `, since7);

    const data = {
      totals: { users, questions, sessions, comments, reportsOpen, activities24h },
      dailyActive: rawActivity.map(r => ({ date: r.day, count: r.count })),
      activityLast7: contentActivity.map(r => ({ label: r.day.slice(5), questions: r.questions, sessions: r.sessions, reports: r.reports })),
      topSpecialties,
      userGrowth: userGrowthRaw.map(r => ({ date: r.day, count: r.count })),
      usersByRole,
      usersByNiveau,
      usersBySemester,
      profileCompletion: { completed: profileCompleted, incomplete: profileIncomplete },
      subscriptionStatus: { active: subscriptionActive, inactive: subscriptionInactive },
      topActiveUsers
    };
    cache = { key, ts: now, data };
    return NextResponse.json(data);
  } catch (e) {
    console.error('[ADMIN_STATS]', e);
    return NextResponse.json({ error: 'stats_failed' }, { status: 500 });
  }
}