import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { sendPaymentLinkEmail } from '@/lib/email'

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    const { paymentId } = await params
    const { paymentLink } = await request.json()

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    if (!paymentLink || !paymentLink.trim()) {
      return NextResponse.json({ error: 'Payment link is required' }, { status: 400 })
    }

    // Get payment details
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Check if user is admin
    if (request.user!.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Send payment link email
    await sendPaymentLinkEmail(
      payment.user.email,
      paymentLink.trim(),
      payment.amount,
      payment.currency,
      payment.subscriptionType,
      payment.user.name || undefined
    )

    // Update payment with admin notes
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        adminNotes: `Lien de paiement envoyé: ${paymentLink.trim()}`
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Payment link sent successfully'
    })

  } catch (error) {
    console.error('Error sending payment link:', error)
    return NextResponse.json(
      { error: 'Failed to send payment link' },
      { status: 500 }
    )
  }
}

export const POST = requireAuth(handler)
