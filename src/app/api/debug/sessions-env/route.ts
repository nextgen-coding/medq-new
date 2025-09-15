import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper to safely expose DB url parts (mask credentials)
function redactDb(url?: string) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      protocol: u.protocol.replace(':',''),
      host: u.hostname,
      port: u.port || null,
      database: u.pathname.replace(/^\//,'') || null,
      user: u.username || null
    };
  } catch {
    return { raw: 'unparseable' } as any;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id')?.trim();
  const name = url.searchParams.get('name')?.trim();
  const diagnostics: any = { at: new Date().toISOString() };
  try {
    diagnostics.env = redactDb(process.env.DATABASE_URL);
    diagnostics.counts = {
      specialties: await prisma.specialty.count(),
      sessions: await prisma.session.count(),
      niveaux: await prisma.niveau.count()
    };
    diagnostics.sampleSpecialties = await prisma.specialty.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true }
    });
    if (id) {
      diagnostics.byId = await prisma.specialty.findUnique({
        where: { id },
        select: { id: true, name: true, createdAt: true }
      });
      diagnostics.sessionsForId = await prisma.session.findMany({
        where: { specialtyId: id },
        select: { id: true, name: true }
      });
    }
    if (name) {
      diagnostics.byExactName = await prisma.specialty.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true, name: true }
      });
      diagnostics.byContainsName = await prisma.specialty.findMany({
        where: { name: { contains: name, mode: 'insensitive' } },
        take: 5,
        select: { id: true, name: true }
      });
    }
    return NextResponse.json(diagnostics);
  } catch (e:any) {
    return NextResponse.json({ error: 'debug failed', message: e.message, diagnostics }, { status: 500 });
  }
}
