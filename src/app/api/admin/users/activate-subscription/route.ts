import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

async function handler(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { userId, subscriptionType } = body;

    if (!userId || !subscriptionType) {
      return NextResponse.json(
        { error: 'User ID and subscription type are required' },
        { status: 400 }
      );
    }

    if (!['semester', 'annual'].includes(subscriptionType)) {
      return NextResponse.json(
        { error: 'Invalid subscription type. Must be "semester" or "annual"' },
        { status: 400 }
      );
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        hasActiveSubscription: true,
        subscriptionExpiresAt: true
      }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate expiration date
    const now = new Date();
    const expirationDate = new Date();
    
    if (subscriptionType === 'annual') {
      expirationDate.setFullYear(now.getFullYear() + 1);
    } else {
      expirationDate.setMonth(now.getMonth() + 6);
    }

    // Update user subscription
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        hasActiveSubscription: true,
        subscriptionExpiresAt: expirationDate,
        updatedAt: now
      },
      select: {
        hasActiveSubscription: true,
        subscriptionExpiresAt: true
      }
    });

    // Log admin action
    const adminEmail = request.user?.email || 'Unknown admin';
    console.log(`Admin ${adminEmail} activated ${subscriptionType} subscription for user ${targetUser.email}`);

    return NextResponse.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: {
        type: subscriptionType,
        status: 'active',
        expiresAt: updatedUser.subscriptionExpiresAt?.toISOString()
      }
    });

  } catch (error) {
    console.error('Error activating subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = requireAdmin(handler);
