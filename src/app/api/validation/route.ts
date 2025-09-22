import { NextRequest, NextResponse } from 'next/server';
import { read, utils, write } from 'xlsx';
import { storeValidationFiles, getValidationFiles } from '@/lib/validation-file-store';

type SheetName = 'qcm' | 'qroc' | 'cas_qcm' | 'cas_qroc';
type GoodRow = { sheet: SheetName; row: number; data: Record<string, any> };
type BadRow = { sheet: SheetName; row: number; reason: string; original: Record<string, any> };

// Normalize sheet names to match aliases
function normalizeSheet(name: string): string {
  return String(name || '').toLowerCase().replace(/[-_\s]+/g, ' ').trim();
}

// Canonicalize header names using the same mapping as the import endpoint
const normalizeHeader = (h: string): string =>
  String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^\w\s]/g, ' ') // punctuation to spaces
    .replace(/\s+/g, ' ') // collapse
    .trim();

const headerAliases: Record<string, string> = {
  'matiere': 'matiere',
  'cours': 'cours',
  'question n': 'question n',
  'question no': 'question n',
  'question n°': 'question n',
  'source': 'source',
  'texte de la question': 'texte de la question',
  'texte question': 'texte de la question',
  'texte de question': 'texte de la question',
  'texte du cas': 'texte du cas',
  'texte cas': 'texte du cas',
  'option a': 'option a',
  'option b': 'option b',
  'option c': 'option c',
  'option d': 'option d',
  'option e': 'option e',
  'reponse': 'reponse',
  'reponse(s)': 'reponse',
  'cas n': 'cas n',
  'cas no': 'cas n',
  'cas n°': 'cas n',
  'explication': 'explication',
  'explication de la reponse': 'explication',
  'explication de la réponse': 'explication',
  'explication reponse': 'explication',
  'explanation': 'explication',
  'correction': 'explication',
  'explication a': 'explication a',
  'explication b': 'explication b',
  'explication c': 'explication c',
  'explication d': 'explication d',
  'explication e': 'explication e',
  'explication A': 'explication a',
  'explication B': 'explication b',
  'explication C': 'explication c',
  'explication D': 'explication d',
  'explication E': 'explication e',
  'niveau': 'niveau',
  'level': 'niveau',
  'semestre': 'semestre',
  'semester': 'semestre',
  'rappel': 'rappel',
  'rappel du cours': 'rappel',
  'rappel cours': 'rappel',
  'course reminder': 'rappel',
  'rappel_cours': 'rappel',
  'image': 'image',
  'image url': 'image',
  'image_url': 'image',
  'media': 'image',
  'media url': 'image',
  'media_url': 'image',
  'illustration': 'image',
  'illustration url': 'image'
};

