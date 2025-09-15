import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

async function getHandler(request: AuthenticatedRequest) {
  const url = new URL(request.url);
  const niveauIdParam = url.searchParams.get('niveauId');

  // If the caller is a student, constrain to their niveau by default
  let effectiveNiveauId: string | undefined = niveauIdParam || undefined;
  if (request.user?.role !== 'admin') {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      select: { niveauId: true }
    });
    if (user?.niveauId) effectiveNiveauId = user.niveauId;
  }

  const items = await prisma.semester.findMany({
    where: effectiveNiveauId ? { niveauId: effectiveNiveauId } : undefined,
    orderBy: [{ niveau: { order: 'asc' } }, { order: 'asc' }],
    select: { id: true, name: true, order: true, niveauId: true, niveau: { select: { id: true, name: true, order: true } } }
  });
  return NextResponse.json(items);
}

export const GET = requireAuth(getHandler);
