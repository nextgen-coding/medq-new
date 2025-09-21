import { NextResponse } from 'next/server';
import { read, utils } from 'xlsx';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import type { Prisma } from '@prisma/client';
// Images: we keep links as-is in the text; no upload/rehost is performed.

// Store active imports with their progress
type ImportStats = {
  total: number;
  imported: number;
  failed: number;
  createdSpecialties: number;
  createdLectures: number;
  questionsWithImages: number;
  createdCases: number;
  errors?: string[];
};

type Phase = 'validating' | 'importing' | 'complete';

type ImportSession = {
  progress: number;
  phase: Phase;
  message: string;
  logs: string[];
  stats?: ImportStats;
  lastUpdated: number;
  createdAt: number;
  cancelled?: boolean;
};

const activeImports = new Map<string, ImportSession>();

// Periodic cleanup (keep sessions for 30 minutes after completion)
const SESSION_TTL_MS = 30 * 60 * 1000;
const CLEAN_INTERVAL_MS = 5 * 60 * 1000;
if (!(global as any).__bulkImportCleanerStarted) {
  (global as any).__bulkImportCleanerStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, sess] of activeImports.entries()) {
      const isComplete = sess.phase === 'complete' || sess.cancelled;
      if (isComplete && now - sess.lastUpdated > SESSION_TTL_MS) {
        activeImports.delete(id);
      }
    }
  }, CLEAN_INTERVAL_MS).unref?.();
}

// --- Header normalization helpers ---
const normalizeHeader = (h: string): string =>
  String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^\w\s]/g, ' ') // punctuation to spaces
    .replace(/\s+/g, ' ') // collapse
    .trim();

const headerAliases: Record<string, string> = {
  // canonical keys
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
  // optional columns
  'explication': 'explication',
  'explication de la reponse': 'explication',
  'explication de la réponse': 'explication',
  'explication reponse': 'explication',
  'explanation': 'explication',
  'correction': 'explication',
  // per-option explanations (map directly, we'll inspect later)
  'explication a': 'explication a',
  'explication b': 'explication b',
  'explication c': 'explication c',
  'explication d': 'explication d',
  'explication e': 'explication e',
  // sometimes with option letter capitalized
  'explication A': 'explication a',
  'explication B': 'explication b',
  'explication C': 'explication c',
  'explication D': 'explication d',
  'explication E': 'explication e',
  'niveau': 'niveau',
  'level': 'niveau',
  'semestre': 'semestre',
  'semester': 'semestre',
  // course reminder (rappel) columns
  'rappel': 'rappel',
  'rappel du cours': 'rappel',
  'rappel cours': 'rappel',
  'course reminder': 'rappel',
  'rappel_cours': 'rappel',
  // explicit media/image columns
  'image': 'image',
  'image url': 'image',
  'image_url': 'image',
  'media': 'image',
  'media url': 'image',
  'media_url': 'image',
  'illustration': 'image',
  'illustration url': 'image'
};

const canonicalizeHeader = (h: string): string => {
  const n = normalizeHeader(h);
  return headerAliases[n] ?? n;
};

// All-or-nothing toggle (default ON). Set ALL_OR_NOTHING_IMPORT=0 to revert to row-by-row inserts.
const ALL_OR_NOTHING = process.env.ALL_OR_NOTHING_IMPORT !== '0';

