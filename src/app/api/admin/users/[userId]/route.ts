import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

async function getHandler(request: AuthenticatedRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          progress: true,
          reports: true,
        },
      },
      niveau: {
        select: {
          name: true,
        },
      },
      semester: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Format the response to match the expected structure
  const formattedUser = {
    ...user,
    profile: {
      specialty: null, // This isn't directly available in this schema
      niveau: user.niveau?.name || null,
      university: null, // This field doesn't exist in current schema
    },
    subscription: {
      type: user.hasActiveSubscription ? 'active' : 'inactive',
      status: user.hasActiveSubscription ? 'active' : 'inactive',
      expiresAt: user.subscriptionExpiresAt,
    },
  };

  return NextResponse.json(formattedUser);
}

async function deleteHandler(request: AuthenticatedRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent admin from deleting themselves
  if (user.id === request.user?.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  // Delete user and all related data (cascading delete should handle this)
  await prisma.user.delete({
    where: { id: userId },
  });

  return NextResponse.json({ message: 'User deleted successfully' });
}

// GET /api/admin/users/[userId] - Get user details
export const GET = requireAdmin(getHandler);

// DELETE /api/admin/users/[userId] - Delete user
export const DELETE = requireAdmin(deleteHandler);