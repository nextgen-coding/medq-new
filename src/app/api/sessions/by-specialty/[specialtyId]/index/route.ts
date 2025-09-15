import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

export const GET = requireAdmin(async (
  request: AuthenticatedRequest,
  context: any
) => {
  try {
    const specialtyId = context?.params?.specialtyId as string | undefined;

    if (!specialtyId) {
      return NextResponse.json({ error: 'ID de spécialité requis' }, { status: 400 });
    }

    // Get all sessions for this specialty
    const sessions = await prisma.session.findMany({
      where: { specialtyId: specialtyId },
      include: {
        specialty: { select: { id: true, name: true } },
        niveau: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true, order: true } }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(sessions);

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
});
