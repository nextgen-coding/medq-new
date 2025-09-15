import { NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function getHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        hasActiveSubscription: true,
        subscriptionExpiresAt: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if subscription is still active
    const hasActiveSubscription = user.hasActiveSubscription && 
      (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) > new Date());

    return NextResponse.json({
      hasActiveSubscription,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}

async function putHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const { hasActiveSubscription, subscriptionExpiresAt } = await request.json();

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        hasActiveSubscription: hasActiveSubscription ?? false,
        subscriptionExpiresAt: subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null,
      },
      select: {
        hasActiveSubscription: true,
        subscriptionExpiresAt: true,
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription status' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler);
export const PUT = requireAuth(putHandler); 