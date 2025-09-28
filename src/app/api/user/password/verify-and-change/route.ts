import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validatePassword } from '@/lib/password-validation';

async function handler(request: AuthenticatedRequest) {
  try {
    const { code, newPassword } = await request.json();
    const userId = request.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!code || !newPassword) {
      return NextResponse.json({
        error: 'Code and new password are required'
      }, { status: 400 });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return NextResponse.json({
        error: passwordValidation.errors[0]
      }, { status: 400 });
    }

    // Find the verification code
    const verification = await prisma.passwordChangeVerification.findFirst({
      where: {
        userId: userId,
        code: code,
        used: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!verification) {
      return NextResponse.json({
        error: 'Invalid or expired verification code'
      }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password and mark verification as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          passwordUpdatedAt: new Date()
        }
      }),
      prisma.passwordChangeVerification.update({
        where: { id: verification.id },
        data: { used: true }
      })
    ]);

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Error verifying code and changing password:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export const POST = requireAuth(handler);
