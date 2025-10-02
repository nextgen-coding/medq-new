import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { sendActivationKeyEmail } from '@/lib/email';

// Generate activation key
const generateActivationKey = (subscriptionType: 'semester' | 'annual') => {
  const prefix = subscriptionType === 'annual' ? 'MEDQ-Y' : 'MEDQ-S';
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${randomStr}`;
};

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
      // Generate activation key
      const activationKey = generateActivationKey(payment.subscriptionType);

      // Create voucher code record
      const voucherCode = await prisma.voucherCode.create({
        data: {
          code: activationKey,
          subscriptionType: payment.subscriptionType,
          createdBy: request.user?.userId,
        }
      });

      // Update payment status to verified and store the activation key
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'verified',
          verifiedBy: request.user?.userId,
          verifiedAt: new Date(),
          activationKey: activationKey,
          adminNotes: notes ? `${notes}\nClé d'activation générée: ${activationKey}` : `Clé d'activation générée: ${activationKey}`,
        }
      });

      // Send activation key email to user
      try {
        await sendActivationKeyEmail(
          payment.user.email,
          activationKey,
          payment.amount,
          payment.currency,
          payment.subscriptionType,
          payment.user.name || undefined
        );
        console.log('Activation key email sent successfully to:', payment.user.email);
      } catch (emailError) {
        console.error('Failed to send activation key email:', emailError);
        // Continue even if email fails - admin can resend manually
      }

      return NextResponse.json({
        success: true,
        message: 'Payment verified. Activation key generated and sent to user.',
        activationKey: activationKey
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
