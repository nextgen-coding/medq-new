import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { sendVerificationEmail } from '../../../../lib/email';
import { generateToken } from '../../../../lib/tokens';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'L\'e-mail est requis' },
        { status: 400 }
      );
    }
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        message: 'Si un compte avec cet e-mail existe, un e-mail de vérification a été envoyé.'
      });
    }
    
    // Check if user is already verified
    if (user.status === 'verified') {
      return NextResponse.json({
        message: 'Cet e-mail est déjà vérifié. Vous pouvez vous connecter normalement.'
      });
    }
    
    // Generate new verification token
    const verificationToken = generateToken();
    
    // Update user with new verification token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken
      }
    });
    
    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken, user.name || undefined);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      return NextResponse.json(
        { error: 'Échec de l\'envoi de l\'e-mail de vérification' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: 'Si un compte avec cet e-mail existe, un e-mail de vérification a été envoyé.'
    });
    
  } catch (error) {
    console.error('Error processing resend verification request:', error);
    return NextResponse.json(
      { error: 'Échec du traitement de la demande' },
      { status: 500 }
    );
  }
} 