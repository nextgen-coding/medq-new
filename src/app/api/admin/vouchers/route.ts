import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { SubscriptionType } from '@prisma/client'

async function handler(request: AuthenticatedRequest) {
  // Check if user is admin
  if (request.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (request.method === 'GET') {
    try {
      const { searchParams } = new URL(request.url)
      const isUsed = searchParams.get('isUsed')
      const subscriptionType = searchParams.get('subscriptionType')
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const offset = (page - 1) * limit

      const where: any = {}
      if (isUsed !== null && isUsed !== undefined) {
        where.isUsed = isUsed === 'true'
      }
      if (subscriptionType) where.subscriptionType = subscriptionType

      const [vouchers, total] = await Promise.all([
        prisma.voucherCode.findMany({
          where,
          include: {
            creator: {
              select: {
                name: true,
                email: true
              }
            },
            usage: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.voucherCode.count({ where })
      ])

      return NextResponse.json({
        vouchers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      })

    } catch (error) {
      console.error('Admin vouchers fetch error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }

  // POST - Create new voucher code
  if (request.method === 'POST') {
    try {
      const body = await request.json()
      const { subscriptionType, count = 1, expiresInDays } = body

      if (!subscriptionType) {
        return NextResponse.json(
          { error: 'Subscription type is required' },
          { status: 400 }
        )
      }

      if (!Object.values(SubscriptionType).includes(subscriptionType)) {
        return NextResponse.json(
          { error: 'Invalid subscription type' },
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

      // Generate voucher codes
      const vouchers = []
      for (let i = 0; i < count; i++) {
        const code = generateVoucherCode(subscriptionType)
        
        const voucher = await prisma.voucherCode.create({
          data: {
            code,
            subscriptionType,
            expiresAt,
            createdBy: request.user!.userId
          }
        })
        
        vouchers.push(voucher)
      }

      return NextResponse.json({
        success: true,
        message: `${count} voucher code(s) created successfully`,
        vouchers
      })

    } catch (error) {
      console.error('Voucher creation error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

// Helper function to generate unique voucher codes
function generateVoucherCode(subscriptionType: SubscriptionType): string {
  const prefix = subscriptionType === SubscriptionType.annual ? 'MEDQ-Y' : 'MEDQ-S'
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${randomStr}`
}

export const GET = requireAuth(handler)
export const POST = requireAuth(handler)
