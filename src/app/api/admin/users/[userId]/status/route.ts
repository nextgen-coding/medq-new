import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

async function putHandler(request: AuthenticatedRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { status } = await request.json();

  if (!['active', 'inactive', 'banned', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent admin from changing their own status
  if (user.id === request.user?.userId) {
    return NextResponse.json({ error: 'Cannot change your own status' }, { status: 400 });
  }

  // Update user status
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
    },
  });

  return NextResponse.json(updatedUser);
}

// PUT /api/admin/users/[userId]/status - Update user status
export const PUT = requireAdmin(putHandler);