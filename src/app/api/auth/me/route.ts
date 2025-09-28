import { NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '../../../../lib/auth-middleware';
import { prisma } from '../../../../lib/prisma';

async function handler(request: AuthenticatedRequest) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.user?.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        password: true,
        passwordUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
        // Profile fields
        sexe: true,
        niveauId: true,
        semesterId: true,
        faculty: true,
        profileCompleted: true,
        highlightColor: true,
        showSelfAssessment: true,
        phone: true,
        // Subscription fields
        hasActiveSubscription: true,
        subscriptionExpiresAt: true,
        // Google ID
        google_id: true,
        niveau: {
          select: {
            id: true,
            name: true,
            order: true,
          }
        },
        semester: {
          select: {
            id: true,
            name: true,
            order: true,
            niveauId: true,
          }
        }
      }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(handler); 