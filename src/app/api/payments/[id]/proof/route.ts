import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

async function handler(request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { proofImageUrl } = await request.json()
    const params = await context.params
    const paymentId = params.id

    if (!proofImageUrl) {
      return NextResponse.json(
        { error: 'Proof image URL is required' },
        { status: 400 }
      )
    }

    // Verify payment belongs to user
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId: request.user!.userId,
        method: 'custom_payment'
      }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Update payment with proof image
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        proofImageUrl,
        status: 'awaiting_verification'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Proof uploaded successfully. Awaiting admin verification.'
    })

  } catch (error) {
    console.error('Proof upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const PUT = requireAuth(handler)
