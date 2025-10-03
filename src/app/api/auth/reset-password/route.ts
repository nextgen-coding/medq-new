import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { isTokenExpired } from '../../../../lib/tokens';
import { validatePassword } from '../../../../lib/password-validation';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();
    
    if (!token || !password) {
      return NextResponse.json(
        { error: 'Le jeton et le nouveau mot de passe sont requis' },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 }
      );
    }
    
    // Find user with this reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          not: null
        }
      }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Jeton de réinitialisation invalide ou expiré' },
        { status: 400 }
      );
    }
    
    // Check if token is expired
    if (user.passwordResetExpires && isTokenExpired(user.passwordResetExpires)) {
      return NextResponse.json(
        { error: 'Le jeton de réinitialisation a expiré' },
        { status: 400 }
      );
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        passwordUpdatedAt: new Date()
      }
    });
    
    return NextResponse.json({
      message: 'Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.'
    });
    
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Échec de la réinitialisation du mot de passe' },
      { status: 500 }
    );
  }
} 