function canonicalizeHeader(header: string): string {
  const n = normalizeHeader(header);
  return headerAliases[n] ?? n;
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

      // Accept AI-generated rows that may omit 'cours' by falling back to 'matiere'
      if (!record['cours'] && record['matiere']) {
        record['cours'] = record['matiere'];
      }

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
        // Per-option explanations are REQUIRED for each present option (A–E)
        // If missing, but a global 'explication' or 'rappel' exists, auto-fill to pass validation.
        const missing: string[] = [];
        const letters = ['a','b','c','d','e'];
        for (let li = 0; li < Math.min(letters.length, options.length); li++) {
          const key = `explication ${letters[li]}`;
          const exp = String(record[key] || '').trim();
          if (!exp) missing.push(letters[li].toUpperCase());
        }
        if (missing.length > 0) {
          const fallback = String(record['explication'] || record['rappel'] || '').trim();
          if (fallback) {
            for (let li = 0; li < Math.min(letters.length, options.length); li++) {
              const key = `explication ${letters[li]}`;
              if (!String(record[key] || '').trim()) record[key] = fallback;
            }
          } else {
            bad.push({ sheet, row: i + 1, reason: `Missing per-option explanations: ${missing.join(', ')}` , original: record });
            continue;
          }
        }
      }

      if (sheet === 'qroc' || sheet === 'cas_qroc') {
        if (!String(record['reponse'] || '').trim()) {
          bad.push({ sheet, row: i + 1, reason: 'QROC missing reponse', original: record });
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

    // Pre-generate and store downloadable files to avoid massive URL payloads
    // Build import-ready workbook for good rows: 4 sheets with canonical headers
    const IMPORT_HEADERS = [
      'matiere', 'cours', 'question n', 'cas n', 'texte du cas', 'texte de la question',
      'reponse', 'option a', 'option b', 'option c', 'option d', 'option e',
      'rappel', 'explication', 'explication a', 'explication b', 'explication c', 'explication d', 'explication e',
      'image', 'niveau', 'semestre'
    ];

    const bySheet: Record<SheetName, any[]> = { qcm: [], qroc: [], cas_qcm: [], cas_qroc: [] };
    for (const r of good) {
      const rec = r.data || {};
      const sheet = (r.sheet as SheetName) || 'qcm';
      const isCas = sheet === 'cas_qcm' || sheet === 'cas_qroc';
      const qTextRaw = String(rec?.['texte de la question'] ?? '').trim();
      const caseTextRaw = String(rec?.['texte du cas'] ?? '').trim();
      const qText = qTextRaw || (isCas ? caseTextRaw : '');
      const mat = String(rec?.['matiere'] ?? '').trim();
      const coursVal = String(rec?.['cours'] ?? '').trim() || mat;
      bySheet[sheet].push({
        matiere: mat,
        cours: coursVal,
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
        'explication a': rec?.['explication a'] ?? '',
        'explication b': rec?.['explication b'] ?? '',
        'explication c': rec?.['explication c'] ?? '',
        'explication d': rec?.['explication d'] ?? '',
        'explication e': rec?.['explication e'] ?? '',
        image: rec?.['image'] ?? '',
        niveau: rec?.['niveau'] ?? '',
        semestre: rec?.['semestre'] ?? ''
      });
    }

    const wbGood = utils.book_new();
    (Object.keys(bySheet) as SheetName[]).forEach((sn) => {
      const rows = bySheet[sn];
      if (rows.length === 0) return;
      const ws = utils.json_to_sheet(rows, { header: IMPORT_HEADERS });
      utils.book_append_sheet(wbGood, ws, sn);
    });
    const bufGood = write(wbGood, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    // Build error workbook (single sheet)
    const errorHeader = ['sheet', 'row', 'reason', 'matiere', 'cours', 'question n', 'cas n', 'texte du cas', 'texte de la question', 'reponse', 'option a', 'option b', 'option c', 'option d', 'option e', 'rappel', 'explication', 'image'];
    const errRows = bad.map((r: any) => {
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
    const wsErr = utils.json_to_sheet(errRows, { header: errorHeader });
    utils.book_append_sheet(wbErr, wsErr, 'Erreurs');
    const bufErr = write(wbErr, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const sessionId = `val_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
    // Convert ArrayBuffer to Node Buffer for in-memory store
    const goodFileBuffer = Buffer.from(new Uint8Array(bufGood));
    const errorFileBuffer = Buffer.from(new Uint8Array(bufErr));
    const reportBuffer = Buffer.from([]); // reserved for future summary report
    storeValidationFiles(sessionId, { goodFileBuffer, errorFileBuffer, reportBuffer, fileName: file.name });

    return NextResponse.json({ good, bad, goodCount: good.length, badCount: bad.length, sessionId, fileName: file.name });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Validation failed' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get('mode') as 'good' | 'bad') || 'good';
    const sessionId = searchParams.get('sessionId');

    // Prefer session-based buffers (safer than large payload URLs)
    if (sessionId) {
      const files = getValidationFiles(sessionId);
      if (!files) return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
      const buffer = mode === 'good' ? files.goodFileBuffer : files.errorFileBuffer;
      const bytes = new Uint8Array(buffer);
      return new NextResponse(bytes, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="validation_${mode}.xlsx"`,
        },
      });
    }

    // Backward-compatibility: payload param
    const payload = searchParams.get('payload');
    if (!payload) return NextResponse.json({ error: 'Missing payload or sessionId' }, { status: 400 });
    const { good, bad } = JSON.parse(decodeURIComponent(payload));
    const rows = mode === 'good' ? good : bad;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 400 });
    }

    const header = mode === 'good'
      ? ['sheet', 'row', 'matiere', 'cours', 'question n', 'cas n', 'texte du cas', 'texte de la question', 'reponse', 'option a', 'option b', 'option c', 'option d', 'option e', 'rappel', 'explication', 'explication a', 'explication b', 'explication c', 'explication d', 'explication e', 'image', 'niveau', 'semestre']
      : ['sheet', 'row', 'reason', 'matiere', 'cours', 'question n', 'cas n', 'texte du cas', 'texte de la question', 'reponse', 'option a', 'option b', 'option c', 'option d', 'option e', 'rappel', 'explication', 'image'];

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
        rappel: rec?.['rappel'] ?? '',
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
    return NextResponse.json({ error: error?.message || 'Download failed' }, { status: 500 });
  }
}