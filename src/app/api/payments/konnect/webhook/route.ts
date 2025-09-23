import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SubscriptionType } from '@prisma/client'

/**
 * 🔒 Re-verify pricing at payment completion
 * Additional security layer to ensure pricing hasn't been tampered with
 */
async function reverifyPricing(subscriptionType: SubscriptionType): Promise<number> {
  let pricingSettings = await prisma.pricingSettings.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: {
      semesterPrice: true,
      annualPrice: true,
      discountEnabled: true,
      discountPercentage: true,
      discountStartDate: true,
      discountEndDate: true
    }
  })

  if (!pricingSettings) {
    return subscriptionType === SubscriptionType.annual ? 120 : 50
  }

  const currentDate = new Date()
  const isDiscountActive = pricingSettings.discountEnabled &&
    pricingSettings.discountPercentage &&
    (!pricingSettings.discountStartDate || pricingSettings.discountStartDate <= currentDate) &&
    (!pricingSettings.discountEndDate || pricingSettings.discountEndDate >= currentDate)

  const baseAmount = subscriptionType === SubscriptionType.annual 
    ? pricingSettings.annualPrice 
    : pricingSettings.semesterPrice

  const discountMultiplier = isDiscountActive 
    ? (100 - (pricingSettings.discountPercentage || 0)) / 100
    : 1

  return Math.round(baseAmount * discountMultiplier * 100) / 100
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const paymentRef = searchParams.get('payment_ref')

    if (!paymentRef) {
      return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 })
    }

    // Find payment by Konnect payment reference
    const payment = await prisma.payment.findFirst({
      where: { konnectPaymentRef: paymentRef },
      include: { user: true }
    })

    if (!payment) {
      console.error('Payment not found for ref:', paymentRef)
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Get payment details from Konnect
    const konnectResponse = await fetch(
      `${process.env.KONNECT_BASE_URL}/payments/${paymentRef}`,
      {
        headers: {
          'x-api-key': process.env.KONNECT_API_KEY!
        }
      }
    )

    if (!konnectResponse.ok) {
      console.error('Failed to fetch payment details from Konnect')
      return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 })
    }

    const konnectData = await konnectResponse.json()
    const konnectPayment = konnectData.payment

    // 🔒 SECURITY: Double-verify pricing at completion time
    const amountTolerance = 0.01 // Allow 1 cent tolerance for rounding
    const currentExpectedAmount = await reverifyPricing(payment.subscriptionType)
    const storedAmount = payment.amount
    
    // Check if stored amount still matches current pricing (within tolerance)
    if (Math.abs(storedAmount - currentExpectedAmount) > amountTolerance) {
      console.warn('Pricing changed between payment initiation and completion:', {
        paymentId: payment.id,
        originalAmount: storedAmount,
        currentExpectedAmount,
        subscriptionType: payment.subscriptionType
      })
      // We'll still process the payment since the user paid the amount that was valid at the time
    }

    // 🔒 SECURITY: Verify payment amount matches our records
    // Convert millimes back to main currency units for comparison
    const konnectAmount = konnectPayment.amount / 1000
    const expectedAmount = payment.amount

    if (Math.abs(konnectAmount - expectedAmount) > amountTolerance) {
      console.error('Payment amount mismatch:', {
        paymentId: payment.id,
        expectedAmount,
        receivedAmount: konnectAmount,
        paymentRef
      })
      
      // Mark payment as failed due to amount mismatch
      await prisma.payment.update({
        where: { id: payment.id },
        data: { 
          status: 'failed',
          adminNotes: `Amount mismatch: expected ${expectedAmount}, received ${konnectAmount}`
        }
      })

      return NextResponse.json({ 
        error: 'Payment amount verification failed',
        details: 'Amount mismatch detected'
      }, { status: 400 })
    }

    // Update payment status based on Konnect response
    if (konnectPayment.status === 'completed' && payment.status !== 'completed') {
      await prisma.$transaction(async (tx) => {
        // Update payment status
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'completed' }
        })

        // Update user subscription
        const expiresAt = payment.subscriptionType === SubscriptionType.annual
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
          : new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000) // 6 months

        await tx.user.update({
          where: { id: payment.userId },
          data: {
            hasActiveSubscription: true,
            subscriptionExpiresAt: expiresAt
          }
        })
      })

      console.log(`Payment ${payment.id} completed successfully for user ${payment.userId}`)
    } else if (konnectPayment.status === 'failed' && payment.status !== 'failed') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' }
      })

      console.log(`Payment ${payment.id} failed for user ${payment.userId}`)
    }

    return NextResponse.json({ success: true, status: konnectPayment.status })

  } catch (error) {
    console.error('Konnect webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
