import { NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function postHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.userId;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const type = typeof body.type === 'string' ? body.type : 'question_attempt';
    await prisma.userActivity.create({ data: { userId, type } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Error logging user activity', e);
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
  }
}

export const POST = requireAuth(postHandler);