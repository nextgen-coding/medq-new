import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    // Check if user is admin
    if (request.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { paymentId } = await params;
    const body = await request.json();
    const { action, notes } = body;

    if (!['verify', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Find the payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Allow verification for awaiting_verification status, or pending status for konnect_gateway payments
    if (payment.status !== 'awaiting_verification' && !(payment.status === 'pending' && payment.method === 'konnect_gateway')) {
      return NextResponse.json({ error: 'Payment is not pending verification' }, { status: 400 });
    }

    if (action === 'verify') {
      // Approve the payment and activate subscription
      const subscriptionExpiry = payment.subscriptionType === 'annual' 
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 6 months

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: 'verified',
            verifiedBy: request.user?.userId,
            verifiedAt: new Date(),
            adminNotes: notes || null,
          }
        }),
        prisma.user.update({
          where: { id: payment.userId },
          data: {
            hasActiveSubscription: true,
            subscriptionExpiresAt: subscriptionExpiry,
          }
        })
      ]);

      return NextResponse.json({
        success: true,
        message: 'Payment verified and subscription activated'
      });
    } else {
      // Reject the payment
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'rejected',
          verifiedBy: request.user?.userId,
          verifiedAt: new Date(),
          adminNotes: notes || null,
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Payment rejected'
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = requireAuth(handler);
