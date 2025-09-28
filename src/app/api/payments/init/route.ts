import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { PaymentMethod, SubscriptionType } from '@prisma/client'

// 🔒 SECURITY FUNCTIONS

interface SecurePricing {
  semesterPrice: number
  annualPrice: number
  discountEnabled: boolean
  discountPercentage: number | null
  discountStartDate: Date | null
  discountEndDate: Date | null
  currency: string
}

interface SecureAmount {
  finalAmount: number
  originalAmount: number
  discountAmount: number
  currency: string
}

/**
 * 🔒 Securely fetch pricing from database
 * Always use server-side pricing, never trust client data
 */
async function getSecurePricing(): Promise<SecurePricing> {
  let pricingSettings = await prisma.pricingSettings.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: {
      semesterPrice: true,
      annualPrice: true,
      discountEnabled: true,
      discountPercentage: true,
      discountStartDate: true,
      discountEndDate: true,
      currency: true
    }
  })

  // Use secure default pricing if no settings found
  if (!pricingSettings) {
    return {
      semesterPrice: 50,
      annualPrice: 120,
      discountEnabled: false,
      discountPercentage: null,
      discountStartDate: null,
      discountEndDate: null,
      currency: 'TND'
    }
  }

  return pricingSettings
}

/**
 * 🔒 Calculate secure amount with server-side validation
 * Prevents client-side amount tampering
 */
function calculateSecureAmount(
  subscriptionType: SubscriptionType, 
  pricing: SecurePricing
): SecureAmount {
  const currentDate = new Date()
  
  // Determine if discount is currently active
  const isDiscountActive = pricing.discountEnabled &&
    pricing.discountPercentage &&
    pricing.discountPercentage > 0 &&
    (!pricing.discountStartDate || pricing.discountStartDate <= currentDate) &&
    (!pricing.discountEndDate || pricing.discountEndDate >= currentDate)

  // Get base amount (no client input)
  const originalAmount = subscriptionType === SubscriptionType.annual 
    ? pricing.annualPrice 
    : pricing.semesterPrice

  // Calculate discount
  const discountMultiplier = isDiscountActive 
    ? (100 - (pricing.discountPercentage || 0)) / 100
    : 1

  const finalAmount = Math.round(originalAmount * discountMultiplier * 100) / 100
  const discountAmount = originalAmount - finalAmount

  return {
    finalAmount,
    originalAmount,
    discountAmount,
    currency: pricing.currency
  }
}

/**
 * 🔒 Verify payment amount matches server calculation
 * Additional security layer for external payments
 */
async function verifyPaymentAmount(
  paymentId: string, 
  expectedAmount: number
): Promise<boolean> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { amount: true }
  })
  
  return payment ? Math.abs(payment.amount - expectedAmount) < 0.01 : false
}

