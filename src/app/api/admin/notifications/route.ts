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
    const { title, message, type = 'info', targeting, userId } = body as {
      title?: string;
      message: string;
      type?: string;
      targeting?: any;
      userId?: string;
    };

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Single-user notification path
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          title: title || 'Message administrateur',
          message,
          // rely on DB defaults for type/category when present
          isRead: false,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Notification sent successfully',
        targetedCount: 1,
        notification,
      });
    }

    // Bulk notifications path
    if (!title) {
      return NextResponse.json({ error: 'Title is required for bulk notifications' }, { status: 400 });
    }
    if (!targeting) {
      return NextResponse.json({ error: 'Targeting criteria is required' }, { status: 400 });
    }

    // Build user query based on targeting criteria
    const whereClause: any = {};
    if (!targeting.targetAll) {
      const conditions: any[] = [];
      if (targeting.niveauIds?.length > 0) conditions.push({ niveauId: { in: targeting.niveauIds } });
      if (targeting.semesterIds?.length > 0) conditions.push({ semesterId: { in: targeting.semesterIds } });
      if (targeting.subscriptionStatus === 'paid') conditions.push({ hasActiveSubscription: true });
      else if (targeting.subscriptionStatus === 'unpaid') conditions.push({ hasActiveSubscription: false });
      if (targeting.verificationStatus === 'verified') conditions.push({ emailVerified: { not: null } });
      else if (targeting.verificationStatus === 'unverified') conditions.push({ emailVerified: null });
      if (targeting.roles?.length > 0) conditions.push({ role: { in: targeting.roles } });
      if (typeof targeting.profileCompleted === 'boolean') conditions.push({ profileCompleted: targeting.profileCompleted });
      if (targeting.accountStatus?.length > 0) conditions.push({ status: { in: targeting.accountStatus } });
      if (conditions.length > 0) {
        if (targeting.combineWithAnd) whereClause.AND = conditions; else whereClause.OR = conditions;
      }
    }

    const targetedUsers = await prisma.user.findMany({
      where: whereClause,
      select: { id: true, email: true, name: true, role: true },
    });

    if (targetedUsers.length === 0) {
      return NextResponse.json({ error: 'No users match the targeting criteria', targetedCount: 0 }, { status: 400 });
    }

    const notificationData = targetedUsers.map((u) => ({
      userId: u.id,
      title,
      message,
      isRead: false,
    }));

    const result = await prisma.notification.createMany({ data: notificationData });

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${targetedUsers.length} users`,
      targetedCount: targetedUsers.length,
      createdCount: result.count,
      targetedUsers: targetedUsers.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role })),
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