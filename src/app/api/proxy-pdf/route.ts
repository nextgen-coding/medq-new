import { NextRequest, NextResponse } from 'next/server';

// GET /api/proxy-pdf?url=<encoded>
// Server-side fetch to bypass browser CORS blocks for Google Drive direct links.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
  }
  try {
    // Basic allowlist: only proxy Google Drive or https pdf links
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }
    const isDrive = /drive\.google\.com/.test(url);
    if (!isDrive && !/\.pdf($|[?#])/i.test(url)) {
      return NextResponse.json({ error: 'Only PDF or Google Drive resources allowed' }, { status: 400 });
    }

    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream error ${resp.status}` }, { status: resp.status });
    }
    const contentType = resp.headers.get('content-type') || 'application/pdf';
    const arrayBuffer = await resp.arrayBuffer();
    const headers = new Headers({
      'Content-Type': contentType.includes('pdf') ? contentType : 'application/pdf',
      'Cache-Control': 'private, max-age=60',
      'Access-Control-Allow-Origin': '*'
    });
    return new NextResponse(arrayBuffer, { status: 200, headers });
  } catch (e: any) {
    console.error('PDF proxy error', e);
    return NextResponse.json({ error: 'Proxy failure' }, { status: 502 });
  }
}
