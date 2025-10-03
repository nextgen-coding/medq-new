import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { sendActivationKeyEmail } from '@/lib/email'

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    const { paymentId } = await params
    const body = await request.json()
    const { activationKey } = body

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    if (!activationKey) {
      return NextResponse.json({ error: 'Activation key is required' }, { status: 400 })
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

    // Validate activation key format
    const expectedPrefix = payment.subscriptionType === 'annual' ? 'MEDQ-Y' : 'MEDQ-S'
    if (!activationKey.startsWith(expectedPrefix + '-')) {
      return NextResponse.json({ error: 'Invalid activation key format' }, { status: 400 })
    }

    // Check if user is admin
    if (request.user!.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Use the provided activation key
    const activationKeyCode = activationKey

    // Create voucher code record
    const voucherCode = await prisma.voucherCode.create({
      data: {
        code: activationKeyCode,
        subscriptionType: payment.subscriptionType,
        createdBy: request.user!.userId
      }
    })

    // Send activation key email
    try {
      await sendActivationKeyEmail(
        payment.user.email,
        activationKeyCode,
        payment.amount,
        payment.currency,
        payment.subscriptionType,
        payment.user.name || undefined
      );
      console.log('Activation key email sent successfully to:', payment.user.email);
    } catch (emailError) {
      console.error('Failed to send activation key email:', emailError);
      // Continue with the process even if email fails
    }

    // Update payment with activation key (keep status as is)
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        activationKey: activationKeyCode,
        adminNotes: `Clé d'activation générée et envoyée: ${activationKeyCode}`
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Activation key sent successfully',
      activationKey: activationKeyCode
    })

  } catch (error) {
    console.error('Error sending activation key:', error)
    return NextResponse.json(
      { error: 'Failed to send activation key' },
      { status: 500 }
    )
  }
}

export const POST = requireAuth(handler)
