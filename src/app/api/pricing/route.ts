import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/pricing - Get current pricing for public use
export async function GET() {
  try {
    // Get the latest pricing settings
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

    // If no pricing settings exist, return default values
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

    // Calculate effective prices with discount
    const currentDate = new Date()
    const isDiscountActive = pricingSettings.discountEnabled &&
      pricingSettings.discountPercentage &&
      (!pricingSettings.discountStartDate || pricingSettings.discountStartDate <= currentDate) &&
      (!pricingSettings.discountEndDate || pricingSettings.discountEndDate >= currentDate)

    const discountMultiplier = isDiscountActive 
      ? (100 - (pricingSettings.discountPercentage || 0)) / 100
      : 1

    const semesterFinalPrice = Math.round(pricingSettings.semesterPrice * discountMultiplier * 100) / 100
    const annualFinalPrice = Math.round(pricingSettings.annualPrice * discountMultiplier * 100) / 100

    const response = {
      success: true,
      data: {
        semester: {
          originalPrice: pricingSettings.semesterPrice,
          finalPrice: semesterFinalPrice,
          discountAmount: isDiscountActive 
            ? Math.round(pricingSettings.semesterPrice * (pricingSettings.discountPercentage || 0) / 100 * 100) / 100
            : 0,
          duration: '6 mois'
        },
        annual: {
          originalPrice: pricingSettings.annualPrice,
          finalPrice: annualFinalPrice,
          discountAmount: isDiscountActive 
            ? Math.round(pricingSettings.annualPrice * (pricingSettings.discountPercentage || 0) / 100 * 100) / 100
            : 0,
          duration: '12 mois',
          savings: Math.round((pricingSettings.semesterPrice * 2 - pricingSettings.annualPrice) * 100) / 100
        },
        currency: pricingSettings.currency,
        isDiscountActive,
        discountPercentage: isDiscountActive ? pricingSettings.discountPercentage : null
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching pricing:', error)
    
    // Return default pricing in case of error
    return NextResponse.json({
      success: true,
      data: {
        semester: {
          originalPrice: 50,
          finalPrice: 50,
          discountAmount: 0,
          duration: '6 mois'
        },
        annual: {
          originalPrice: 120,
          finalPrice: 120,
          discountAmount: 0,
          duration: '12 mois',
          savings: 20
        },
        currency: 'TND',
        isDiscountActive: false,
        discountPercentage: null
      }
    })
  }
}
