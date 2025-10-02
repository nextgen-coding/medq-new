import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';

async function handler(request: AuthenticatedRequest) {
  // Check if user is admin
  if (request.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const {
        userId,
        method,
        subscriptionType,
        voucherCode,
        customPaymentDetails,
        proofImageUrl,
        adminCreated = false,
        isBuyingKey = false
      } = body;

      // Validate required fields
      if (!userId || !method || !subscriptionType) {
        return NextResponse.json(
          { error: 'Champs requis manquants' },
          { status: 400 }
        );
      }

      // Validate method-specific requirements
      if (method === 'voucher_code' && !voucherCode) {
        return NextResponse.json(
          { error: 'Clé d\'activation requise' },
          { status: 400 }
        );
      }

      if (method === 'custom_payment' && (!customPaymentDetails || !proofImageUrl)) {
        return NextResponse.json(
          { error: 'Détails et preuve de paiement requis pour les paiements personnalisés' },
          { status: 400 }
        );
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return NextResponse.json(
          { error: 'Utilisateur non trouvé' },
          { status: 404 }
        );
      }

      // Calculate amount based on subscription type
      const amount = subscriptionType === 'annual' ? 90 : 50; // TND
      const currency = 'TND';

      let payment: any = null;
      let finalStatus: string = 'pending';
      let voucherRecord: any = null;

      await prisma.$transaction(async (tx) => {
        // Handle voucher validation if method is voucher_code
        if (method === 'voucher_code') {
          const voucher = await tx.voucherCode.findFirst({
            where: {
              code: voucherCode,
              isUsed: false,
              expiresAt: {
                gt: new Date()
              }
            }
          });

          if (!voucher) {
            throw new Error('Clé d\'activation invalide ou expirée');
          }

          // Mark voucher as used
          await tx.voucherCode.update({
            where: { id: voucher.id },
            data: {
              isUsed: true,
              usedAt: new Date()
            }
          });

          voucherRecord = voucher;
          finalStatus = 'completed'; // Voucher payments are automatically completed
        } else if (method === 'custom_payment') {
          finalStatus = 'awaiting_verification'; // Custom payments need verification
        } else {
          finalStatus = 'completed'; // Konnect payments created by admin are considered completed
        }

        // Create payment record
        payment = await tx.payment.create({
          data: {
            userId,
            amount,
            currency,
            method,
            status: finalStatus as PaymentStatus,
            subscriptionType,
            isBuyingKey,
            customPaymentDetails: method === 'custom_payment' ? customPaymentDetails : undefined,
            proofImageUrl: method === 'custom_payment' ? proofImageUrl : undefined,
            voucherCodeId: voucherRecord?.id,
            adminNotes: adminCreated ? `Créé par l'admin ${request.user!.email}` : undefined
          }
        });

        // If payment is completed (voucher or konnect), activate subscription
        if (finalStatus === 'completed') {
          const expiresAt = subscriptionType === 'annual'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
            : new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000); // 6 months

          await tx.user.update({
            where: { id: userId },
            data: {
              hasActiveSubscription: true,
              subscriptionExpiresAt: expiresAt
            }
          });
        }
      });

      return NextResponse.json({
        success: true,
        payment: {
          id: payment!.id,
          status: payment!.status,
          method: payment!.method,
          amount: payment!.amount,
          subscriptionType: payment!.subscriptionType
        },
        message: finalStatus === 'completed' 
          ? 'Paiement créé et abonnement activé avec succès'
          : finalStatus === 'awaiting_verification'
          ? 'Paiement créé, en attente de vérification'
          : 'Paiement créé avec succès'
      });

    } catch (error) {
      console.error('Error creating admin payment:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Erreur interne du serveur' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export const POST = requireAuth(handler);
