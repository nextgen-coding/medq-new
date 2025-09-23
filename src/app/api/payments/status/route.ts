import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

async function handler(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get('paymentId')

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    // Get payment status
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId: request.user!.userId
      },
      select: {
        id: true,
        status: true,
        method: true,
        amount: true,
        subscriptionType: true,
        createdAt: true,
        konnectPayUrl: true,
        customPaymentDetails: true,
        proofImageUrl: true,
        adminNotes: true
      }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json({ payment })

  } catch (error) {
    console.error('Payment status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = requireAuth(handler)