// Strict specialty (matiere) sanitizer: keep letters/digits/spaces, drop symbols, collapse spaces
function sanitizeSpecialtyName(input: string): string {
  const s = String(input || '')
    .normalize('NFC')
    // Keep latin letters with accents + digits + spaces
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

// Deprecated: we no longer extract/remove image URLs from text.
// Images embedded as URLs remain in the question text and will be rendered on the frontend.

// Function to parse MCQ options from canonicalized Excel row
function parseMCQOptions(rowData: Record<string, unknown>): { options: string[], correctAnswers: string[] } {
  const options: string[] = [];
  const correctAnswers: string[] = [];
  
  // Check for options a through e (canonical lower-case)
  for (let i = 0; i < 5; i++) {
    const optionKey = `option ${String.fromCharCode(97 + i)}`; // a, b, c, d, e
    const optionValue = rowData[optionKey];
    if (optionValue && typeof optionValue === 'string' && optionValue.trim()) {
      options.push(optionValue.trim());
    } else if (optionValue && typeof optionValue !== 'string') {
      // Convert non-string values to string
      const stringValue = String(optionValue).trim();
      if (stringValue) {
        options.push(stringValue);
      }
    }
  }
  
  // Parse correct answer (e.g., "A, C, E" or "A" or "A,C,E")
  if (rowData['reponse']) {
    const answerStr = String(rowData['reponse']).toUpperCase();
    const answers = answerStr.split(/[;,\s]+/).filter((a: string) => a.trim());
    
    answers.forEach((answer: string) => {
      const index = answer.charCodeAt(0) - 65; // Convert A=0, B=1, etc.
      if (index >= 0 && index < options.length) {
        correctAnswers.push(index.toString());
      }
    });
  }
  
  return { options, correctAnswers };
}

// Build combined explanation merging global and per-option explanation columns
function buildCombinedExplanation(rowData: Record<string, string>): string | undefined {
  const base = rowData['explication'] ? String(rowData['explication']).trim() : '';
  const perOption: string[] = [];
  const letters = ['a','b','c','d','e'];
  letters.forEach((l, idx) => {
    const key = `explication ${l}`; // already canonicalised
    const val = rowData[key];
    if (val) {
      const clean = String(val).trim();
      if (clean) perOption.push(`(${l.toUpperCase()}) ${clean}`);
    }
  });
  if (!base && perOption.length === 0) return undefined;
  if (perOption.length === 0) return base || undefined;
  let combined = base ? base + '\n\n' : '';
  combined += 'Explications:\n' + perOption.join('\n');
  return combined;
}

// Function to update progress for an import session
function updateProgress(importId: string, progress: number, message: string, log?: string, phase?: Phase) {
  const current = activeImports.get(importId);
  if (!current) return; // session might have been cleaned/cancelled
  activeImports.set(importId, {
    ...current,
    progress,
    message,
    phase: phase ?? current.phase,
    logs: log ? [...current.logs, log] : current.logs,
    lastUpdated: Date.now()
  });
}

// Tunables for large imports (env-overridable)
const TX_MAX_WAIT = Number(process.env.IMPORT_TX_MAX_WAIT_MS ?? 20_000);
const TX_TIMEOUT = Number(process.env.IMPORT_TX_TIMEOUT_MS ?? 180_000);
const CREATE_MANY_CHUNK = Number(process.env.IMPORT_CREATE_MANY_CHUNK ?? 1_000);
const DUP_TEXT_CHUNK = Number(process.env.IMPORT_DUP_TEXT_CHUNK ?? 500);

// Small utility to chunk an array
function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function processFile(file: File, importId: string) {
  try {
  updateProgress(importId, 5, 'Reading Excel file...', undefined, 'validating');
    
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer);
    
    const importStats = {
      total: 0,
      imported: 0,
      failed: 0,
      createdSpecialties: 0,
      createdLectures: 0,
      questionsWithImages: 0,
      createdCases: 0,
      errors: [] as string[]
    };

    // Preload caches (read-only) for validation phase; creations happen later inside a transaction
    const niveauxCache = new Map<string, { id: string; name: string }>();
    const semestersCache = new Map<string, { id: string; name: string; order: number; niveauId: string }>();
    const allNiveaux = await prisma.niveau.findMany();
    for (const n of allNiveaux) {
      niveauxCache.set(n.name.toLowerCase(), { id: n.id, name: n.name });
      niveauxCache.set(n.name.replace(/\s+/g, '').toLowerCase(), { id: n.id, name: n.name });
      // Also map compact uppercase
      niveauxCache.set(n.name.replace(/\s+/g, '').toUpperCase(), { id: n.id, name: n.name });
    }
    const allSemesters = await prisma.semester.findMany();
    for (const s of allSemesters) {
      const keyByName = `${s.niveauId}:${s.name.toLowerCase()}`;
      const keyByOrder = `${s.niveauId}:order:${s.order}`;
      semestersCache.set(keyByName, { id: s.id, name: s.name, order: s.order, niveauId: s.niveauId });
      semestersCache.set(keyByOrder, { id: s.id, name: s.name, order: s.order, niveauId: s.niveauId });
    }

    const normalizeNiveauName = (raw?: string | null) => {
      if (!raw) return '';
      const s = String(raw).trim();
      if (!s) return '';
      const compact = s.replace(/\s+/g, '').toUpperCase();
      const m = compact.match(/^(PCEM|DCEM)(\d)$/i);
      if (m) return `${m[1].toUpperCase()}${m[2]}`;
      return s.toUpperCase();
    };

    const parseSemesterOrder = (raw?: string | null): number | null => {
      if (!raw) return null;
      const s = String(raw).toUpperCase();
      if (/(^|\W)S?1(\W|$)/.test(s)) return 1;
      if (/(^|\W)S?2(\W|$)/.test(s)) return 2;
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    };

    // Types for planned insertions (validation-first, then one-shot transaction)
    type PlannedQuestion = {
      sheetName: 'qcm' | 'qroc' | 'cas_qcm' | 'cas_qroc';
      specialtyName: string; // sanitized
      lectureTitle: string;
      niveauName?: string | null; // normalized (e.g., PCEM1, DCEM2)
      semesterOrder?: number | null;
      questionText: string;
      hasInlineImage: boolean;
      questionData: {
        type: string;
        text: string;
        options?: any[] | null;
        correctAnswers: string[];
        courseReminder?: string | null;
        number?: number | null;
        session?: string | null;
        mediaUrl?: string | null;
        mediaType?: string | null;
        caseNumber?: number | null;
        caseText?: string | null;
        caseQuestionNumber?: number | null;
      }
    };

    // Accumulators for validation and planning
    const plannedRows: PlannedQuestion[] = [];
    const plannedCases = new Set<string>(); // key: specialty|lecture|caseNumber
    const specialtyNamesSet = new Set<string>();
    const lectureTitlesBySpecialty = new Map<string, Set<string>>(); // specialty -> titles
    const niveauxToEnsure = new Set<string>(); // PCEM1, DCEM2...
    const semestersToEnsure = new Set<string>(); // key: niveauName|order
    let inlineImageCount = 0;

    // Process each sheet
    const sheets = ['qcm', 'qroc', 'cas_qcm', 'cas_qroc'] as const;

    // Build a map of canonical sheet names to actual sheet names present in the workbook,
    // accepting common variants like hyphens, spaces, or clinic phrasing
    const normalizeSheet = (name: string) =>
      String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const sheetAliases: Record<(typeof sheets)[number], string[]> = {
      qcm: ['qcm', 'questions qcm'],
      qroc: ['qroc', 'croq', 'questions qroc', 'questions croq'],
      cas_qcm: ['cas qcm', 'cas-qcm', 'cas_qcm', 'cas clinique qcm', 'cas clinic qcm'],
      cas_qroc: ['cas qroc', 'cas-qroc', 'cas_qroc', 'cas clinique qroc', 'cas clinic qroc', 'cas croq', 'cas clinic croq']
    };

    const presentMap = new Map<string, string>(); // normalized -> actual
    for (const actual of Object.keys(workbook.Sheets)) {
      presentMap.set(normalizeSheet(actual), actual);
    }

    const canonicalToActual = new Map<string, string>();
    for (const key of sheets) {
      const variants = sheetAliases[key];
      for (const v of variants) {
        const norm = normalizeSheet(v);
        const actual = presentMap.get(norm);
        if (actual) {
          canonicalToActual.set(key, actual);
          break;
        }
      }
    }
    
    for (const sheetName of sheets) {
      const session = activeImports.get(importId);
      if (!session || session.cancelled) break; // cancellation check
      const actualName = canonicalToActual.get(sheetName);
      if (!actualName || !workbook.Sheets[actualName]) {
        updateProgress(importId, 10, `Sheet '${sheetName}' not found, skipping...`);
        continue;
      }

      updateProgress(importId, 15, `Processing sheet: ${sheetName}...`, undefined, 'importing');
      
  const sheet = workbook.Sheets[actualName];
  const jsonData = utils.sheet_to_json(sheet, { header: 1 });
      
      if (jsonData.length < 2) {
        updateProgress(importId, 20, `Sheet '${sheetName}' is empty, skipping...`);
        continue;
      }

  // Canonicalize headers
  const rawHeader = (jsonData[0] as string[]).map(h => String(h ?? ''));
  const header = rawHeader.map(canonicalizeHeader);

  // Skip header row and filter out completely empty rows so they are never counted or logged
  const rawRows = jsonData.slice(1);
  const dataRows = rawRows.filter((row) => Array.isArray(row) && (row as unknown[]).some(cell => String(cell ?? '').trim() !== ''));
    importStats.total += dataRows.length;

  updateProgress(importId, 25, `Found ${dataRows.length} rows in ${sheetName}...`);

  // Track last seen specialty and course to forward-fill missing cells
  let lastSpecialtyName: string = '';
  let lastLectureTitle: string = '';

  // Process each row
      for (let i = 0; i < dataRows.length; i++) {
        const sessionLoop = activeImports.get(importId);
        if (!sessionLoop || sessionLoop.cancelled) break; // cancellation check
        const row = dataRows[i];
  const progress = 25 + (i / dataRows.length) * 60;
        updateProgress(importId, progress, `Processing row ${i + 1} in ${sheetName}...`);

        try {
          // Build rowData with canonical headers
          const rowData: Record<string, string> = {};
          header.forEach((h, idx) => {
            rowData[h] = String((row as unknown[])[idx] ?? '').trim();
          });
          // Empty rows already filtered out above. No logging or counting for them.

          // Build basic fields with forward-fill: use last seen values if cells are empty
          let specialtyName = rowData['matiere'] || lastSpecialtyName;
          if (specialtyName) {
            specialtyName = sanitizeSpecialtyName(specialtyName);
          }
          let lectureTitle = rowData['cours'] || lastLectureTitle;
          if (rowData['matiere']) lastSpecialtyName = sanitizeSpecialtyName(rowData['matiere']);
          if (rowData['cours']) lastLectureTitle = rowData['cours'];

          // Determine question text (keep any image URLs inline inside the text)
          // Note: headers are canonicalized, and 'texte de question' maps to 'texte de la question'
          let questionText = rowData['texte de la question'] || '';
          // Fallback for cas_*: use case text when question text is empty
          if ((sheetName === 'cas_qcm' || sheetName === 'cas_qroc') && !questionText) {
            questionText = rowData['texte du cas'] || '';
          }
          const imageUrlRegex = /(https?:\/\/[^\s)]+?\.(?:jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico))(?:[)\s.,;:!?]|$)/i;
          const hasInlineImage = imageUrlRegex.test(questionText);

          if (!specialtyName || !lectureTitle) {
            throw new Error('Missing specialty or lecture information');
          }
          // Allow questions that consist only of an image URL
          if (!questionText || questionText.trim().length === 0) {
            if (!hasInlineImage) {
              throw new Error('Missing question text');
            }
          }

          // Resolve optional niveau/semestre
          const niveauRaw = rowData['niveau'] || '';
          const semestreRaw = rowData['semestre'] || '';
          let niveauId: string | null = null;
          let semesterId: string | null = null;
          if (niveauRaw) {
            const normalized = normalizeNiveauName(niveauRaw);
            const found = Array.from(niveauxCache.values()).find(n => n.name.toUpperCase() === normalized);
            if (found) {
              niveauId = found.id;
            } else {
              // Plan to create niveau later inside transaction
              niveauxToEnsure.add(normalized);
            }
          }

          if (niveauId && semestreRaw) {
            const order = parseSemesterOrder(semestreRaw);
            if (order) {
              const keyByOrder = `${niveauId}:order:${order}`;
              let sem = semestersCache.get(keyByOrder);
              if (!sem) {
                // Plan to create semester later inside transaction (will need niveau name too)
                const nvName = Array.from(niveauxCache.values()).find(n => n.id === niveauId)?.name || null;
                if (nvName) {
                  semestersToEnsure.add(`${nvName}|${order}`);
                }
              }
              // (no per-sheet branching here)
            }
          }

          // Collect names/titles to lookup/create later
          specialtyNamesSet.add(specialtyName);
          if (!lectureTitlesBySpecialty.has(specialtyName)) lectureTitlesBySpecialty.set(specialtyName, new Set());
          lectureTitlesBySpecialty.get(specialtyName)!.add(lectureTitle);

          // Handle clinical cases
          let caseNumber = null;
          let caseText = null;
          let caseQuestionNumber = null;

          if (sheetName === 'cas_qcm' || sheetName === 'cas_qroc') {
            caseNumber = parseInt(rowData['cas n']) || null;
            caseText = rowData['texte du cas'] || null;
            caseQuestionNumber = parseInt(rowData['question n']) || null;

            // Only count created cases when clinical is enabled (DCEM)
            const isPreclinical = ((): boolean => {
              const nvRaw = rowData['niveau'] || '';
              const norm = nvRaw ? normalizeNiveauName(nvRaw) : '';
              return /^PCEM\s*1$/i.test(norm) || /^PCEM\s*2$/i.test(norm) || /^PCEM[12]$/i.test(norm);
            })();

            if (!isPreclinical && caseNumber && caseText) {
              // Track unique planned cases for stats only (creation occurs implicitly with question insert)
              const caseKey = `${specialtyName}|${lectureTitle}|${caseNumber}`;
              if (!plannedCases.has(caseKey)) {
                plannedCases.add(caseKey);
              }
            }
          }

          // We no longer extract image URLs from text; keep them inline and let frontend render.
          // Count presence of inline image for stats only.
          let hostedUrl: string | null = null;
          let hostedType: string | null = null;
          if (hasInlineImage) {
            inlineImageCount++;
            updateProgress(importId, progress, `Found inline image link in text`, `🖼️ Inline image URL detected in question text`);
          }

          // Prepare question data based on sheet type
          type MutableQuestionData = {
            lectureId: string;
            text: string;
            courseReminder: string | null;
            number: number | null;
            session?: string | null;
            mediaUrl?: string | null;
            mediaType?: string | null;
            type?: string;
            options?: any[] | null;
            correctAnswers?: string[];
            caseNumber?: number | null;
            caseText?: string | null;
            caseQuestionNumber?: number | null;
          };

          let questionData: MutableQuestionData = {
            lectureId: 'PENDING', // resolved later
            text: questionText,
            courseReminder: null,
            number: Number.isFinite(parseInt(rowData['question n'])) ? parseInt(rowData['question n']) : null,
            session: rowData['source'] || null,
            mediaUrl: hostedUrl,
            mediaType: hostedType
          };

          // Inject course reminder (rappel) if provided
          if (rowData['rappel']) {
            const rappelVal = String(rowData['rappel']).trim();
            if (rappelVal) {
              questionData.courseReminder = rappelVal;
            }
          }

          // If no media extracted from text and an explicit image column exists, use it
          if (!hasInlineImage && !questionData.mediaUrl && rowData['image']) {
            const rawImg = String(rowData['image']).trim();
            if (rawImg) {
              questionData.mediaUrl = rawImg;
              const isImage = /\.(png|jpe?g|gif|webp|svg|bmp|tiff|ico)(\?.*)?$/i.test(rawImg) || rawImg.startsWith('http') || rawImg.startsWith('data:image/');
              questionData.mediaType = isImage ? 'image' : (questionData.mediaType || null);
              hostedUrl = questionData.mediaUrl; // keep for stats increment below
              hostedType = questionData.mediaType || null;
              importStats.questionsWithImages++;
              updateProgress(importId, progress, 'Attached image column to question', `🖼️ Image column used: ${rawImg.substring(0,80)}`);
            }
          }

          // Set question type and specific fields
          switch (sheetName) {
            case 'qcm': {
              const { options, correctAnswers } = parseMCQOptions(rowData);
              questionData.type = 'mcq';
              // Build options as objects with per-option explanations if available
              {
                const letters = ['a','b','c','d','e'];
                const opts = options.map((text, idx) => {
                  const expKey = `explication ${letters[idx]}`;
                  const exp = rowData[expKey] ? String(rowData[expKey]).trim() : '';
                  return {
                    id: String(idx),
                    text,
                    ...(exp ? { explanation: exp } : {})
                  };
                });
                questionData.options = opts;
              }
              questionData.correctAnswers = correctAnswers;
              if (!options || options.length === 0) throw new Error('MCQ missing options');
              if (!correctAnswers || correctAnswers.length === 0) throw new Error('MCQ missing correct answers');
              break;
            }

            case 'qroc': {
              // Open question (QROC): text + single correct answer string; rappel handled via courseReminder
              questionData.type = 'qroc';
              {
                const ans = String(rowData['reponse'] || '').trim();
                if (!ans) throw new Error('QROC missing answer');
                questionData.correctAnswers = [ans];
              }
              // No options for QROC
              questionData.options = null;
              break;
            }

            case 'cas_qcm': {
              const casQcmOptions = parseMCQOptions(rowData);
              // Niveau-aware normalization: in PCEM 1/2, persist as base MCQ (no clinical type)
              const isPreclinical = ((): boolean => {
                const nvRaw = rowData['niveau'] || '';
                const norm = nvRaw ? normalizeNiveauName(nvRaw) : '';
                return /^PCEM\s*1$/i.test(norm) || /^PCEM\s*2$/i.test(norm) || /^PCEM[12]$/i.test(norm);
              })();
              questionData.type = isPreclinical ? 'mcq' : 'clinic_mcq';
              // Build options as objects with per-option explanations if available
              {
                const letters = ['a','b','c','d','e'];
                const opts = casQcmOptions.options.map((text: string, idx: number) => {
                  const expKey = `explication ${letters[idx]}`;
                  const exp = rowData[expKey] ? String(rowData[expKey]).trim() : '';
                  return {
                    id: String(idx),
                    text,
                    ...(exp ? { explanation: exp } : {})
                  };
                });
                questionData.options = opts;
              }
              questionData.correctAnswers = casQcmOptions.correctAnswers;
              questionData.caseNumber = caseNumber;
              questionData.caseText = caseText;
              questionData.caseQuestionNumber = caseQuestionNumber;
              if (!casQcmOptions.options || casQcmOptions.options.length === 0) throw new Error('Clinical MCQ missing options');
              if (!casQcmOptions.correctAnswers || casQcmOptions.correctAnswers.length === 0) throw new Error('Clinical MCQ missing correct answers');
              break;
            }

            case 'cas_qroc': {
              // Niveau-aware normalization: in PCEM 1/2, persist as base QROC (no clinical type)
              const isPreclinical = ((): boolean => {
                const nvRaw = rowData['niveau'] || '';
                const norm = nvRaw ? normalizeNiveauName(nvRaw) : '';
                return /^PCEM\s*1$/i.test(norm) || /^PCEM\s*2$/i.test(norm) || /^PCEM[12]$/i.test(norm);
              })();
              questionData.type = isPreclinical ? 'qroc' : 'clinic_croq';
              {
                const ans = String(rowData['reponse'] || '').trim();
                if (!ans) throw new Error('Clinical QROC missing answer');
                questionData.correctAnswers = [ans];
              }
              questionData.caseNumber = caseNumber;
              questionData.caseText = caseText;
              questionData.caseQuestionNumber = caseQuestionNumber;
              break;
            }
          }

          if (!questionData.type || !questionData.correctAnswers || questionData.correctAnswers.length === 0) {
            throw new Error('Invalid question data: missing type or correct answers');
          }
          // Plan the question for transactional insert
          plannedRows.push({
            sheetName,
            specialtyName,
            lectureTitle,
            niveauName: (rowData['niveau'] ? normalizeNiveauName(rowData['niveau']) : null) || null,
            semesterOrder: parseSemesterOrder(rowData['semestre'] || ''),
            questionText,
            hasInlineImage,
            questionData: {
              type: questionData.type!,
              text: questionData.text,
              options: questionData.options ?? null,
              correctAnswers: questionData.correctAnswers,
              courseReminder: questionData.courseReminder ?? null,
              number: questionData.number ?? null,
              session: questionData.session ?? null,
              mediaUrl: questionData.mediaUrl ?? null,
              mediaType: questionData.mediaType ?? null,
              caseNumber: questionData.caseNumber ?? null,
              caseText: questionData.caseText ?? null,
              caseQuestionNumber: questionData.caseQuestionNumber ?? null
            }
          });
          updateProgress(importId, progress, `Validated row ${i + 1}`, `✅ Valid row: ${questionText.substring(0, 50)}...`);

        } catch (error) {
          importStats.failed++;
          const errorMsg = `Row ${i + 1} in ${sheetName}: ${(error as Error).message}`;
          updateProgress(importId, progress, `Error in row ${i + 1}`, `❌ ${errorMsg}`);
          importStats.errors.push(errorMsg);
          console.error(`Error processing row ${i + 1} in ${sheetName}:`, error);
        }

        // Yield every 25 rows to avoid blocking event loop (helpful on serverless and prevents watchdog timeouts)
        if (i > 0 && i % 25 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }

    // Early exit if any row-level validation errors
    if (importStats.errors.length > 0) {
      updateProgress(importId, 60, 'Validation failed. No data was imported.', `❌ Validation failed with ${importStats.errors.length} error(s). Aborting import.`, 'complete');
      const sess = activeImports.get(importId);
      if (sess) {
        activeImports.set(importId, { ...sess, stats: { ...importStats }, progress: 100, phase: 'complete', message: 'Validation failed' });
      }
      return;
    }

    // File-level duplicate detection (within uploaded file)
    updateProgress(importId, 62, 'Checking duplicates within the file...');
    const fileDupKey = (p: PlannedQuestion) => {
      const ca = (p.questionData.correctAnswers || []).join('|');
      return [p.specialtyName, p.lectureTitle, p.questionData.type, p.questionData.text.trim(), ca, p.questionData.number ?? '', p.questionData.session ?? '', p.questionData.courseReminder ?? ''].join('||');
    };
    const seenFile = new Map<string, number>();
    plannedRows.forEach((p, idx) => {
      const key = fileDupKey(p);
      if (seenFile.has(key)) {
        importStats.errors!.push(`Duplicate in file — row ${idx + 1} identical to row ${seenFile.get(key)! + 1}`);
      } else {
        seenFile.set(key, idx);
      }
    });

    if (importStats.errors!.length > 0) {
      updateProgress(importId, 65, 'Duplicate check failed in file', `❌ Found ${importStats.errors.length} duplicate(s) in file`, 'complete');
      const sess = activeImports.get(importId);
      if (sess) {
        activeImports.set(importId, { ...sess, stats: { ...importStats, failed: importStats.errors.length }, progress: 100, phase: 'complete', message: 'Duplicate check failed' });
      }
      return;
    }

  // DB duplicate detection for existing lectures
  updateProgress(importId, 70, 'Checking duplicates in database...');
  // 1) Resolve existing specialties/lectures
    const specialtyList = Array.from(specialtyNamesSet);
    const titlesBySpec: Record<string, string[]> = {};
    for (const [spec, titlesSet] of lectureTitlesBySpecialty.entries()) {
      titlesBySpec[spec] = Array.from(titlesSet);
    }
    const existingLectures = await prisma.lecture.findMany({
      where: {
        title: { in: Array.from(new Set(Object.values(titlesBySpec).flat())) },
        specialty: { name: { in: specialtyList } }
      },
      include: { specialty: true }
    });
    const lectureIdBySpecTitle = new Map<string, string>(); // key: spec|title -> id
    for (const lec of existingLectures) {
      lectureIdBySpecTitle.set(`${lec.specialty.name}|${lec.title}`, lec.id);
    }

    // 2) For lectures that already exist, batch fetch candidate questions to compare
    const byLectureIdTexts = new Map<string, Set<string>>();
    plannedRows.forEach(p => {
      const k = `${p.specialtyName}|${p.lectureTitle}`;
      const lecId = lectureIdBySpecTitle.get(k);
      if (lecId) {
        if (!byLectureIdTexts.has(lecId)) byLectureIdTexts.set(lecId, new Set());
        byLectureIdTexts.get(lecId)!.add(p.questionData.text);
      }
    });
    const lectureIds = Array.from(byLectureIdTexts.keys());
    let existingCandidates: Array<{
      id: string; lectureId: string; type: string; text: string; correctAnswers: any; courseReminder: string | null; number: number | null; session: string | null; caseNumber: number | null; caseText: string | null; caseQuestionNumber: number | null;
    }> = [];
    // Batch per lecture to avoid huge IN lists and leverage potential index on (lectureId, text)
    for (const lecId of lectureIds) {
      const texts = Array.from(byLectureIdTexts.get(lecId) || []);
      if (!texts.length) continue;
      for (const textChunk of chunkArray(texts, DUP_TEXT_CHUNK)) {
        const partial = await prisma.question.findMany({
          where: { lectureId: lecId, text: { in: textChunk } },
          select: { id: true, lectureId: true, type: true, text: true, correctAnswers: true, courseReminder: true, number: true, session: true, caseNumber: true, caseText: true, caseQuestionNumber: true }
        });
        if (partial.length) existingCandidates.push(...partial);
      }
    }
    const eqArr = (a?: any[] | null, b?: any[] | null) => {
      const aa = Array.isArray(a) ? a.map(x => String(x)) : [];
      const bb = Array.isArray(b) ? b.map(x => String(x)) : [];
      if (aa.length !== bb.length) return false;
      for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
      return true;
    };
    const s = (x?: string | null) => String(x ?? '').trim();
    for (let i = 0; i < plannedRows.length; i++) {
      const p = plannedRows[i];
      const lecId = lectureIdBySpecTitle.get(`${p.specialtyName}|${p.lectureTitle}`);
      if (!lecId) continue; // lecture will be created => cannot be duplicate in DB yet
      const candidates = existingCandidates.filter(c => c.lectureId === lecId && s(c.text) === s(p.questionData.text));
      const dup = candidates.find(c => c.type === p.questionData.type && eqArr(c.correctAnswers as any, p.questionData.correctAnswers) && ((c.number ?? null) === (p.questionData.number ?? null)) && s(c.session) === s(p.questionData.session) && s(c.courseReminder) === s(p.questionData.courseReminder) && (c.caseNumber ?? null) === (p.questionData.caseNumber ?? null) && s(c.caseText) === s(p.questionData.caseText) && (c.caseQuestionNumber ?? null) === (p.questionData.caseQuestionNumber ?? null));
      if (dup) {
        importStats.errors!.push(`Row ${i + 1} in ${p.sheetName}: Duplicate in database — identical question already exists`);
      }
    }

    if (importStats.errors!.length > 0) {
      updateProgress(importId, 75, 'Duplicate check failed against database', `❌ Found ${importStats.errors.length} duplicate(s)`, 'complete');
      const sess = activeImports.get(importId);
      if (sess) {
        activeImports.set(importId, { ...sess, stats: { ...importStats, failed: importStats.errors.length }, progress: 100, phase: 'complete', message: 'Duplicate check failed' });
      }
      return;
    }

    // If not all-or-nothing, we could fall back to row-wise inserts, but default is all-or-nothing
    updateProgress(importId, 80, ALL_OR_NOTHING ? 'Starting transactional import...' : 'Starting import...');

    // Transactional import: create missing entities and then all questions
    let createdSpecCount = 0;
    let createdLectureCount = 0;
  await prisma.$transaction(async (tx) => {
      // Ensure niveaux
      const niveauNameToId = new Map<string, string>();
      // Start with existing
      for (const n of allNiveaux) niveauNameToId.set(n.name.toUpperCase(), n.id);
      // Create planned niveaux
      for (const nvName of niveauxToEnsure) {
        const key = nvName.toUpperCase();
        if (!niveauNameToId.has(key)) {
          const created = await tx.niveau.create({ data: { name: nvName, order: Math.max(1, allNiveaux.length + 1) } });
          niveauNameToId.set(key, created.id);
        }
      }

      // Ensure semesters
      const semesterKeyToId = new Map<string, string>(); // key: NV|order
      for (const sRow of allSemesters) {
        const nvName = Array.from(niveauNameToId.entries()).find(([k, v]) => v === sRow.niveauId)?.[0] || '';
        semesterKeyToId.set(`${nvName}|${sRow.order}`, sRow.id);
      }
      // Also add semesters observed in planned rows (covers newly created niveaux)
      for (const p of plannedRows) {
        if (p.niveauName && p.semesterOrder) {
          semestersToEnsure.add(`${p.niveauName}|${p.semesterOrder}`);
        }
      }
      for (const token of semestersToEnsure) {
        const [nvName, ordStr] = token.split('|');
        const order = parseInt(ordStr, 10);
        const nvId = niveauNameToId.get(nvName.toUpperCase());
        if (nvId && !semesterKeyToId.has(`${nvName}|${order}`)) {
          const name = `${nvName} - S${order}`;
          const created = await tx.semester.create({ data: { name, order, niveauId: nvId } });
          semesterKeyToId.set(`${nvName}|${order}`, created.id);
        }
      }

      // Ensure specialties
      const specialtyNameToId = new Map<string, string>();
      const existingSpecialties = await tx.specialty.findMany({ where: { name: { in: specialtyList } }, select: { id: true, name: true } });
      for (const s of existingSpecialties) specialtyNameToId.set(s.name, s.id);
      for (const specName of specialtyList) {
        if (!specialtyNameToId.has(specName)) {
          // Try to infer niveau/semester from first occurrence in planned rows for this specialty
          const first = plannedRows.find(p => p.specialtyName === specName);
          const nvId = first?.niveauName ? (niveauNameToId.get(first.niveauName.toUpperCase()) ?? null) : null;
          const semId = first?.niveauName && first?.semesterOrder ? (semesterKeyToId.get(`${first.niveauName}|${first.semesterOrder}`) ?? null) : null;
          const created = await tx.specialty.create({ data: { name: specName, ...(nvId ? { niveauId: nvId } : {}), ...(semId ? { semesterId: semId } : {}) } });
          specialtyNameToId.set(specName, created.id);
          createdSpecCount++;
        }
      }

      // Ensure lectures
      const specTitleToLectureId = new Map<string, string>();
      // Prefill existing
      const existingLecs = await tx.lecture.findMany({
        where: { title: { in: Array.from(new Set(Object.values(titlesBySpec).flat())) }, specialtyId: { in: Array.from(specialtyNameToId.values()) } },
        include: { specialty: { select: { name: true } } }
      });
      for (const lec of existingLecs) specTitleToLectureId.set(`${lec.specialty.name}|${lec.title}`, lec.id);
      // Create missing
      for (const specName of Object.keys(titlesBySpec)) {
        for (const title of titlesBySpec[specName] || []) {
          const key = `${specName}|${title}`;
          if (!specTitleToLectureId.has(key)) {
            const specId = specialtyNameToId.get(specName);
            if (!specId) continue; // should not happen
            const created = await tx.lecture.create({ data: { specialtyId: specId, title } });
            specTitleToLectureId.set(key, created.id);
            createdLectureCount++;
          }
        }
      }

      // Prepare batch per lectureId for faster insertion
      const byLectureRecords = new Map<string, Prisma.QuestionUncheckedCreateInput[]>();
      for (const p of plannedRows) {
        const lecId = specTitleToLectureId.get(`${p.specialtyName}|${p.lectureTitle}`) || lectureIdBySpecTitle.get(`${p.specialtyName}|${p.lectureTitle}`);
        if (!lecId) throw new Error(`Internal error: Lecture not resolved for ${p.specialtyName} / ${p.lectureTitle}`);
        const rec: Prisma.QuestionUncheckedCreateInput = {
          lectureId: lecId,
          text: p.questionData.text,
          type: p.questionData.type,
          options: p.questionData.options ?? undefined,
          correctAnswers: p.questionData.correctAnswers,
          explanation: undefined,
          courseReminder: p.questionData.courseReminder ?? undefined,
          number: p.questionData.number ?? undefined,
          session: p.questionData.session ?? undefined,
          mediaUrl: p.questionData.mediaUrl ?? undefined,
          mediaType: p.questionData.mediaType ?? undefined,
          caseNumber: p.questionData.caseNumber ?? undefined,
          caseText: p.questionData.caseText ?? undefined,
          caseQuestionNumber: p.questionData.caseQuestionNumber ?? undefined
        };
        if (!byLectureRecords.has(lecId)) byLectureRecords.set(lecId, []);
        byLectureRecords.get(lecId)!.push(rec);
      }

      // Insert per lecture with createMany, chunked to reduce payload and lock times
      let processed = 0;
      const total = plannedRows.length;
      for (const [lecId, rows] of byLectureRecords.entries()) {
        if (rows.length <= CREATE_MANY_CHUNK) {
          await tx.question.createMany({ data: rows });
          processed += rows.length;
          const base = 80;
          const pct = base + Math.floor((processed / total) * 19);
          updateProgress(importId, pct, `Imported ${processed}/${total}...`);
          continue;
        }
        for (const chunk of chunkArray(rows, CREATE_MANY_CHUNK)) {
          await tx.question.createMany({ data: chunk });
          processed += chunk.length;
          const base = 80;
          const pct = base + Math.floor((processed / total) * 19);
          updateProgress(importId, pct, `Imported ${processed}/${total}...`);
        }
      }
    }, { maxWait: TX_MAX_WAIT, timeout: TX_TIMEOUT });

    // Update final stats and session
    importStats.imported = plannedRows.length;
    importStats.failed = 0;
    importStats.createdLectures = createdLectureCount;
    importStats.createdSpecialties = createdSpecCount;
    importStats.createdCases = plannedCases.size;
    importStats.questionsWithImages = inlineImageCount;

    const finalSession = activeImports.get(importId);
    if (finalSession && !finalSession.cancelled) {
      activeImports.set(importId, {
        ...finalSession,
        progress: 100,
        phase: 'complete',
        stats: importStats,
        message: 'Import completed',
        lastUpdated: Date.now()
      });
    }
    updateProgress(importId, 100, 'Import completed!', `🎉 Import completed! Total: ${importStats.total}, Imported: ${importStats.imported}, Failed: ${importStats.failed}, Created: ${importStats.createdSpecialties} specialties, ${importStats.createdLectures} lectures, ${importStats.createdCases} cases, ${importStats.questionsWithImages} questions with images`, 'complete');

  } catch (error) {
    console.error('File processing error:', error);
    updateProgress(importId, 0, 'Import failed', `❌ Import failed: ${(error as Error).message}`);
  }
}

