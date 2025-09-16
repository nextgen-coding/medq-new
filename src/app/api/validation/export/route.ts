import { NextRequest, NextResponse } from 'next/server';
import { utils, write } from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = (body.mode as 'good'|'bad') || 'good';
    const good = Array.isArray(body.good) ? body.good : [];
    const bad = Array.isArray(body.bad) ? body.bad : [];
    const rows = mode === 'good' ? good : bad;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 400 });
    }

    const header = mode === 'good'
      ? ['sheet', 'row', 'matiere', 'cours', 'question n', 'cas n', 'texte du cas', 'texte de la question', 'reponse', 'option a', 'option b', 'option c', 'option d', 'option e', 'explication', 'explication a', 'explication b', 'explication c', 'explication d', 'explication e', 'image', 'niveau', 'semestre']
      : ['sheet', 'row', 'reason', 'matiere', 'cours', 'question n', 'cas n', 'texte du cas', 'texte de la question', 'reponse', 'option a', 'option b', 'option c', 'option d', 'option e', 'explication', 'image'];

    const dataObjects = rows.map((r: any) => {
      const rec = mode === 'good' ? r.data : r.original;
      const isCas = r.sheet === 'cas_qcm' || r.sheet === 'cas_qroc';
      const qTextRaw = String(rec?.['texte de la question'] ?? '').trim();
      const caseTextRaw = String(rec?.['texte du cas'] ?? '').trim();
      const qText = qTextRaw || (isCas ? caseTextRaw : '');
      const base: any = {
        sheet: r.sheet,
        row: r.row,
        ...(mode === 'good' ? {} : { reason: r.reason }),
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
        explication: rec?.['explication'] ?? '',
        'explication a': rec?.['explication a'] ?? '',
        'explication b': rec?.['explication b'] ?? '',
        'explication c': rec?.['explication c'] ?? '',
        'explication d': rec?.['explication d'] ?? '',
        'explication e': rec?.['explication e'] ?? '',
        image: rec?.['image'] ?? '',
      };
      if (mode === 'good') {
        base['niveau'] = rec?.['niveau'] ?? '';
        base['semestre'] = rec?.['semestre'] ?? '';
      }
      return base;
    });

    const wb = utils.book_new();
    const ws = utils.json_to_sheet(dataObjects, { header });
    utils.book_append_sheet(wb, ws, mode === 'good' ? 'Valide' : 'Erreurs');

    const arrayBuffer = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const bytes = new Uint8Array(arrayBuffer);

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="validation_${mode}.xlsx"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Export failed' }, { status: 500 });
  }
}
