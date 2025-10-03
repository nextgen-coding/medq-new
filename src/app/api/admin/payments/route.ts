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
      const status = searchParams.get('status')
      const method = searchParams.get('method')
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const offset = (page - 1) * limit

      const where: any = {}
      if (status) where.status = status
      if (method) where.method = method

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true
              }
            },
            voucherCode: {
              select: {
                code: true
              }
            },
            verifier: {
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
        prisma.payment.count({ where })
      ])

      return NextResponse.json({
        payments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      })

    } catch (error) {
      console.error('Admin payments fetch error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }

  // PATCH - Verify/reject custom payment
  if (request.method === 'PATCH') {
    try {
      const body = await request.json()
      const { paymentId, action, adminNotes } = body

      if (!paymentId || !action) {
        return NextResponse.json(
          { error: 'Payment ID and action are required' },
          { status: 400 }
        )
      }

      if (!['verify', 'reject'].includes(action)) {
        return NextResponse.json(
          { error: 'Invalid action. Must be "verify" or "reject"' },
          { status: 400 }
        )
      }

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { user: true }
      })

      if (!payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }

      if (payment.method !== 'custom_payment') {
        return NextResponse.json(
          { error: 'Only custom payments can be verified' },
          { status: 400 }
        )
      }

      await prisma.$transaction(async (tx) => {
        // Update payment status
        const newStatus = action === 'verify' ? 'verified' : 'rejected'
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: newStatus,
            verifiedBy: request.user!.userId,
            verifiedAt: new Date(),
            adminNotes
          }
        })

        // If verified, activate user subscription
        if (action === 'verify') {
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
        }
      })

      return NextResponse.json({
        success: true,
        message: `Payment ${action === 'verify' ? 'verified' : 'rejected'} successfully`
      })

    } catch (error) {
      console.error('Payment verification error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export const GET = requireAuth(handler)
export const PATCH = requireAuth(handler)
