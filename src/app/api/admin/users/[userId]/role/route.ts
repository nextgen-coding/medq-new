import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

async function putHandler(request: AuthenticatedRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  const { role } = await request.json();

  if (!['student', 'maintainer', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent admin from changing their own role
  if (user.id === request.user?.userId) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
  }

  // Update user role
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return NextResponse.json(updatedUser);
}

// PUT /api/admin/users/[userId]/role - Update user role
export const PUT = requireAdmin(putHandler);