async function handler(request: AuthenticatedRequest) {
  try {
    const body = await request.json()
    const { method, subscriptionType, customPaymentDetails, voucherCode, proofFileUrl, couponCode } = body

    // Validate input
    if (!method || !subscriptionType) {
      return NextResponse.json(
        { error: 'Method and subscription type are required' },
        { status: 400 }
      )
    }

    if (!Object.values(PaymentMethod).includes(method)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    if (!Object.values(SubscriptionType).includes(subscriptionType)) {
      return NextResponse.json({ error: 'Invalid subscription type' }, { status: 400 })
    }

    // 🔒 SECURITY: Always fetch and calculate pricing server-side
    // Never trust client-provided amounts
    const securePricing = await getSecurePricing()
    let { finalAmount, originalAmount, discountAmount, currency } = calculateSecureAmount(
      subscriptionType, 
      securePricing
    )

    // Handle coupon discount for konnect_gateway method
    let couponDiscount = 0
    let couponId = null
    if (method === PaymentMethod.konnect_gateway && couponCode) {
      // Validate coupon
      const coupon = await prisma.reductionCoupon.findUnique({
        where: { code: couponCode }
      })

      if (!coupon) {
        return NextResponse.json({ error: 'Code de réduction invalide' }, { status: 400 })
      }

      if (coupon.isUsed) {
        return NextResponse.json({ error: 'Ce code de réduction a déjà été utilisé' }, { status: 400 })
      }

      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return NextResponse.json({ error: 'Ce code de réduction a expiré' }, { status: 400 })
      }

      // Calculate coupon discount
      if (coupon.discountType === 'percentage') {
        couponDiscount = Math.round(finalAmount * (coupon.discountValue / 100) * 100) / 100
      } else {
        couponDiscount = Math.min(coupon.discountValue, finalAmount)
      }

      finalAmount = Math.max(0, finalAmount - couponDiscount)
      couponId = coupon.id

      // Mark coupon as used immediately for Konnect payments to prevent reuse
      await prisma.reductionCoupon.update({
        where: { id: coupon.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
          usedById: request.user!.userId
        }
      })
    }

    // 🔒 SECURITY: Create payment record with server-calculated amount FIRST
    // This ensures we have a secure audit trail before any external API calls
    const securePaymentData = {
      userId: request.user!.userId,
      amount: finalAmount,
      method,
      subscriptionType,
      // Store original pricing for audit
      metadata: {
        originalAmount,
        discountAmount,
        couponDiscount,
        couponId,
        currency,
        pricingTimestamp: new Date().toISOString()
      }
    }

    // Handle voucher code method
    if (method === PaymentMethod.voucher_code) {
      if (!voucherCode) {
        return NextResponse.json({ error: 'Voucher code is required' }, { status: 400 })
      }

      // Check if voucher code exists and is valid
      const voucher = await prisma.voucherCode.findUnique({
        where: { code: voucherCode }
      })

      if (!voucher) {
        return NextResponse.json({ error: 'Invalid voucher code' }, { status: 400 })
      }

      if (voucher.isUsed) {
        return NextResponse.json({ error: 'Voucher code already used' }, { status: 400 })
      }

      if (voucher.expiresAt && voucher.expiresAt < new Date()) {
        return NextResponse.json({ error: 'Voucher code expired' }, { status: 400 })
      }

      // Check if user already used this voucher
      const existingUsage = await prisma.voucherCodeUsage.findFirst({
        where: {
          userId: request.user!.userId,
          voucherCodeId: voucher.id
        }
      })

      if (existingUsage) {
        return NextResponse.json(
          { error: 'You have already used this voucher code' },
          { status: 400 }
        )
      }

      // Create payment record and activate subscription immediately
      const payment = await prisma.$transaction(async (tx) => {
        // Create payment record
        const payment = await tx.payment.create({
          data: {
            userId: request.user!.userId,
            amount: 0, // Voucher is free
            method: PaymentMethod.voucher_code,
            status: 'completed',
            subscriptionType,
            voucherCodeId: voucher.id
          }
        })

        // Mark voucher as used
        await tx.voucherCode.update({
          where: { id: voucher.id },
          data: {
            isUsed: true,
            usedAt: new Date()
          }
        })

        // Create voucher usage record
        await tx.voucherCodeUsage.create({
          data: {
            userId: request.user!.userId,
            voucherCodeId: voucher.id
          }
        })

        // Update user subscription
        const expiresAt = subscriptionType === SubscriptionType.annual
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
          : new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000) // 6 months

        await tx.user.update({
          where: { id: request.user!.userId },
          data: {
            hasActiveSubscription: true,
            subscriptionExpiresAt: expiresAt
          }
        })

        return payment
      })

      return NextResponse.json({
        success: true,
        paymentId: payment.id,
        message: 'Subscription activated successfully!'
      })
    }

    // Handle custom payment method
    if (method === PaymentMethod.custom_payment) {
      if (!customPaymentDetails) {
        return NextResponse.json(
          { error: 'Payment details are required for custom payment' },
          { status: 400 }
        )
      }

      if (!proofFileUrl) {
        return NextResponse.json(
          { error: 'Proof of payment is required for custom payment' },
          { status: 400 }
        )
      }

      const payment = await prisma.payment.create({
        data: {
          userId: request.user!.userId,
          amount: finalAmount,
          method: PaymentMethod.custom_payment,
          status: 'awaiting_verification',
          subscriptionType,
          customPaymentDetails,
          proofImageUrl: proofFileUrl
        }
      })

      return NextResponse.json({
        success: true,
        paymentId: payment.id,
        message: 'Payment submitted for verification',
        requiresProof: true
      })
    }

    // Handle Konnect gateway method
    if (method === PaymentMethod.konnect_gateway) {
      // Get user details for Konnect
      const user = await prisma.user.findUnique({
        where: { id: request.user!.userId },
        select: { name: true, email: true }
      })

      const payment = await prisma.payment.create({
        data: {
          userId: request.user!.userId,
          amount: finalAmount,
          method: PaymentMethod.konnect_gateway,
          status: 'pending',
          subscriptionType
        }
      })

      // Initialize Konnect payment
      const konnectResponse = await fetch(`${process.env.KONNECT_BASE_URL}/payments/init-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.KONNECT_API_KEY!
        },
        body: JSON.stringify({
          receiverWalletId: process.env.KONNECT_WALLET_ID,
          token: currency,
          amount: finalAmount * 1000, // Convert to millimes (🔒 server-calculated amount)
          description: `MedQ ${subscriptionType} subscription`,
          orderId: payment.id,
          webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/konnect/webhook`,
          firstName: user?.name?.split(' ')[0] || '',
          lastName: user?.name?.split(' ').slice(1).join(' ') || '',
          email: user?.email || request.user?.email
        })
      })

      if (!konnectResponse.ok) {
        let konnectError;
        try {
          konnectError = await konnectResponse.json();
        } catch {
          konnectError = await konnectResponse.text();
        }
        
        console.error('Konnect API Error:', {
          status: konnectResponse.status,
          statusText: konnectResponse.statusText,
          error: konnectError,
          requestBody: {
            receiverWalletId: process.env.KONNECT_WALLET_ID,
            token: currency,
            amount: finalAmount * 1000,
            description: `MedQ ${subscriptionType} subscription`,
            orderId: payment.id,
            webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/konnect/webhook`,
            firstName: user?.name?.split(' ')[0] || '',
            lastName: user?.name?.split(' ').slice(1).join(' ') || '',
            email: user?.email || request.user?.email
          },
          endpoint: `${process.env.KONNECT_BASE_URL}/payments/init-payment`
        })

        // Update payment status to failed
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'failed' }
        })

        return NextResponse.json(
          { 
            error: 'Failed to initialize payment gateway',
            details: konnectError
          },
          { status: 500 }
        )
      }

      const konnectData = await konnectResponse.json()

      // Update payment with Konnect details
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          konnectPaymentRef: konnectData.paymentRef,
          konnectPayUrl: konnectData.payUrl
        }
      })

      return NextResponse.json({
        success: true,
        paymentId: payment.id,
        paymentUrl: konnectData.payUrl,
        paymentRef: konnectData.paymentRef
      })
    }

    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })

  } catch (error) {
    console.error('Payment initialization error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = requireAuth(handler)
