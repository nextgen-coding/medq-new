import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
// import the correct function from '@/lib/email'
import { sendPasswordChangeVerificationEmail } from '@/lib/email';

async function handler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate a 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration time (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Delete any existing unused verification codes for this user
    await prisma.passwordChangeVerification.deleteMany({
      where: {
        userId: userId,
        used: false
      }
    });

    // Create new verification code
    await prisma.passwordChangeVerification.create({
      data: {
        userId: userId,
        code: code,
        expiresAt: expiresAt
      }
    });

    // Send verification email
    if (!user.email) {
      return NextResponse.json({
        error: 'User email not found'
      }, { status: 500 });
    }
    try {
      await sendPasswordChangeVerificationEmail(user.email, code);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      return NextResponse.json({
        error: 'Failed to send verification email. Please try again.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email'
    });

  } catch (error) {
    console.error('Error sending verification code:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export const POST = requireAuth(handler);
