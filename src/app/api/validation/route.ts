import { NextRequest, NextResponse } from 'next/server';
import { read, utils, write } from 'xlsx';

type SheetName = 'qcm' | 'qroc' | 'cas_qcm' | 'cas_qroc';
type GoodRow = { sheet: SheetName; row: number; data: Record<string, any> };
type BadRow = { sheet: SheetName; row: number; reason: string; original: Record<string, any> };

// Normalize sheet names to match aliases
function normalizeSheet(name: string): string {
  return String(name || '').toLowerCase().replace(/[-_\s]+/g, ' ').trim();
}

// Canonicalize header names to expected keys
function canonicalizeHeader(header: string): string {
  const h = String(header || '').toLowerCase().trim();
  if (h.includes('texte') && h.includes('question')) return 'texte de la question';
  if (h.includes('texte') && h.includes('cas')) return 'texte du cas';
  if (h.includes('option') && h.includes('a')) return 'option a';
  if (h.includes('option') && h.includes('b')) return 'option b';
  if (h.includes('option') && h.includes('c')) return 'option c';
  if (h.includes('option') && h.includes('d')) return 'option d';
  if (h.includes('option') && h.includes('e')) return 'option e';
  if (h.includes('explication') && h.includes('a')) return 'explication a';
  if (h.includes('explication') && h.includes('b')) return 'explication b';
  if (h.includes('explication') && h.includes('c')) return 'explication c';
  if (h.includes('explication') && h.includes('d')) return 'explication d';
  if (h.includes('explication') && h.includes('e')) return 'explication e';
  if (h.includes('matiere')) return 'matiere';
  if (h.includes('cours')) return 'cours';
  if (h.includes('reponse')) return 'reponse';
  if (h.includes('explication')) return 'explication';
  if (h.includes('niveau')) return 'niveau';
  if (h.includes('semestre')) return 'semestre';
  if (h.includes('image')) return 'image';
  if (h.includes('cas') && h.includes('n')) return 'cas n';
  if (h.includes('question') && h.includes('n')) return 'question n';
  return h;
}

function parseMCQOptions(record: Record<string, any>): { options: string[]; correctAnswers: number[] } {
  const options: string[] = [];
  const letters = ['a', 'b', 'c', 'd', 'e'];
  for (const l of letters) {
    const key = `option ${l}`;
    const v = record[key];
    const s = v == null ? '' : String(v).trim();
    if (s) options.push(s);
  }
  const rawAns = String(record['reponse'] || '').trim();
  const correctAnswers: number[] = [];
  if (rawAns) {
    for (const part of rawAns.toUpperCase().split(/[;,\s]+/).filter(Boolean)) {
      const ch = part.trim()[0];
      if (ch && ch >= 'A' && ch <= 'E') {
        const idx = ch.charCodeAt(0) - 65;
        if (idx >= 0 && idx < options.length) correctAnswers.push(idx);
      }
    }
  }
  return { options, correctAnswers };
}

function hasAnyExplanation(record: Record<string, any>): boolean {
  if (String(record['explication'] || '').trim()) return true;
  for (const l of ['a', 'b', 'c', 'd', 'e']) {
    if (String(record[`explication ${l}`] || '').trim()) return true;
  }
  return false;
}

function dedupKey(record: Record<string, any>): string {
  const keys = ['matiere', 'cours', 'texte de la question', 'reponse', 'option a', 'option b', 'option c', 'option d', 'option e'];
  return keys.map((k) => String(record[k] ?? '')).join('|');
}