async function postHandler(request: AuthenticatedRequest) {
  try {
    console.log('POST handler called');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    console.log('File received:', file ? { name: file.name, size: file.size } : 'No file');
    
    if (!file) {
      console.log('No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const importId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('Creating import session with ID:', importId);
    
    // Initialize import session
    const now = Date.now();
    const initialSession: ImportSession = {
      progress: 0,
      phase: 'validating',
      message: 'Starting import...',
      logs: [],
      stats: {
        total: 0,
        imported: 0,
        failed: 0,
        createdSpecialties: 0,
        createdLectures: 0,
        questionsWithImages: 0,
        createdCases: 0,
        errors: []
      },
      lastUpdated: now,
      createdAt: now
    };
    
    activeImports.set(importId, initialSession);

    console.log('Import session created. Total active imports:', activeImports.size);
    console.log('Session data:', activeImports.get(importId));

    // Process file in background
    console.log('Starting file processing in background');
  // Kick off async processing (do not await to return quickly).
  // NOTE: On serverless platforms long-running background tasks may be killed;
  // keep rows moderate or refactor to chunked polling if needed.
  processFile(file, importId).catch(e => console.error('Background import error', e));

    console.log('Returning importId:', importId);
    return NextResponse.json({ importId });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}

async function getHandler(request: AuthenticatedRequest) {
  try {
    console.log('GET handler called');
    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('importId');

    console.log('GET request for importId:', importId);
    console.log('Total active imports:', activeImports.size);
    console.log('Available import IDs:', Array.from(activeImports.keys()));

    if (!importId) {
      console.log('No importId provided');
      return NextResponse.json({ error: 'Import ID required' }, { status: 400 });
    }

    const importData = activeImports.get(importId);
    console.log('Import data found:', importData ? 'Yes' : 'No');
    
    if (!importData) {
      console.log('Import session not found for ID:', importId);
      console.log('Current active imports:', Array.from(activeImports.entries()));
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });
    }

    console.log('Found import data for ID:', importId, 'Progress:', importData.progress);
    
    // Check if this is an SSE request (EventSource)
    const acceptHeader = request.headers.get('accept');
    console.log('Accept header:', acceptHeader);
    
    if (acceptHeader && acceptHeader.includes('text/event-stream')) {
      console.log('SSE request detected');
      // Return SSE response
      const stream = new ReadableStream({
        start(controller) {
          const sendEvent = (data: unknown) => {
            const eventData = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(new TextEncoder().encode(eventData));
          };

          // Send initial data
          sendEvent(importData);

          // Set up polling to send updates
          const interval = setInterval(() => {
            const currentData = activeImports.get(importId);
            if (currentData) {
              sendEvent(currentData);
              
              // Close stream if import is complete
              if (currentData.progress >= 100) {
                clearInterval(interval);
                controller.close();
              }
            } else {
              clearInterval(interval);
              controller.close();
            }
          }, 1000);

          // Clean up on close
          return () => {
            clearInterval(interval);
          };
        }
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    console.log('Returning JSON response');
    // Regular JSON response
    return NextResponse.json(importData);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 });
  }
}

export const GET = requireAuth(getHandler);
export const POST = requireAuth(postHandler);

// Allow cancelling an active import
async function deleteHandler(request: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const importId = searchParams.get('importId');
  if (!importId) return NextResponse.json({ error: 'Import ID required' }, { status: 400 });
  const session = activeImports.get(importId);
  if (!session) return NextResponse.json({ error: 'Import not found' }, { status: 404 });
  activeImports.set(importId, { ...session, cancelled: true, message: 'Cancelled by user', phase: 'complete', lastUpdated: Date.now() });
  return NextResponse.json({ ok: true });
}

export const DELETE = requireAuth(deleteHandler);

// Test endpoint to verify route is working
export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}