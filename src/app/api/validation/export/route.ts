import { NextRequest, NextResponse } from 'next/server';
import { utils, write } from 'xlsx';

// Canonical import headers expected by /api/questions/bulk-import-progress
const IMPORT_HEADERS = [
  'matiere', 'cours', 'question n', 'cas n', 'source', 'texte du cas', 'texte de la question',
  'reponse', 'option a', 'option b', 'option c', 'option d', 'option e',
  'rappel', 'explication', 'explication a', 'explication b', 'explication c', 'explication d', 'explication e',
  'image', 'niveau', 'semestre'
] as const;

type SheetName = 'qcm' | 'qroc' | 'cas_qcm' | 'cas_qroc';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = (body.mode as 'good'|'bad') || 'good';
    const good = Array.isArray(body.good) ? body.good : [];
    const bad = Array.isArray(body.bad) ? body.bad : [];
    const originalName: string | undefined = typeof body.fileName === 'string' ? body.fileName : undefined;

    if (mode === 'good') {
      if (!Array.isArray(good) || good.length === 0) {
        return NextResponse.json({ error: 'No data to export' }, { status: 400 });
      }

      // Partition rows by target sheet
      const bySheet: Record<SheetName, any[]> = { qcm: [], qroc: [], cas_qcm: [], cas_qroc: [] };
      for (const r of good) {
        const rec = r.data || {};
        const sheet = (r.sheet as SheetName) || 'qcm';
        const isCas = sheet === 'cas_qcm' || sheet === 'cas_qroc';
        const qTextRaw = String(rec?.['texte de la question'] ?? '').trim();
        const caseTextRaw = String(rec?.['texte du cas'] ?? '').trim();
        const qText = qTextRaw || (isCas ? caseTextRaw : '');
        const base: Record<string, any> = {
          matiere: rec?.['matiere'] ?? '',
          cours: rec?.['cours'] ?? '',
          'question n': rec?.['question n'] ?? '',
          'cas n': rec?.['cas n'] ?? '',
          source: rec?.['source'] ?? '',
          'texte du cas': rec?.['texte du cas'] ?? '',
          'texte de la question': qText,
          reponse: rec?.['reponse'] ?? '',
          'option a': rec?.['option a'] ?? '',
          'option b': rec?.['option b'] ?? '',
          'option c': rec?.['option c'] ?? '',
          'option d': rec?.['option d'] ?? '',
          'option e': rec?.['option e'] ?? '',
          rappel: rec?.['rappel'] ?? '',
          explication: rec?.['explication'] ?? '',
          'explication a': rec?.['explication a'] ?? '',
          'explication b': rec?.['explication b'] ?? '',
          'explication c': rec?.['explication c'] ?? '',
          'explication d': rec?.['explication d'] ?? '',
          'explication e': rec?.['explication e'] ?? '',
          image: rec?.['image'] ?? '',
          niveau: rec?.['niveau'] ?? '',
          semestre: rec?.['semestre'] ?? ''
        };
        bySheet[sheet].push(base);
      }

      const wb = utils.book_new();
      // Only add sheets that have rows; import endpoint tolerates missing sheets
      (Object.keys(bySheet) as SheetName[]).forEach((sheet) => {
        const rows = bySheet[sheet];
        if (rows.length === 0) return;
        const ws = utils.json_to_sheet(rows, { header: [...IMPORT_HEADERS] as any });
        // Use canonical, import-friendly sheet names
        const sheetName = sheet; // already canonical: 'qcm' | 'qroc' | 'cas_qcm' | 'cas_qroc'
        utils.book_append_sheet(wb, ws, sheetName);
      });

      const arrayBuffer = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      const base = (originalName || '').replace(/\.[^.]+$/, '') || 'validation_good';
      const outName = `${base}-valide.xlsx`;
      return new NextResponse(bytes, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${outName}"`
        }
      });
    }

    // mode === 'bad' -> keep single-sheet error export (not import-ready by design)
    const rows = bad;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 400 });
    }
    const errorHeader = ['sheet', 'row', 'reason', 'matiere', 'cours', 'question n', 'cas n', 'texte du cas', 'texte de la question', 'reponse', 'option a', 'option b', 'option c', 'option d', 'option e', 'rappel', 'explication', 'image'];
    const errorObjects = rows.map((r: any) => {
      const rec = r.original || {};
      const isCas = r.sheet === 'cas_qcm' || r.sheet === 'cas_qroc';
      const qTextRaw = String(rec?.['texte de la question'] ?? '').trim();
      const caseTextRaw = String(rec?.['texte du cas'] ?? '').trim();
      const qText = qTextRaw || (isCas ? caseTextRaw : '');
      return {
        sheet: r.sheet,
        row: r.row,
        reason: r.reason,
        matiere: rec?.['matiere'] ?? '',
        cours: rec?.['cours'] ?? '',
        'question n': rec?.['question n'] ?? '',
        'cas n': rec?.['cas n'] ?? '',
        'texte du cas': rec?.['texte du cas'] ?? '',
        'texte de la question': qText,
        reponse: rec?.['reponse'] ?? '',
        'option a': rec?.['option a'] ?? '',
        'option b': rec?.['option b'] ?? '',
        'option c': rec?.['option c'] ?? '',
        'option d': rec?.['option d'] ?? '',
        'option e': rec?.['option e'] ?? '',
        rappel: rec?.['rappel'] ?? '',
        explication: rec?.['explication'] ?? '',
        image: rec?.['image'] ?? ''
      };
    });

    const wbErr = utils.book_new();
    const wsErr = utils.json_to_sheet(errorObjects, { header: errorHeader });
    utils.book_append_sheet(wbErr, wsErr, 'Erreurs');
    const arrayBuffer = write(wbErr, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const bytes = new Uint8Array(arrayBuffer);
    const base = (originalName || '').replace(/\.[^.]+$/, '') || 'validation_bad';
    const outName = `${base}-erreurs.xlsx`;
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${outName}"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Export failed' }, { status: 500 });
  }
}
