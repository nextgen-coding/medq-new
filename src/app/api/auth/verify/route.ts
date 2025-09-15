import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }
    
    // Find user with this verification token
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        status: 'pending'
      }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }
    
    // Update user status to verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'verified',
        emailVerified: new Date(),
        verificationToken: null // Clear the token
      }
    });
    
    return NextResponse.json({
      message: 'Email verified successfully! You can now log in to your account.'
    });
    
  } catch (error) {
    console.error('Error verifying email:', error);
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    );
  }
} 