import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMaintainerOrAdmin, requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

// Normalize Google Drive share links (file/d/<id>/..., open?id=<id>, uc?export=download) to direct download form.
// Leave non-drive or already-direct .pdf links unchanged.
function normalizeDriveLink(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const url = raw.trim();
  if (!url) return undefined;
  // Already a plain PDF (could be remote) -> keep
  if (/\.pdf($|[?#])/i.test(url)) return url;
  // Already normalized direct download
  if (/drive\.google\.com\/uc\?export=download&id=/i.test(url)) return url;
  // Match typical file patterns
  const fileMatch = url.match(/https?:\/\/drive\.google\.com\/file\/d\/([^/]+)\//i);
  const openMatch = url.match(/https?:\/\/drive\.google\.com\/open\?id=([^&]+)/i);
  const ucMatch = url.match(/https?:\/\/drive\.google\.com\/uc\?id=([^&]+)/i); // some variants use uc?id=
  const id = fileMatch?.[1] || openMatch?.[1] || ucMatch?.[1];
  if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  return url; // fallback unchanged
}

async function getHandler(request: AuthenticatedRequest) {
  const url = new URL(request.url);
  const semesterParam = url.searchParams.get('semester'); // 'none' | <semesterId>
  const items = await (prisma as any).session.findMany({
    where: {
      ...(request.user?.role !== 'admin' && request.user?.userId
        ? await (async () => {
            const user = await prisma.user.findUnique({ where: { id: request.user!.userId }, select: { niveauId: true } });
            return user?.niveauId ? { niveauId: user.niveauId } : {};
          })()
        : {}),
      ...(semesterParam
        ? semesterParam === 'none'
          ? { semesterId: null }
          : { semesterId: semesterParam }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      pdfUrl: true,
      correctionUrl: true,
      niveauId: true,
      semesterId: true,
      createdAt: true,
      niveau: { select: { id: true, name: true } },
      semester: { select: { id: true, name: true, order: true } },
      specialty: { select: { id: true, name: true } }
    }
  });
  return NextResponse.json(items);
}

async function postHandler(request: AuthenticatedRequest) {
  const body = await request.json();
  const {
    name,
    pdfUrl,
    correctionUrl,
    niveauId: bodyNiveauId,
    niveauName,
    semesterId: bodySemesterId,
    semester,
    specialtyId: bodySpecialtyId,
    specialtyName
  } = body as {
    name: string;
    pdfUrl?: string;
    correctionUrl?: string;
    niveauId?: string;
    niveauName?: string;
    semesterId?: string;
    semester?: string | number; // e.g., 'S1', '1', 1
    specialtyId?: string;
    specialtyName?: string;
  };

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  // Resolve niveau
  let niveauId: string | undefined = bodyNiveauId || undefined;
  if (!niveauId && niveauName) {
    const niv = await prisma.niveau.findFirst({ where: { name: { equals: niveauName, mode: 'insensitive' } } });
    if (!niv) return NextResponse.json({ error: `Niveau '${niveauName}' not found` }, { status: 400 });
    niveauId = niv.id;
  }

  // Resolve semester under niveau when provided
  let semesterId: string | undefined = bodySemesterId || undefined;
  if (!semesterId && semester != null && niveauId) {
    const sStr = String(semester).toUpperCase();
    const order = /2/.test(sStr) || /S2/.test(sStr) ? 2 : /1/.test(sStr) || /S1/.test(sStr) ? 1 : parseInt(sStr, 10);
    if (Number.isFinite(order)) {
      const sem = await prisma.semester.findFirst({ where: { niveauId, order: order as number } });
      if (!sem) return NextResponse.json({ error: `Semester 'S${order}' not found for niveau` }, { status: 400 });
      semesterId = sem.id;
    }
  }

  // Resolve specialty (by id or by name and optionally link to niveau/semester)
  let specialtyId: string | undefined = bodySpecialtyId || undefined;
  if (!specialtyId && specialtyName) {
    let spec = await prisma.specialty.findFirst({ where: { name: { equals: specialtyName, mode: 'insensitive' } } });
    if (!spec) {
      // Create specialty if it doesn't exist
      spec = await prisma.specialty.create({
        data: {
          name: specialtyName,
          ...(niveauId ? { niveauId } : {}),
          ...(semesterId ? { semesterId } : {})
        }
      });
    } else {
      // Link missing niveau/semester if not set
      const updates: any = {};
      if (niveauId && !spec.niveauId) updates.niveauId = niveauId;
      if (semesterId && !spec.semesterId) updates.semesterId = semesterId;
      if (Object.keys(updates).length > 0) {
        spec = await prisma.specialty.update({ where: { id: spec.id }, data: updates });
      }
    }
    specialtyId = spec.id;
  }

  // Server-side normalization ensures stored links are always direct
  const created = await (prisma as any).session.create({
    data: {
      name,
      pdfUrl: normalizeDriveLink(pdfUrl),
      correctionUrl: normalizeDriveLink(correctionUrl),
      niveauId,
      semesterId,
      specialtyId
    }
  });
  return NextResponse.json(created, { status: 201 });
}

export const GET = requireAuth(getHandler);
export const POST = requireMaintainerOrAdmin(async (req: AuthenticatedRequest) => {
  // Enforce niveau constraints for maintainers
  const { user } = req;
  const body = await req.json();
  if (user?.role === 'maintainer') {
    // Fetch maintainer niveau
    const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { niveauId: true } });
    if (!u?.niveauId) return NextResponse.json({ error: 'Maintainer niveau not set' }, { status: 400 });
    // Force niveauId to maintainer's niveau
    body.niveauId = u.niveauId;
  }
  // Reconstruct a Request-like object for the existing handler
  const fakeReq = new Request(req.url, { method: req.method, headers: req.headers, body: JSON.stringify(body) }) as any as AuthenticatedRequest;
  (fakeReq as any).user = user;
  return postHandler(fakeReq);
});
