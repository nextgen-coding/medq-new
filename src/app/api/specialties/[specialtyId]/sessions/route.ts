import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/specialties/[specialtyId]/sessions
export async function GET(
  request: Request,
  context: any
) {
  try {
    const url = new URL(request.url);
    const nameFallback = url.searchParams.get('name') || undefined;
    let id = (context?.params?.specialtyId || '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
    const uuidLike = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    console.log('[sessions route] Fetching sessions', { id, uuid: uuidLike.test(id), nameFallback });

    const includeObj = {
      niveau: { select: { id: true, name: true } },
      semester: { select: { id: true, name: true, order: true } },
      sessions: {
        include: {
          niveau: { select: { id: true, name: true } },
          semester: { select: { id: true, name: true, order: true } }
        },
        orderBy: { createdAt: 'desc' }
      }
    } as const;

    let specialty = uuidLike.test(id)
      ? await prisma.specialty.findUnique({ where: { id }, include: includeObj })
      : null;

    if (!specialty && nameFallback) {
      specialty = await prisma.specialty.findFirst({ where: { name: { equals: nameFallback, mode: 'insensitive' } }, include: includeObj });
      if (!specialty) {
        specialty = await prisma.specialty.findFirst({ where: { name: { contains: nameFallback, mode: 'insensitive' } }, include: includeObj });
      }
    }

    if (!specialty) {
      const sample = await prisma.specialty.findMany({ take: 5, select: { id: true, name: true } });
      const existsRaw = await prisma.specialty.findUnique({ where: { id }, select: { id: true, name: true } });
      const sessionsForId = await prisma.session.count({ where: { specialtyId: id } });
      return NextResponse.json({
        error: 'Specialty not found',
        requestedId: id,
        triedName: nameFallback,
        sample,
        existsRaw,
        sessionsForId,
        envDbUrlPresent: !!process.env.DATABASE_URL,
      }, { status: 404 });
    }

  // Provide icon fallback without mutating original object
  return NextResponse.json({ ...specialty, icon: specialty.icon || 'default_icon.png' });
  } catch (error) {
    console.error('Error fetching specialty sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch specialty sessions' }, { status: 500 });
  }
}
