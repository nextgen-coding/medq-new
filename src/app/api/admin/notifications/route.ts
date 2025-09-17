import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

// GET /api/admin/notifications - Get all admin notifications
async function getHandler(request: AuthenticatedRequest) {
  try {
    const notifications = await prisma.notification.findMany({
      select: {
        id: true,
        userId: true,
        title: true,
        message: true,
        type: true,
        isRead: true,
        createdAt: true,
        user: {
          select: { id: true, email: true, name: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = requireAdmin(getHandler);

// POST /api/admin/notifications - Create and send notifications to targeted users
async function postHandler(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const {
      title,
      message,
      type = 'info',
      category = 'system',
      targeting
    } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    if (!targeting) {
      return NextResponse.json({ error: 'Targeting criteria is required' }, { status: 400 });
    }

    // Build user query based on targeting criteria
    const whereClause: any = {};

    // Target all users
    if (targeting.targetAll) {
      // No additional filters needed
    } else {
      const conditions: any[] = [];

      // Target by niveau
      if (targeting.niveauIds && targeting.niveauIds.length > 0) {
        conditions.push({
          niveauId: { in: targeting.niveauIds }
        });
      }

      // Target by semester
      if (targeting.semesterIds && targeting.semesterIds.length > 0) {
        conditions.push({
          semesterId: { in: targeting.semesterIds }
        });
      }

      // Target by subscription status
      if (targeting.subscriptionStatus === 'paid') {
        conditions.push({
          hasActiveSubscription: true
        });
      } else if (targeting.subscriptionStatus === 'unpaid') {
        conditions.push({
          hasActiveSubscription: false
        });
      }

      // Target by email verification status
      if (targeting.verificationStatus === 'verified') {
        conditions.push({
          emailVerified: { not: null }
        });
      } else if (targeting.verificationStatus === 'unverified') {
        conditions.push({
          emailVerified: null
        });
      }

      // Target by role
      if (targeting.roles && targeting.roles.length > 0) {
        conditions.push({
          role: { in: targeting.roles }
        });
      }

      // Target by profile completion status
      if (targeting.profileCompleted === true) {
        conditions.push({
          profileCompleted: true
        });
      } else if (targeting.profileCompleted === false) {
        conditions.push({
          profileCompleted: false
        });
      }

      // Target by account status
      if (targeting.accountStatus && targeting.accountStatus.length > 0) {
        conditions.push({
          status: { in: targeting.accountStatus }
        });
      }

      // Combine conditions with OR logic if multiple criteria are specified
      if (conditions.length > 0) {
        if (targeting.combineWithAnd) {
          whereClause.AND = conditions;
        } else {
          whereClause.OR = conditions;
        }
      }
    }

    // Get targeted users
    const targetedUsers = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        niveauId: true,
        semesterId: true,
        hasActiveSubscription: true,
        profileCompleted: true,
        emailVerified: true,
        status: true
      }
    });

    if (targetedUsers.length === 0) {
      return NextResponse.json({ 
        error: 'No users match the targeting criteria',
        targetedCount: 0
      }, { status: 400 });
    }

    // Create notifications for all targeted users
    // Only include columns guaranteed to exist in current DB schema
    const notificationData = targetedUsers.map(user => ({
      userId: user.id,
      title,
      message,
      // rely on DB defaults for type/category when present
      isRead: false
    }));

    const result = await prisma.notification.createMany({
      data: notificationData
    });

    // Log the notification creation for admin tracking
    console.log(`Admin action: sent notification to ${targetedUsers.length} users`, {
      title,
      type,
      category,
      targeting,
      userCount: targetedUsers.length
    });

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${targetedUsers.length} users`,
      targetedCount: targetedUsers.length,
      createdCount: result.count,
      targetedUsers: targetedUsers.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role
      }))
    });

  } catch (error) {
    console.error('Error creating admin notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = requireAdmin(postHandler);

// DELETE /api/admin/notifications/[id] - Delete a specific notification
async function deleteHandler(request: AuthenticatedRequest) {
  try {
    const url = new URL(request.url);
    const notificationId = url.searchParams.get('id');

    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    await prisma.notification.delete({ where: { id: notificationId } });
    return NextResponse.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const DELETE = requireAdmin(deleteHandler);