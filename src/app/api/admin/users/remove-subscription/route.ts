import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

async function handler(request: AuthenticatedRequest) {
  try {
    const body = await request.json()
    const { userId, reason } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if user exists and has an active subscription
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        hasActiveSubscription: true,
        subscriptionExpiresAt: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.hasActiveSubscription) {
      return NextResponse.json(
        { error: 'User does not have an active subscription' },
        { status: 400 }
      )
    }

    // Remove subscription
    await prisma.user.update({
      where: { id: userId },
      data: {
        hasActiveSubscription: false,
        subscriptionExpiresAt: null
      }
    })

    // Log the action (you could create an audit log table if needed)
    console.log(`Admin ${request.user?.email} removed subscription for user ${user.email}. Reason: ${reason || 'No reason provided'}`)

    return NextResponse.json({
      success: true,
      message: 'Subscription removed successfully'
    })

  } catch (error) {
    console.error('Error removing subscription:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = requireAdmin(handler)