import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { DiscountType } from '@prisma/client'

async function handler(request: AuthenticatedRequest) {
  // Check if user is admin
  if (request.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (request.method === 'GET') {
    try {
      const { searchParams } = new URL(request.url)
      const isUsed = searchParams.get('isUsed')
      const discountType = searchParams.get('discountType')
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const offset = (page - 1) * limit

      const where: any = {}
      if (isUsed !== null && isUsed !== undefined) {
        where.isUsed = isUsed === 'true'
      }
      if (discountType) where.discountType = discountType

      const [coupons, total] = await Promise.all([
        prisma.reductionCoupon.findMany({
          where,
          include: {
            creator: {
              select: {
                name: true,
                email: true
              }
            },
            usedBy: {
              select: {
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.reductionCoupon.count({ where })
      ])

      return NextResponse.json({
        coupons,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      })

    } catch (error) {
      console.error('Admin reduction coupons fetch error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }

  // POST - Create new reduction coupon
  if (request.method === 'POST') {
    try {
      const body = await request.json()
      const { discountType, discountValue, count = 1, expiresInDays } = body

      if (!discountType) {
        return NextResponse.json(
          { error: 'Discount type is required' },
          { status: 400 }
        )
      }

      if (!Object.values(DiscountType).includes(discountType)) {
        return NextResponse.json(
          { error: 'Invalid discount type' },
          { status: 400 }
        )
      }

      if (typeof discountValue !== 'number' || discountValue <= 0) {
        return NextResponse.json(
          { error: 'Valid discount value is required' },
          { status: 400 }
        )
      }

      // Validate discount value based on type
      if (discountType === DiscountType.percentage && discountValue > 100) {
        return NextResponse.json(
          { error: 'Percentage discount cannot exceed 100%' },
          { status: 400 }
        )
      }

      if (discountType === DiscountType.fixed && discountValue > 1000) {
        return NextResponse.json(
          { error: 'Fixed discount cannot exceed 1000 TND' },
          { status: 400 }
        )
      }

      if (count < 1 || count > 100) {
        return NextResponse.json(
          { error: 'Count must be between 1 and 100' },
          { status: 400 }
        )
      }

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null

      // Generate reduction coupon codes
      const coupons = []
      for (let i = 0; i < count; i++) {
        const code = generateReductionCouponCode()

        const coupon = await prisma.reductionCoupon.create({
          data: {
            code,
            discountType,
            discountValue,
            expiresAt,
            createdBy: request.user!.userId
          }
        })

        coupons.push(coupon)
      }

      return NextResponse.json({
        success: true,
        message: `${count} reduction coupon(s) created successfully`,
        coupons
      })

    } catch (error) {
      console.error('Reduction coupon creation error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }

  // DELETE - Delete reduction coupon
  if (request.method === 'DELETE') {
    try {
      const { searchParams } = new URL(request.url)
      const couponId = searchParams.get('id')

      if (!couponId) {
        return NextResponse.json(
          { error: 'Coupon ID is required' },
          { status: 400 }
        )
      }

      // Check if coupon exists and is not used
      const coupon = await prisma.reductionCoupon.findUnique({
        where: { id: couponId }
      })

      if (!coupon) {
        return NextResponse.json(
          { error: 'Coupon not found' },
          { status: 404 }
        )
      }

      if (coupon.isUsed) {
        return NextResponse.json(
          { error: 'Cannot delete used coupon' },
          { status: 400 }
        )
      }

      // Delete the coupon
      await prisma.reductionCoupon.delete({
        where: { id: couponId }
      })

      return NextResponse.json({
        success: true,
        message: 'Reduction coupon deleted successfully'
      })

    } catch (error) {
      console.error('Reduction coupon deletion error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

// Helper function to generate unique reduction coupon codes
function generateReductionCouponCode(): string {
  const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase()
  return `MEDQ-DISC-${randomStr}`
}

export const GET = requireAuth(handler)
export const POST = requireAuth(handler)
export const DELETE = requireAuth(handler)
