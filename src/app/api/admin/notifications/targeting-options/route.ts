import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

// GET /api/admin/notifications/targeting-options - Get available targeting options
async function getHandler(_request: AuthenticatedRequest) {
  try {
    const [niveaux, semesters, userStats] = await Promise.all([
      // Get all niveaux
      prisma.niveau.findMany({
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          order: true,
          _count: {
            select: {
              users: true
            }
          }
        }
      }),
      
      // Get all semesters
      prisma.semester.findMany({
        include: {
          niveau: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              users: true
            }
          }
        },
        orderBy: [
          { niveau: { order: 'asc' } },
          { order: 'asc' }
        ]
      }),

      // Get user statistics for targeting preview
      prisma.user.groupBy({
        by: ['role', 'hasActiveSubscription', 'profileCompleted', 'status'],
        _count: true
      })
    ]);

    // Calculate email verification stats
    const emailStats = await Promise.all([
      prisma.user.count({
        where: { emailVerified: { not: null } }
      }),
      prisma.user.count({
        where: { emailVerified: null }
      })
    ]);

    // Format user statistics
    const userStatistics = {
      total: await prisma.user.count(),
      byRole: userStats.reduce((acc, stat) => {
        acc[stat.role] = (acc[stat.role] || 0) + stat._count;
        return acc;
      }, {} as Record<string, number>),
      bySubscription: {
        paid: userStats.filter(s => s.hasActiveSubscription).reduce((sum, s) => sum + s._count, 0),
        unpaid: userStats.filter(s => !s.hasActiveSubscription).reduce((sum, s) => sum + s._count, 0)
      },
      byProfileCompletion: {
        completed: userStats.filter(s => s.profileCompleted).reduce((sum, s) => sum + s._count, 0),
        incomplete: userStats.filter(s => !s.profileCompleted).reduce((sum, s) => sum + s._count, 0)
      },
      byEmailVerification: {
        verified: emailStats[0],
        unverified: emailStats[1]
      },
      byStatus: userStats.reduce((acc, stat) => {
        acc[stat.status] = (acc[stat.status] || 0) + stat._count;
        return acc;
      }, {} as Record<string, number>)
    };

    return NextResponse.json({
      niveaux,
      semesters,
      userStatistics,
      roles: ['student', 'maintainer', 'admin'],
      subscriptionStatuses: ['paid', 'unpaid', 'all'],
      verificationStatuses: ['verified', 'unverified', 'all'],
      accountStatuses: ['pending', 'active', 'suspended'],
      notificationTypes: ['info', 'success', 'warning', 'error'],
      notificationCategories: ['system', 'progress', 'lecture', 'achievement', 'question', 'reminder']
    });

  } catch (error) {
    console.error('Error fetching targeting options:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = requireAdmin(getHandler);