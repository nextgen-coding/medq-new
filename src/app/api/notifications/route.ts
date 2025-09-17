import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

// GET /api/notifications - list current user's notifications
async function getHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user!.userId;
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const onlyUnread = url.searchParams.get('unread') === '1';

    const where: any = { userId };
    if (onlyUnread) where.isRead = false;

    const notifications = await prisma.notification.findMany({
      where,
      select: {
        id: true,
        userId: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
        // include type if exists in current client
        // @ts-ignore - tolerate missing field in older schema
        type: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Error listing notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/notifications?id=... - mark a notification as read
async function patchHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user!.userId;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Ensure ownership
    const notif = await prisma.notification.findUnique({ select: { id: true, userId: true }, where: { id } });
    if (!notif || notif.userId !== userId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/notifications?id=... - delete a notification
async function deleteHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user!.userId;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Ensure ownership
    const notif = await prisma.notification.findUnique({ select: { id: true, userId: true }, where: { id } });
    if (!notif || notif.userId !== userId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.notification.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = requireAuth(getHandler);
export const PATCH = requireAuth(patchHandler);
export const DELETE = requireAuth(deleteHandler);
