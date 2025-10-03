import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Le jeton de vérification est requis' },
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
        { error: 'Jeton de vérification invalide ou expiré' },
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
      message: 'E-mail vérifié avec succès ! Vous pouvez maintenant vous connecter à votre compte.'
    });
    
  } catch (error) {
    console.error('Error verifying email:', error);
    return NextResponse.json(
      { error: 'Échec de la vérification de l\'e-mail' },
      { status: 500 }
    );
  }
} 