import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

async function putHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const body = await request.json();
  const { role } = body as { role: 'student' | 'maintainer' | 'admin' };

  if (!['student', 'maintainer', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, name: true, role: true }
  });

  return NextResponse.json(updated);
}

export const PUT = requireAdmin(putHandler);
