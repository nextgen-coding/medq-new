import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth-middleware'

// GET /api/admin/pricing - Get current pricing settings
export async function GET(request: NextRequest) {
  try {
    const authenticatedRequest = await authenticateRequest(request)
    if (!authenticatedRequest || authenticatedRequest.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' }, 
        { status: 401 }
      )
    }

    // Get the latest pricing settings
    let pricingSettings = await prisma.pricingSettings.findFirst({
      orderBy: { updatedAt: 'desc' },
      include: {
        updater: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // If no pricing settings exist, create default ones
    if (!pricingSettings) {
      pricingSettings = await prisma.pricingSettings.create({
        data: {
          semesterPrice: 50,
          annualPrice: 120,
          discountEnabled: false,
          ribNumber: '1234567890',
          d17PhoneNumber: '+216 12 345 678',
          currency: 'TND',
          updatedBy: authenticatedRequest.user.userId
        },
        include: {
          updater: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })
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

    const effectivePrices = {
      semester: {
        originalPrice: pricingSettings.semesterPrice,
        finalPrice: Math.round(pricingSettings.semesterPrice * discountMultiplier * 100) / 100,
        discountAmount: isDiscountActive 
          ? Math.round(pricingSettings.semesterPrice * (pricingSettings.discountPercentage || 0) / 100 * 100) / 100
          : 0
      },
      annual: {
        originalPrice: pricingSettings.annualPrice,
        finalPrice: Math.round(pricingSettings.annualPrice * discountMultiplier * 100) / 100,
        discountAmount: isDiscountActive 
          ? Math.round(pricingSettings.annualPrice * (pricingSettings.discountPercentage || 0) / 100 * 100) / 100
          : 0
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...pricingSettings,
        isDiscountActive,
        effectivePrices
      }
    })

  } catch (error) {
    console.error('Error fetching pricing settings:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres de prix' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/pricing - Update pricing settings
export async function PUT(request: NextRequest) {
  try {
    const authenticatedRequest = await authenticateRequest(request)
    if (!authenticatedRequest || authenticatedRequest.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' }, 
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      semesterPrice,
      annualPrice,
      discountEnabled,
      discountPercentage,
      discountStartDate,
      discountEndDate,
      ribNumber,
      d17PhoneNumber,
      currency
    } = body

    // Validation
    if (typeof semesterPrice !== 'number' || semesterPrice <= 0) {
      return NextResponse.json(
        { error: 'Prix semestriel invalide' },
        { status: 400 }
      )
    }

    if (typeof annualPrice !== 'number' || annualPrice <= 0) {
      return NextResponse.json(
        { error: 'Prix annuel invalide' },
        { status: 400 }
      )
    }

    if (discountEnabled) {
      if (typeof discountPercentage !== 'number' || discountPercentage < 0 || discountPercentage > 100) {
        return NextResponse.json(
          { error: 'Pourcentage de remise invalide (0-100)' },
          { status: 400 }
        )
      }

      if (discountStartDate && discountEndDate) {
        const startDate = new Date(discountStartDate)
        const endDate = new Date(discountEndDate)
        
        if (startDate >= endDate) {
          return NextResponse.json(
            { error: 'La date de début doit être antérieure à la date de fin' },
            { status: 400 }
          )
        }
      }
    }

    // Create new pricing settings
    const pricingSettings = await prisma.pricingSettings.create({
      data: {
        semesterPrice,
        annualPrice,
        discountEnabled: Boolean(discountEnabled),
        discountPercentage: discountEnabled ? discountPercentage : null,
        discountStartDate: discountEnabled && discountStartDate ? new Date(discountStartDate) : null,
        discountEndDate: discountEnabled && discountEndDate ? new Date(discountEndDate) : null,
        ribNumber: ribNumber || '1234567890',
        d17PhoneNumber: d17PhoneNumber || '+216 12 345 678',
        currency: currency || 'TND',
        updatedBy: authenticatedRequest.user.userId
      },
      include: {
        updater: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Paramètres de prix mis à jour avec succès',
      data: pricingSettings
    })

  } catch (error) {
    console.error('Error updating pricing settings:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des paramètres de prix' },
      { status: 500 }
    )
  }
}
