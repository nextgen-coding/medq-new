import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { generateToken, generateExpiryDate } from '@/lib/tokens';

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
        message: 'Si un compte avec cet e-mail existe, un lien de réinitialisation du mot de passe a été envoyé.'
      });
    }
    
    // Generate password reset token
    const resetToken = generateToken();
    const resetExpiry = generateExpiryDate(1); // 1 hour expiry
    
    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpiry
      }
    });
    
    // Send password reset email
    try {
      await sendPasswordResetEmail(email, resetToken, user.name || undefined);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      return NextResponse.json(
        { error: 'Échec de l\'envoi de l\'e-mail de réinitialisation du mot de passe' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: 'Si un compte avec cet e-mail existe, un lien de réinitialisation du mot de passe a été envoyé.'
    });
    
  } catch (error) {
    console.error('Error processing forgot password request:', error);
    return NextResponse.json(
      { error: 'Échec du traitement de la demande' },
      { status: 500 }
    );
  }
} 