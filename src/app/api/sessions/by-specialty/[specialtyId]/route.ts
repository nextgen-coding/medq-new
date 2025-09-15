import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

export const DELETE = requireAdmin(async (
  request: AuthenticatedRequest,
  context: any
) => {
  try {
    const specialtyId = context?.params?.specialtyId as string | undefined;

    if (!specialtyId) {
      return NextResponse.json({ error: 'ID de spécialité requis' }, { status: 400 });
    }

    // Check if specialty exists
    const specialty = await prisma.specialty.findUnique({
      where: { id: specialtyId },
    });

    if (!specialty) {
      return NextResponse.json({ error: 'Spécialité non trouvée' }, { status: 404 });
    }

    // Delete all sessions for this specialty
    const deletedSessions = await prisma.session.deleteMany({
      where: { specialtyId: specialtyId },
    });

    return NextResponse.json({
      message: `${deletedSessions.count} session(s) supprimée(s) pour la spécialité ${specialty.name}`,
      deletedCount: deletedSessions.count,
    });

  } catch (error) {
    console.error('Error deleting sessions:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
});