async function validateWorkbook(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer);

  const foundSheets = Object.keys(workbook.Sheets);
  const present = new Map<string, string>();
  for (const name of foundSheets) present.set(normalizeSheet(name), name);

  const aliases: Record<SheetName, string[]> = {
    qcm: ['qcm', 'mcq'],
    qroc: ['qroc'],
    cas_qcm: ['cas qcm', 'cas-qcm', 'cas_qcm', 'cas clinique qcm'],
    cas_qroc: ['cas qroc', 'cas-qroc', 'cas_qroc', 'cas clinique qroc'],
  };

  const good: GoodRow[] = [];
  const bad: BadRow[] = [];

  let recognizedAny = false;
  for (const sheet of Object.keys(aliases) as SheetName[]) {
    let actualName: string | undefined;
    for (const alias of aliases[sheet]) {
      const norm = normalizeSheet(alias);
      if (present.has(norm)) {
        actualName = present.get(norm)!;
        break;
      }
    }
    if (!actualName) continue;
    recognizedAny = true;

    const ws = workbook.Sheets[actualName];
    const rows = utils.sheet_to_json(ws, { header: 1 });
    if (!Array.isArray(rows) || rows.length < 2) continue;

    const headerRaw = (rows[0] as any[]).map((h) => String(h ?? ''));
    const header = headerRaw.map(canonicalizeHeader);

    const seen = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const raw = rows[i] as any[];
      if (!raw || raw.length === 0) continue;

      const record: Record<string, any> = {};
      header.forEach((h, idx) => (record[h] = String(raw[idx] ?? '').trim()));

      const baseQuestionText = sheet.includes('cas')
        ? record['texte de la question'] || record['texte de question'] || record['texte du cas']
        : record['texte de la question'] || record['texte de question'];

      if (!record['matiere'] || !record['cours'] || !baseQuestionText) {
        bad.push({ sheet, row: i + 1, reason: 'Missing core fields (matiere/cours/question)', original: record });
        continue;
      }

      if (sheet === 'qcm' || sheet === 'cas_qcm') {
        const { options, correctAnswers } = parseMCQOptions(record);
        if (options.length === 0) {
          bad.push({ sheet, row: i + 1, reason: 'MCQ requires at least one option', original: record });
          continue;
        }
        if (correctAnswers.length === 0) {
          bad.push({ sheet, row: i + 1, reason: 'MCQ missing correct answers (A–E)', original: record });
          continue;
        }
        if (!hasAnyExplanation(record)) {
          bad.push({ sheet, row: i + 1, reason: 'MCQ missing explanation', original: record });
          continue;
        }
      }

      if (sheet === 'qroc' || sheet === 'cas_qroc') {
        if (!String(record['reponse'] || '').trim()) {
          bad.push({ sheet, row: i + 1, reason: 'QROC missing reponse', original: record });
          continue;
        }
        if (!String(record['explication'] || '').trim()) {
          bad.push({ sheet, row: i + 1, reason: 'QROC missing explication', original: record });
          continue;
        }
      }

      const key = dedupKey(record);
      if (seen.has(key)) {
        bad.push({ sheet, row: i + 1, reason: 'Duplicate row in same sheet', original: record });
        continue;
      }
      seen.add(key);

      good.push({ sheet, row: i + 1, data: record });
    }
  }

  if (!recognizedAny) {
    throw new Error(`Aucun onglet reconnu. Renommez vos onglets en: "qcm", "qroc", "cas qcm" ou "cas qroc". Feuilles trouvées: ${foundSheets.join(', ')}`);
  }
  if (good.length === 0 && bad.length === 0) {
    throw new Error("Feuilles reconnues mais sans lignes sous l'en-tête. Ajoutez des questions puis réessayez.");
  }

  return { good, bad };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const { good, bad } = await validateWorkbook(file);
    return NextResponse.json({ good, bad, goodCount: good.length, badCount: bad.length });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Validation failed' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get('mode') as 'good' | 'bad') || 'good';
    const payload = searchParams.get('payload');
    if (!payload) return NextResponse.json({ error: 'Missing payload' }, { status: 400 });

    const { good, bad } = JSON.parse(decodeURIComponent(payload));
    const rows = mode === 'good' ? good : bad;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 400 });
    }

    const header = mode === 'good'
      ? ['sheet', 'row', 'matiere', 'cours', 'question n', 'cas n', 'texte du cas', 'texte de la question', 'reponse', 'option a', 'option b', 'option c', 'option d', 'option e', 'explication', 'explication a', 'explication b', 'explication c', 'explication d', 'explication e', 'image', 'niveau', 'semestre']
      : ['sheet', 'row', 'reason', 'matiere', 'cours', 'question n', 'cas n', 'texte du cas', 'texte de la question', 'reponse', 'option a', 'option b', 'option c', 'option d', 'option e', 'explication', 'image'];

    const dataObjects = rows.map((r: any) => {
      const rec = mode === 'good' ? r.data : r.original;
      const base: any = {
        sheet: r.sheet,
        row: r.row,
        ...(mode === 'good' ? {} : { reason: r.reason }),
        matiere: rec?.['matiere'] ?? '',
        cours: rec?.['cours'] ?? '',
        'question n': rec?.['question n'] ?? '',
        'cas n': rec?.['cas n'] ?? '',
        'texte du cas': rec?.['texte du cas'] ?? '',
        'texte de la question': rec?.['texte de la question'] ?? '',
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

    // Use ArrayBuffer to be compatible with edge runtimes
    const arrayBuffer = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const bytes = new Uint8Array(arrayBuffer);

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="validation_${mode}.xlsx"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Download failed' }, { status: 500 });
  }
}