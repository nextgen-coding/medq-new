import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { SubscriptionType } from '@prisma/client'

async function handler(request: AuthenticatedRequest) {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const body = await request.json()
    const { couponCode, subscriptionType } = body

    if (!couponCode || !subscriptionType) {
      return NextResponse.json(
        { error: 'Code de réduction et type d\'abonnement requis' },
        { status: 400 }
      )
    }

    if (!Object.values(SubscriptionType).includes(subscriptionType)) {
      return NextResponse.json(
        { error: 'Type d\'abonnement invalide' },
        { status: 400 }
      )
    }

    // Find the coupon
    const coupon = await prisma.reductionCoupon.findUnique({
      where: { code: couponCode }
    })

    if (!coupon) {
      return NextResponse.json(
        { error: 'Code de réduction invalide' },
        { status: 400 }
      )
    }

    // Check if coupon is already used
    if (coupon.isUsed) {
      return NextResponse.json(
        { error: 'Ce code de réduction a déjà été utilisé' },
        { status: 400 }
      )
    }

    // Check if coupon is expired
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Ce code de réduction a expiré' },
        { status: 400 }
      )
    }

    // Get current pricing to calculate discount
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
      pricingSettings = {
        semesterPrice: 50,
        annualPrice: 120,
        discountEnabled: false,
        discountPercentage: null,
        discountStartDate: null,
        discountEndDate: null,
        currency: 'TND'
      }
    }

    // Calculate base amount (without any existing discounts)
    const baseAmount = subscriptionType === SubscriptionType.annual
      ? pricingSettings.annualPrice
      : pricingSettings.semesterPrice

    // Calculate discount amount based on coupon type
    let discountAmount = 0
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round(baseAmount * (coupon.discountValue / 100) * 100) / 100
    } else {
      discountAmount = Math.min(coupon.discountValue, baseAmount) // Don't allow discount > base amount
    }

    return NextResponse.json({
      valid: true,
      discountAmount,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      couponId: coupon.id
    })

  } catch (error) {
    console.error('Coupon validation error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la validation du code de réduction' },
      { status: 500 }
    )
  }
}

export const POST = requireAuth(handler)
