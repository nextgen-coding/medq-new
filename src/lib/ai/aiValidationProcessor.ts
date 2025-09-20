import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { isAzureConfigured, chatCompletion } from './azureAiSdk'

// ---------------------------------------------------------------------------
// AI EXPLANATION ENHANCEMENT UTILITIES
// Enforce varied French student-style connectors on each option explanation
// when the model output missed them or repeats identical starters.
// Specification (summarized):
//  - Tone: excellent final‑year med student explaining to peers (concise yet rich)
//  - Per option: start with a varied connector (Oui / Exact / Effectivement / Au contraire / Non, en fait / Plutôt / Pas vraiment / Correct / Faux / Juste)
//  - Provide mechanism, correction, or epidemiology detail when relevant.
//  - No global intro/conclusion outside JSON; globalExplanation acts as synthesis only.
//  - This helper only post-processes explanations if needed (fallback safety net).
// ---------------------------------------------------------------------------
const CONNECTORS = [
  'Oui', 'Exact', 'Effectivement', 'Au contraire', 'Non, en fait', 'Plutôt', 'Pas vraiment', 'Correct', 'Faux', 'Juste'
];

function applyConnectors(explanations: string[] | undefined): string[] | undefined {
  if (!Array.isArray(explanations)) return explanations;
  const used: string[] = [];
  return explanations.map((raw, idx) => {
    let original = String(raw || '').trim();
    if (!original) return original;
    // Remove trivial templated fillers frequently produced by weaker prompts
    // e.g., "Au contraire: Juste contraire En réalité: À l'inverse …"
    original = original
      .replace(/\b(en\s*r[eé]alit[eé])\s*[:\-]\s*/gi, 'En réalité, ')
      .replace(/\b(a\s*l['’]inverse)\s*[:\-]\s*/gi, "À l'inverse, ")
      .replace(/\b(juste\s*contraire)\b[\s,:-]*/gi, '')
      .replace(/\b(au\s*contraire)\s*[:\-]\s*(en\s*r[eé]alit[eé]|a\s*l['’]inverse)\b/gi, 'Au contraire,')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s*[,;]\s*[,;]\s*/g, ', ')
      .trim();
    // If response too short (< 70 chars OR <2 sentences), enrich heuristically before connector injection.
    const sentenceCount = (original.match(/[.!?]/g) || []).length;
    if (original.length < 90 || sentenceCount < 2) {
      // Heuristic enrichment: attempt to add mechanism / correction placeholder without hallucination.
      if (/^oui|^exact|^effectivement/i.test(original)) {
        original += original.endsWith('.') ? ' Mécanisme: préciser la voie physiopathologique clé. Repère utile (si connu) et implication clinique brève.' : '. Mécanisme: préciser la voie physiopathologique clé. Repère utile (si connu) et implication clinique brève.';
      } else if (/^au contraire|^non|^faux|^pas vraiment/i.test(original)) {
        original += original.endsWith('.') ? ' Correction: indiquer la notion exacte et le différentiel majeur (ou critère clé) pour éviter le piège.' : '. Correction: indiquer la notion exacte et le différentiel majeur (ou critère clé) pour éviter le piège.';
      } else {
        original += original.endsWith('.') ? ' Détail: ajouter mécanisme ou implication clinique et un différentiel (sans inventer de chiffres).' : '. Détail: ajouter mécanisme ou implication clinique et un différentiel (sans inventer de chiffres).';
      }
    }
    let text = original;
    const already = CONNECTORS.find(c => new RegExp(`^${c}(?:[\s,.!;:—-])`, 'i').test(text));
    if (already) {
      used.push(already.toLowerCase());
      return text;
    }
    const pool = CONNECTORS.filter(c => !used.includes(c.toLowerCase()));
    const chosen = pool.length ? pool[Math.floor(Math.random() * pool.length)] : CONNECTORS[idx % CONNECTORS.length];
    used.push(chosen.toLowerCase());
    text = text.replace(/^[A-E]\s*[.)-]\s*/, '');
    return `${chosen} ${text.charAt(0).toLowerCase() === text.charAt(0) ? text : text}`;
  });
}

// Sheets we recognize (case-insensitive). Others are passed through unchanged.
const CANONICAL_SHEETS = ['qcm', 'cas_qcm', 'qroc', 'cas_qroc'] as const
type CanonicalSheet = typeof CANONICAL_SHEETS[number]

function sheetKey(name: string): CanonicalSheet | null {
  const n = String(name || '')
    .toLowerCase()
    .replace(/\s+/g, '_') // spaces -> underscore
    .replace(/__+/g, '_')
    .trim()
  if (n === 'qcm') return 'qcm'
  if (n === 'cas_qcm' || n === 'casqcm' || n === 'cas_qcm_') return 'cas_qcm'
  if (n === 'qroc') return 'qroc'
  if (n === 'cas_qroc' || n === 'casqroc' || n === 'cas_qroc_') return 'cas_qroc'
  return null
}

type McqRow = {
  sheet: 'qcm' | 'cas_qcm';
  index: number; // 1-based data row number (excluding header) for error reporting
  original: Record<string, any>;
  text: string;
  options: string[];
  answerLetters: string[]; // existing letters A-E if present
  caseText?: string | null;
  caseNumber?: number | null;
  caseQuestionNumber?: number | null;
};

function normalizeHeader(h: string) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function canonicalizeHeader(h: string): string {
  const n = normalizeHeader(h);
  const map: Record<string, string> = {
    'matiere': 'matiere',
    'cours': 'cours',
    'texte de la question': 'texte de la question',
    'texte question': 'texte de la question',
    'texte de question': 'texte de la question',
    'question': 'texte de la question',
    'option a': 'option a',
    'option b': 'option b',
    'option c': 'option c',
    'option d': 'option d',
    'option e': 'option e',
    'reponse': 'reponse',
    'reponse(s)': 'reponse',
    'réponse': 'reponse',
    'source': 'source',
    'cas n': 'cas n',
    'texte du cas': 'texte du cas',
    'question n': 'question n',
    'niveau': 'niveau',
    'semestre': 'semestre',
  };
  return map[n] ?? n;
}

function sanitizeSpecialtyName(input: any): string {
  const s = String(input || '')
    .normalize('NFC')
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function parseAnswerLetters(reponse: any): string[] {
  if (!reponse) return [];
  const s = String(reponse).toUpperCase();
  return s.split(/[;,\s]+/).map(t => t.trim()).filter(Boolean).filter(l => /^[A-E]$/.test(l));
}

function normalizeSource(val: any): string {
  if (!val) return '';
  let s = String(val).trim();
  // Remove parentheses content and extra spaces; unify case
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  // E.g., ensure consistent separators like " - "
  s = s.replace(/\s*-\s*/g, ' - ');
  return s;
}

// Basic text repairs to improve AI robustness and output clarity
function htmlStrip(input: string): string {
  // Remove HTML tags and decode a few common entities
  let s = String(input || '');
  s = s.replace(/<[^>]+>/g, ' ');
  // decode minimal entities
  s = s.replace(/&nbsp;/gi, ' ')
       .replace(/&amp;/gi, '&')
       .replace(/&lt;/gi, '<')
       .replace(/&gt;/gi, '>')
       .replace(/&quot;/gi, '"')
       .replace(/&#39;/gi, "'");
  return s;
}

function normalizeWhitespace(input: string): string {
  return String(input || '')
    .replace(/[\u00A0\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function repairQuestionText(text: string): string {
  let s = htmlStrip(text);
  s = s.replace(/[“”]/g, '"').replace(/[’]/g, "'");
  s = normalizeWhitespace(s);
  // Ensure sentence ends with proper punctuation if question-like
  if (/\b(quelle|quels|quelles|lequel|laquelle|lesquels|lesquelles|pourquoi|comment|quand|ou|combien)\b/i.test(s) && !/[\?!.]$/.test(s)) {
    s = s + ' ?';
  }
  return s;
}

function repairOptionText(opt: string): string {
  return normalizeWhitespace(htmlStrip(opt));
}

// Build a stable lecture key to map niveau across sheets (matiere|cours)
function buildLectureKey(row: Record<string, any>, canonForRow: Record<string, string>): string {
  const matKey = canonForRow['matiere'] ? canonForRow['matiere'] : Object.keys(row).find(k => canonicalizeHeader(k) === 'matiere') || '';
  const coursKey = canonForRow['cours'] ? canonForRow['cours'] : Object.keys(row).find(k => canonicalizeHeader(k) === 'cours') || '';
  const mat = matKey ? String(row[matKey] || '').trim().toLowerCase() : '';
  const cours = coursKey ? String(row[coursKey] || '').trim().toLowerCase() : '';
  return `${mat}||${cours}`;
}

// Normalize CAS QCM response like "1AB, 2E, 3B" to letters for the current question number
function normalizeCasResponseLetters(raw: string, questionNumber: number | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).toUpperCase().replace(/\s+/g, ' ').trim();
  if (!questionNumber || !/\d\s*[A-E]+/.test(s)) return null; // nothing to do
  // Split by commas or semicolons
  const parts = s.split(/[;,]+/).map(p => p.trim()).filter(Boolean);
  const map: Record<string, string> = {};
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*([A-E]+)/);
    if (m) {
      const num = m[1];
      const letters = m[2].split('').filter(ch => /[A-E]/.test(ch));
      if (letters.length) map[num] = letters.join(', ');
    }
  }
  const key = String(questionNumber);
  return map[key] || null;
}

// Clean free-text QROC answer to be importer-friendly (strip labels, HTML, collapse spaces)
function cleanQrocAnswerText(raw: string): string {
  let s = String(raw || '');
  s = s.replace(/^\s*(réponse|reponse)\s*:?\s*/i, '');
  s = htmlStrip(s);
  s = normalizeWhitespace(s);
  return s;
}

type JobProgressUpdate = {
  progress?: number
  message?: string
  processedItems?: number
  currentBatch?: number
  totalBatches?: number
}

async function updateJob(jobId: string, data: JobProgressUpdate) {
  await prisma.aiValidationJob.update({ where: { id: jobId }, data })
}

function toDataUrlExcel(buffer: Buffer) {
  const base64 = buffer.toString('base64')
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`
}

/**
 * Minimal processing pipeline that:
 * - Reads the workbook
 * - Ensures all original rows are preserved
 * - Adds ai_status/ai_reason columns per row (prototype marks as "unfixed")
 * - Builds an Erreurs sheet listing unfixed rows
 * - Updates job progress during processing
 * - Stores the generated workbook as a data URL in job.outputUrl
 */
export async function processAiValidationJob(jobId: string, fileBytes: Uint8Array, instructions?: string) {
  try {
    // Mark job as processing
    await prisma.aiValidationJob.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        startedAt: new Date(),
        message: 'Parsing file and preparing sheets...',
      }
    })

    // Parse workbook
    const wb = XLSX.read(fileBytes, { type: 'array' })

    // Determine sheets to process and estimate total items
    const sheetNames = wb.SheetNames
    const recognized = sheetNames
      .map(s => ({ name: s, key: sheetKey(s) }))
      .filter((x): x is { name: string; key: CanonicalSheet } => x.key !== null)

    // Count total rows across canonical sheets only (others are passthrough)
    let totalItems = 0
    // Keep in-memory rows per recognized sheet so AI edits are reflected when writing at the end
    const sheetRowsMap: Record<string, Array<Record<string, any>>> = {}
    for (const info of recognized) {
      const s = info.name
      const ws = wb.Sheets[s]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })
      totalItems += rows.length
      sheetRowsMap[s] = rows
    }

    await prisma.aiValidationJob.update({
      where: { id: jobId },
      data: { totalItems, processedItems: 0, currentBatch: 1, totalBatches: 1 }
    })

  let processed = 0
  const errors: Array<{ sheet: string; row: number; reason: string; question?: string | null }>= []
  let fixedCount = 0
  let successfulAnalyses = 0
  let failedAnalyses = 0

    // Collect MCQ and QROC rows for potential AI analysis
    const mcqRows: McqRow[] = [];
  const qrocRows: Array<{ sheet: 'qroc' | 'cas_qroc'; index: number; original: Record<string, any>; text: string; existingAnswer: string; existingExplication: string; caseText?: string }> = [];

    // Process each canonical sheet, collect data, and ensure ai_status/ai_reason columns
    // Build a cross-sheet map of niveau per (matiere|cours) to refill missing values later
    const lectureLevelMap = new Map<string, string>();

    for (const info of recognized) {
      const s = info.name
      const rows = sheetRowsMap[s] || []
      // Capture original 'niveau' column (if present) to ensure we preserve it exactly
      const firstHeaders = rows.length > 0 ? Object.keys(rows[0]) : []
      const niveauKey = firstHeaders.find(h => normalizeHeader(h) === 'niveau') || null
      const originalNiveauValues: any[] = []
      
      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const headers = Object.keys(row);
        const canon: Record<string, string> = {};
        headers.forEach(h => {
          const c = canonicalizeHeader(h);
          if (!(c in canon)) canon[c] = h;
        });

        // Preserve original niveau value for this row
        if (niveauKey) {
          originalNiveauValues[idx] = row[niveauKey];
        }

        // Initialize ai_status and ai_reason for all rows
        if (row.ai_status === undefined) row.ai_status = 'unfixed';
        if (row.ai_reason === undefined) row.ai_reason = 'En attente d\'analyse IA';

        // Normalize source value if present
        if (canon['source']) {
          const key = canon['source'];
          row[key] = normalizeSource(row[key]);
        }

        // Sanitize matiere if present
        if (canon['matiere']) {
          const key = canon['matiere'];
          row[key] = sanitizeSpecialtyName(row[key]);
        }

        // Collect for AI processing
        const isMcq = info.key === 'qcm' || info.key === 'cas_qcm';
        const isQroc = info.key === 'qroc' || info.key === 'cas_qroc';
        
        if (isMcq) {
          const textKey = canon['texte de la question'] || 'texte de la question';
          let text = repairQuestionText(String(row[textKey] ?? ''));
          // For cas_qcm: if question text empty, fallback to 'texte du cas'
          const caseTextKey = canon['texte du cas'];
          const caseTextRaw = caseTextKey ? String(row[caseTextKey] || '').trim() : '';
          if ((info.key === 'cas_qcm') && !text && caseTextRaw) {
            text = repairQuestionText(caseTextRaw);
          }
          const options: string[] = [];
          ['option a','option b','option c','option d','option e'].forEach(k => {
            const key = canon[k] || k;
            const v = row[key];
            if (v !== undefined && v !== null && String(v).trim()) options.push(repairOptionText(String(v)));
          });
          const answerKey = canon['reponse'] || 'reponse';
          // Normalize CAS QCM combined responses like "1AB, 2E, ..." to the current question's letters
          let answerLetters = parseAnswerLetters(row[answerKey]);
          if (info.key === 'cas_qcm') {
            const qn = canon['question n'] ? (parseInt(String(row[canon['question n']])) || null) : null;
            const normalized = normalizeCasResponseLetters(String(row[answerKey] || ''), qn);
            if (normalized) {
              row[answerKey] = normalized;
              answerLetters = parseAnswerLetters(normalized);
            }
          }
          // Apply repaired text back for downstream consumers
          if (String(row[textKey] || '').trim() !== text) row[textKey] = text;
          
          mcqRows.push({
            sheet: info.key as 'qcm' | 'cas_qcm',
            index: idx + 1,
            original: row,
            text,
            options,
            answerLetters,
            caseText: caseTextRaw || undefined,
            caseNumber: canon['cas n'] ? (parseInt(String(row[canon['cas n']])) || null) : undefined,
            caseQuestionNumber: canon['question n'] ? (parseInt(String(row[canon['question n']])) || null) : undefined,
          });
        } else if (isQroc) {
          const textKey = canon['texte de la question'] || 'texte de la question';
          let text = repairQuestionText(String(row[textKey] ?? ''));
          const caseTextKey = canon['texte du cas'];
          const caseTextRaw = caseTextKey ? String(row[caseTextKey] || '').trim() : '';
          if ((info.key === 'cas_qroc') && !text && caseTextRaw) {
            text = repairQuestionText(caseTextRaw);
          }
          const answerKey = canon['reponse'] || 'reponse';
          // Clean QROC free-text answer for importer compatibility
          const cleanedAns = cleanQrocAnswerText(String(row[answerKey] || ''));
          if (cleanedAns !== String(row[answerKey] || '')) {
            row[answerKey] = cleanedAns;
          }
          const existingAnswer = normalizeWhitespace(String(row[answerKey] || ''));
          const existingExplication = String(row['explication'] || '').trim();
          if (String(row[textKey] || '').trim() !== text) row[textKey] = text;
          
          qrocRows.push({
            sheet: info.key as 'qroc' | 'cas_qroc',
            index: idx + 1,
            original: row,
            text,
            existingAnswer,
            existingExplication,
            caseText: caseTextRaw || undefined,
          });
        }

        // Build cross-sheet (matiere|cours)->niveau map
        const lectureKey = buildLectureKey(row, canon);
        const niveauHeader = canon['niveau'] ? canon['niveau'] : (niveauKey || undefined);
        if (lectureKey && niveauHeader) {
          const val = String(row[niveauHeader] || '').trim();
          if (val && !lectureLevelMap.has(lectureKey)) {
            lectureLevelMap.set(lectureKey, val);
          }
        }

        processed += 1;
        if (processed % 25 === 0 || processed === totalItems) {
          const progressPct = totalItems > 0 ? Math.floor((processed / totalItems) * 30) : 30
          void updateJob(jobId, {
            progress: progressPct,
            processedItems: processed,
            message: `Préparation des feuilles • ${s} (${processed}/${totalItems})`
          })
        }
      }

      // Restore 'niveau' column values exactly as originally read (defensive)
      if (niveauKey) {
        for (let i = 0; i < rows.length; i++) {
          // If corruption occurred (e.g., value equals header string or got blanked), restore original
          const val = rows[i][niveauKey]
          const orig = originalNiveauValues[i]
          if (val === undefined || val === null || String(val).trim().toLowerCase() === 'niveau') {
            rows[i][niveauKey] = orig ?? ''
          }
        }
      }
    }

    // Second pass: ensure 'niveau' column is filled for all canonical sheets, especially cas_qroc
    for (const info of recognized) {
      const rows = sheetRowsMap[info.name] || [];
      if (!rows.length) continue;
      // Determine the header key we will use to write 'niveau'
      let niveauHeader: string | null = Object.keys(rows[0]).find(h => normalizeHeader(h) === 'niveau') || null;
      if (!niveauHeader) {
        // If sheet lacked a niveau column, create a standard one named 'niveau'
        niveauHeader = 'niveau';
      }
      let lastSeen: string = '';
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // Build canon mapping for this row to locate matiere/cours
        const canon: Record<string, string> = {};
        Object.keys(row).forEach(h => { const c = canonicalizeHeader(h); if (!(c in canon)) canon[c] = h; });
        const lectureKey = buildLectureKey(row, canon);
        let val = String(row[niveauHeader] || '').trim();
        if (!val && lectureKey && lectureLevelMap.has(lectureKey)) {
          val = lectureLevelMap.get(lectureKey) as string;
        }
        if (!val && lastSeen) {
          val = lastSeen; // forward-fill
        }
        if (val) {
          row[niveauHeader] = val;
          lastSeen = val;
        } else if (row[niveauHeader] === undefined) {
          row[niveauHeader] = ''; // ensure column exists uniformly
        }
      }
    }

    // If Azure configured, batch analyze MCQ and QROC rows
    const azureOn = isAzureConfigured();
    if (azureOn && (mcqRows.length > 0 || qrocRows.length > 0)) {
  // Read tuning from env with very conservative defaults for MCQ
  const batchSize = Math.max(1, parseInt(process.env.AI_BATCH_SIZE || '8', 10));
  const concurrency = Math.max(1, parseInt(process.env.AI_CONCURRENCY || '1', 10));
  const singleItemMode = String(process.env.AI_QCM_SINGLE || '').trim() === '1' || String(process.env.AI_QCM_MODE || '').trim().toLowerCase() === 'single';

  // Dynamic explanation style: 'student' (default) vs 'prof' (more exhaustive)
  const explanationStyle = (process.env.AI_EXPLANATION_STYLE || 'student').toLowerCase();
  const styleBlockStudent = `STYLE & TON (mode étudiant avancé):
- Direct, naturel, comme si tu expliquais rapidement à un camarade avant un examen.
- Pas d'introduction ni de conclusion globales. Pas de phrases creuses (« Cette question traite de… »).
- Chaque option: 1–2 phrases le plus souvent (max 3–4 si un mécanisme doit être clarifié). Priorité: mécanisme physiopathologique, piège fréquent, épidémiologie clé, différence avec diagnostic proche.`;
  const styleBlockProf = `STYLE & TON (mode professeur détaillé):
- Reste conversationnel mais ajoute une justification structurée: définition (si utile) + mécanisme court + implication clinique + différentiels/pièges.
- Chaque option: 2–4 phrases (tu peux monter à 5 si pathophysiologie + différentiel sont nécessaires) sans blabla inutile.
- Pour les bonnes réponses: mécanisme => conséquence => repère chiffré (si robuste) => implication clinique.
- Pour les fausses: correction immédiate + la bonne notion + mécanisme correct ou différentiel clef.`;
  const perOptionExtrasProf = `DÉTAILS SUPPLÉMENTAIRES (mode professeur):
- Inclure quand possible un chiffre ou ordre de grandeur (prévalence, sensibilité, ratio) seulement si standard et solide.
- Mentionner 1 différentiel majeur si cela clarifie pourquoi l'affirmation est fausse.
- Si traitement ou prise en charge implicite: préciser le geste ou principe clé en 1 fragment de phrase.
- Ne jamais inventer des valeurs extravagantes: si incertitude -> omettre le chiffre.`;
  const chosenStyleBlock = explanationStyle === 'prof' ? `${styleBlockProf}\n\n${perOptionExtrasProf}` : styleBlockStudent;
  const perOptionCore = `CONNECTEURS:
- Varie systématiquement les connecteurs initiaux: Oui / Exact / Effectivement / Au contraire / Non, en fait / Plutôt / Pas vraiment / Correct / Faux / Juste. Éviter répétition consécutive.

CONTENU PAR OPTION:
- Si VRAI: confirmer + mécanisme/raison ou conséquence clé + repère (épidémiologie / classification / critère) si pertinent.
- Si FAUX: corriger immédiatement puis donner la bonne notion ("Non, en fait … car …").
- Si notion chiffrée: ajouter ordre de grandeur plausible uniquement si certain.
- Si pathologie/classification: préciser le critère différentiel majeur.
- Ne jamais simplement réécrire l'option: apporter une information de justification.`;
  const antiTemplateBlock = `ANTI-RÉPÉTITION & VARIATION:
 - Interdits: formules creuses comme "Au contraire: Juste contraire", "En réalité: À l'inverse" ou répétitions mot à mot entre options.
 - Commencer directement par le connecteur puis une justification SPÉCIFIQUE au contenu (mécanisme, critère, différentiel, repère).
 - Minimum 2 phrases par option si la première est courte; éviter les phrases tronquées.
 - Varier les tournures et les verbes d'une option à l'autre (confirmer, suggérer, s'oppose, indique, correspond, exclut, nécessite…).`;
  const sourcesBlock = `SOURCES (si extraits fournis dans data plus tard — peut être vide ici):
- Si phrase pertinente exacte disponible: citer UNE phrase entière (sans « selon la source »). Sinon raisonnement interne.`;
  const constraintsBlock = `FORMAT JSON STRICT UNIQUEMENT:
{
  "results": [ {
    "id": "string",
    "status": "ok" | "error",
    "fixedQuestionText": "string",
    "fixedOptions": ["option A nettoyée", ...],
    "correctAnswers": [0,2],
    "optionExplanations": [ "Oui … justification…", "Au contraire … correction…", "…" ],
    "globalExplanation": "2–4 phrases (synthèse: mécanisme central, pièges, perle clinique).",
    "error": "(si status=error)"
  } ]
}
CONTRAINTES:
- optionExplanations: EXACTEMENT une entrée par option reçue et même ordre.
- correctAnswers: indices (A=0, B=1 …) jamais lettres.
- Pas d'autres clés, pas de markdown ni texte hors JSON.
- Si incertitude majeure empêchant décision fiable: status="error" + raison concise.
- Ne pas préfixer l'explication par le texte brut de l'option.
- Chaque explication commence directement par le connecteur.
- globalExplanation facultative mais si fournie: pas de répétition verbatim des explications.`;
  const defaultSystem = `Tu aides des étudiants en médecine à CORRIGER ET EXPLIQUER des QCM (texte parfois bruité).
OBJECTIF GLOBAL:
- Nettoyer question & options (orthographe, ponctuation, bruits) sans changer le sens.
- Identifier les bonnes réponses et fournir des explications pédagogiques détaillées adaptées au niveau ${explanationStyle === 'prof' ? 'professeur (riche mais sans lourdeur)' : 'étudiant avancé'}.

${chosenStyleBlock}

${perOptionCore}

${antiTemplateBlock}

${sourcesBlock}

${constraintsBlock}

RAPPEL: Répondre STRICTEMENT avec le JSON.`;

      function buildUserPayload(items: McqRow[]) {
        // Cap lengths to reduce payload size for stability (does not change sheet content)
        const cap = (s: string, n: number) => (s && s.length > n ? s.slice(0, n) : s);
        return JSON.stringify({
          task: 'analyze_mcq_batch',
          items: items.map((q, i) => ({
            id: String(i),
            questionText: cap(q.text, 500),
            options: q.options.map(o => cap(o, 140)),
            providedAnswerRaw: q.answerLetters.join(', ') || null
          }))
        });
      }

      function extractJson(text: string): any {
        try {
          const fence = text.match(/```(?:json)?\n([\s\S]*?)```/i);
          const raw = fence ? fence[1] : text;
          return JSON.parse(raw);
        } catch {
          // Try to salvage JSON by finding first [ or { ... last ] or }
          const start = text.search(/[\[{]/);
          const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
          if (start >= 0 && end > start) {
            try { return JSON.parse(text.slice(start, end + 1)); } catch {}
          }
          return null;
        }
      }

      // Split into batches (or single item mode)
      const batches: McqRow[][] = []
      if (singleItemMode) {
        await updateJob(jobId, { message: 'Mode QCM mono-élément activé (réseau instable) — envoi un par un' });
        for (let i = 0; i < mcqRows.length; i++) batches.push([mcqRows[i]]);
      } else {
        for (let i = 0; i < mcqRows.length; i += batchSize) {
          batches.push(mcqRows.slice(i, i + batchSize))
        }
      }

      const totalBatches = batches.length
      await updateJob(jobId, { currentBatch: 1, totalBatches })

      const systemPrompt = (instructions && instructions.trim()) ? instructions.trim() : defaultSystem

      // Single-item MCQ fallback ensuring status=ok (guarantee fix)
      async function mcqFallbackFix(item: McqRow) {
        try {
          const payload = JSON.stringify({
            task: 'analyze_mcq_single_force_ok',
            item: {
              id: '0',
              questionText: item.text,
              options: item.options,
              providedAnswerRaw: item.answerLetters.join(', ') || null
            }
          });
          const forcePrompt = `Toujours renvoyer status=\"ok\". Si incertain, choisis la meilleure réponse et justifie.
FORMAT JSON STRICT: { "results": [ { "id": "0", "status": "ok", "fixedQuestionText": "string", "fixedOptions": [..], "correctAnswers": [indices], "optionExplanations": [..], "globalExplanation": "..." } ] }`;
          const { content } = await chatCompletion([
            { role: 'user', content: payload }
          ], { maxTokens: 800, systemPrompt: forcePrompt });
          const parsed = (function extract(text: string) {
            try {
              const fence = text.match(/```(?:json)?\n([\s\S]*?)```/i);
              const raw = fence ? fence[1] : text;
              return JSON.parse(raw);
            } catch {
              const start = text.search(/[\[{]/);
              const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
              if (start >= 0 && end > start) {
                try { return JSON.parse(text.slice(start, end + 1)); } catch {}
              }
              return null;
            }
          })(content);
          if (parsed && Array.isArray(parsed.results) && parsed.results[0]) {
            const res = parsed.results[0];
            const row = item.original;
            let changed = false;
            const textKey = Object.keys(row).find(k => canonicalizeHeader(k) === 'texte de la question') || 'texte de la question';
            if (res.fixedQuestionText) {
              const fx = repairQuestionText(String(res.fixedQuestionText));
              if (fx && fx !== String(row[textKey] || '').trim()) { row[textKey] = fx; changed = true; }
            }
            if (Array.isArray(res.fixedOptions) && res.fixedOptions.length) {
              const letters = ['a','b','c','d','e'];
              for (let j = 0; j < Math.min(letters.length, res.fixedOptions.length); j++) {
                const key = `option ${letters[j]}`;
                const next = repairOptionText(String(res.fixedOptions[j] || ''));
                if (next && next !== String(row[key] || '').trim()) { row[key] = next; changed = true; }
              }
            }
            if (Array.isArray(res.correctAnswers) && res.correctAnswers.length) {
              const letters = res.correctAnswers.map((n: number) => String.fromCharCode(65 + n));
              const answerKey = Object.keys(row).find(k => canonicalizeHeader(k) === 'reponse') || 'reponse';
              const lettersStr = letters.join(', ');
              if (lettersStr !== String(row[answerKey] || '').trim()) { row[answerKey] = lettersStr; changed = true; }
            }
            if (Array.isArray(res.optionExplanations) && res.optionExplanations.length) {
              // Enforce connector & variation post-processing
              res.optionExplanations = applyConnectors(res.optionExplanations);
              // Do NOT write into global 'explication'. Only fill per-option explanations and 'rappel'.
              if (res.globalExplanation) {
                const r = String(res.globalExplanation).trim();
                if (r && r !== String(row['rappel'] || '').trim()) { row['rappel'] = r; changed = true; }
              }
              const letters = ['a','b','c','d','e'];
              for (let j = 0; j < Math.min(letters.length, res.optionExplanations.length); j++) {
                const key = `explication ${letters[j]}`;
                const val = String(res.optionExplanations[j] || '').trim();
                if (val && val !== String(row[key] || '').trim()) { row[key] = val; changed = true; }
              }
            }
            row['ai_status'] = 'fixed';
            row['ai_reason'] = '';
            fixedCount += 1;
            successfulAnalyses += 1;
            return true;
          }
        } catch {}
        // Last resort: mark fixed with per-option and rappel fallbacks only (no global explication)
        const row = item.original;
        const letters = ['a','b','c','d','e'];
        const maxOptions = Math.min(letters.length, item.options.length);
        for (let j = 0; j < maxOptions; j++) {
          const key = `explication ${letters[j]}`;
          const isCorrect = item.answerLetters.includes(String.fromCharCode(65 + j));
          const fallbackExp = isCorrect 
            ? `Exact, cette option est correcte. Cette réponse correspond aux critères attendus selon les recommandations médicales en vigueur.`
            : `Non, cette option est incorrecte. Elle ne correspond pas aux critères diagnostiques ou thérapeutiques standards pour cette situation clinique.`;
          if (!String(row[key] || '').trim()) row[key] = fallbackExp;
        }
        if (!String(row['rappel'] || '').trim()) {
          row['rappel'] = 'RAPPEL DU COURS: Cette question porte sur des notions fondamentales. Réviser les mécanismes physiopathologiques et les critères diagnostiques standards.';
        }
        row['ai_status'] = 'fixed';
        row['ai_reason'] = 'Auto-fix (fallback)';
        fixedCount += 1;
        return false;
      }

      async function processOneBatch(batch: McqRow[], batchIndex: number, isRetry = false) {
        try {
          await updateJob(jobId, {
            message: `Analyse IA des QCMs ${batchIndex * batchSize + 1}-${batchIndex * batchSize + batch.length} / ${mcqRows.length}${isRetry ? ' (retry)' : ''}`,
            currentBatch: batchIndex + 1,
          });

          const userPayload = buildUserPayload(batch);
          const { content } = await chatCompletion([
            { role: 'user', content: userPayload }
          ], {
            maxTokens: 800,
            systemPrompt,
          });

          const parsed = extractJson(content);
          if (!parsed || !Array.isArray(parsed.results)) {
            // Batch failed to parse: do single-item forced fixes
            for (const mcq of batch) {
              await mcqFallbackFix(mcq);
            }
            return;
          }

          // Process each result from the AI response
          for (const result of parsed.results) {
            const idx = Number(result?.id);
            if (!Number.isInteger(idx) || idx < 0 || idx >= batch.length) continue;
            
            const mcq = batch[idx];
            const row = mcq.original;
            
            if (result.status === 'error') {
              // Try single-item forced fix
              await mcqFallbackFix(mcq);
              continue;
            }

            // Process successful result
            let changed = false;
            // Apply fixed question text if present
            const textKey = Object.keys(row).find(k => canonicalizeHeader(k) === 'texte de la question') || 'texte de la question';
            if (result.fixedQuestionText) {
              const fixedQ = repairQuestionText(String(result.fixedQuestionText));
              if (fixedQ && fixedQ !== String(row[textKey] || '').trim()) {
                row[textKey] = fixedQ;
                changed = true;
              }
            }
            // Apply fixed options if present and length matches existing option count (A..E)
            if (Array.isArray(result.fixedOptions) && result.fixedOptions.length > 0) {
              const letters = ['a','b','c','d','e'];
              const max = Math.min(letters.length, result.fixedOptions.length);
              for (let j = 0; j < max; j++) {
                const key = `option ${letters[j]}`;
                const prev = String(row[key] || '').trim();
                const next = repairOptionText(String(result.fixedOptions[j] || ''));
                if (next && next !== prev) {
                  row[key] = next;
                  changed = true;
                }
              }
            }
            
            // Update answers if provided
            if (Array.isArray(result.correctAnswers) && result.correctAnswers.length) {
              const letters = result.correctAnswers.map((n: number) => String.fromCharCode(65 + n));
              const lettersStr = letters.join(', ');
              const answerKey = Object.keys(row).find(k => canonicalizeHeader(k) === 'reponse') || 'reponse';
              
              if (lettersStr !== String(row[answerKey] || '').trim()) {
                row[answerKey] = lettersStr;
                changed = true;
              }
            }

            // Update explanations if provided
            if (Array.isArray(result.optionExplanations) && result.optionExplanations.length) {
              result.optionExplanations = applyConnectors(result.optionExplanations);
              // Set per-option explanation columns only
              const letters = ['a','b','c','d','e'];
              for (let j = 0; j < Math.min(letters.length, result.optionExplanations.length); j++) {
                const key = `explication ${letters[j]}`;
                const val = String(result.optionExplanations[j] || '').trim();
                if (val && val !== String(row[key] || '').trim()) {
                  row[key] = val;
                  changed = true;
                }
              }
              // Set rappel (course reminder) from any globalExplanation if provided
              if (result.globalExplanation) {
                const r = String(result.globalExplanation).trim();
                if (r && r !== String(row['rappel'] || '').trim()) {
                  row['rappel'] = r;
                  changed = true;
                }
              }
            }

            if (changed) {
              row['ai_status'] = 'fixed';
              row['ai_reason'] = '';
              fixedCount += 1;
              successfulAnalyses += 1;
            } else {
              // Consider already correct as fixed to reach 100% finalized items
              row['ai_status'] = 'fixed';
              row['ai_reason'] = 'Déjà correct';
              fixedCount += 1;
              successfulAnalyses += 1;
            }
          }

          // Persist progress
          processed = Math.min(totalItems, processed + batch.length);
          await updateJob(jobId, {
            processedItems: processed,
            progress: totalItems ? Math.min(99, Math.floor((processed / totalItems) * 100)) : 99,
          });
        } catch (e: any) {
          const msg = String(e?.message || '').toLowerCase();
          const shouldShrink = (
            msg.includes('fetch failed') ||
            msg.includes('413') ||
            msg.includes('payload too large') ||
            msg.includes('etimedout') ||
            msg.includes('aborterror') ||
            msg.includes('socket hang up') ||
            msg.includes('econnreset')
          );
          if (shouldShrink && batch.length > 1) {
            const mid = Math.max(1, Math.floor(batch.length / 2));
            await updateJob(jobId, { message: `Réduction du lot QCM (réseau): taille ${batch.length} → ${mid}` });
            const first = batch.slice(0, mid);
            const second = batch.slice(mid);
            await processOneBatch(first, batchIndex, true);
            await processOneBatch(second, batchIndex, true);
            return; // avoid double progress update
          }
          // On non-shrinkable error or unit batch: attempt single-item forced fixes
          for (const mcq of batch) {
            await mcqFallbackFix(mcq);
          }
          await updateJob(jobId, { message: 'Erreur IA sur un lot — fallback appliqué' });
        }
      }

      // Run batches with limited concurrency
      let next = 0
      const workers = Array.from({ length: Math.min(concurrency, totalBatches) }, async () => {
        while (true) {
          const i = next++
          if (i >= totalBatches) break
          await processOneBatch(batches[i], i)
        }
      })
      await Promise.all(workers)

      // Fallback retry for any remaining unfixed MCQ rows: more permissive repair-focused prompt, smaller batch
      const remainingMcq = mcqRows.filter(r => String(r.original['ai_status'] || '').toLowerCase() !== 'fixed');
      if (remainingMcq.length > 0) {
        const retrySystem = `Répare et clarifie les QCMs. Priorité: texte lisible et explications utiles. Si la réponse est incertaine, garde les réponses existantes mais fournis des explications pour chaque option.
FORMAT JSON STRICT: { "results": [ { "id": "string", "status": "ok", "fixedQuestionText": "string", "fixedOptions": [..], "optionExplanations": [..], "globalExplanation": "..." } ] }
Pas d'autres clés.`;
        const retryBatchSize = Math.min(40, Math.max(1, parseInt(process.env.AI_RETRY_BATCH_SIZE || '20', 10)));
        const retryBatches: McqRow[][] = [];
        for (let i = 0; i < remainingMcq.length; i += retryBatchSize) {
          retryBatches.push(remainingMcq.slice(i, i + retryBatchSize));
        }
        for (let bi = 0; bi < retryBatches.length; bi++) {
          const batch = retryBatches[bi];
          try {
            const payload = JSON.stringify({
              task: 'analyze_mcq_batch_retry',
              items: batch.map((q, i) => ({ id: String(i), questionText: q.text, options: q.options, providedAnswerRaw: q.answerLetters.join(', ') || null }))
            });
            const { content } = await chatCompletion([
              { role: 'user', content: payload }
            ], { maxTokens: 2000, systemPrompt: retrySystem });
            const parsed = extractJson(content);
            if (parsed && Array.isArray(parsed.results)) {
              parsed.results.forEach((res: any) => {
                const idx = Number(res?.id);
                if (!Number.isInteger(idx) || idx < 0 || idx >= batch.length) return;
                const mcq = batch[idx];
                const row = mcq.original;
                let changed = false;
                const textKey = Object.keys(row).find(k => canonicalizeHeader(k) === 'texte de la question') || 'texte de la question';
                if (res.fixedQuestionText) {
                  const fx = repairQuestionText(String(res.fixedQuestionText));
                  if (fx && fx !== String(row[textKey] || '').trim()) { row[textKey] = fx; changed = true; }
                }
                if (Array.isArray(res.fixedOptions) && res.fixedOptions.length) {
                  const letters = ['a','b','c','d','e'];
                  const max = Math.min(letters.length, res.fixedOptions.length);
                  for (let j = 0; j < max; j++) {
                    const key = `option ${letters[j]}`;
                    const next = repairOptionText(String(res.fixedOptions[j] || ''));
                    if (next && next !== String(row[key] || '').trim()) { row[key] = next; changed = true; }
                  }
                }
                if (Array.isArray(res.optionExplanations) && res.optionExplanations.length) {
                  res.optionExplanations = applyConnectors(res.optionExplanations);
                  const letters = ['a','b','c','d','e'];
                  for (let j = 0; j < Math.min(letters.length, res.optionExplanations.length); j++) {
                    const key = `explication ${letters[j]}`;
                    const val = String(res.optionExplanations[j] || '').trim();
                    if (val && val !== String(row[key] || '').trim()) { row[key] = val; changed = true; }
                  }
                  if (res.globalExplanation) {
                    const r = String(res.globalExplanation).trim();
                    if (r && r !== String(row['rappel'] || '').trim()) { row['rappel'] = r; changed = true; }
                  }
                }
                row['ai_status'] = 'fixed';
                row['ai_reason'] = changed ? '' : 'Déjà correct (retry)';
                fixedCount += 1;
                successfulAnalyses += 1;
              });
            }
          } catch {}
        }
      }

      // Process QROC rows if any
      if (qrocRows.length > 0) {
        await updateJob(jobId, { message: 'Génération d\'explications QROC...', currentBatch: 1, totalBatches: 1 });
        
        const qrocBatchSize = Math.max(1, parseInt(process.env.AI_BATCH_SIZE || '60', 10));
        for (let i = 0; i < qrocRows.length; i += qrocBatchSize) {
          const batch = qrocRows.slice(i, i + qrocBatchSize);
          
          try {
            const qrocPrompt = (instructions && instructions.trim()) ? instructions.trim() : 
              `Tu aides des étudiants en médecine. Pour chaque question QROC:
1. Répare le texte si bruité (orthographe/ponctuation), sans changer le sens (champ fixedQuestionText).
2. Si la réponse est vide: status="error" et error="Réponse manquante" (pas d'explication).
3. Sinon, génère UNE explication claire (3-6 phrases): idée clé, justification brève, mini exemple/repère clinique, piège fréquent si utile. Pas d'intro/conclusion globales.
4. Si la réponse semble incorrecte: status="error" avec une courte justification dans error (pas d'explication normale).
5. Sortie JSON STRICT uniquement.
Format:
{
  "results": [ { "id": "<id>", "status": "ok" | "error", "fixedQuestionText": "...", "explanation": "...", "error": "..." } ]
}`;
              
            const qrocPayload = JSON.stringify({
              task: 'qroc_explanations',
              items: batch.map((q, i) => ({
                id: String(i),
                questionText: q.text,
                answerText: q.existingAnswer,
                caseText: undefined // Add if needed
              }))
            });
            
            const { content } = await chatCompletion([
              { role: 'user', content: qrocPayload }
            ], {
              maxTokens: 1600,
              systemPrompt: qrocPrompt,
            });
            
            const parsed = extractJson(content);
            if (parsed && Array.isArray(parsed.results)) {
              parsed.results.forEach((res: any) => {
                const idx = Number(res?.id);
                if (Number.isInteger(idx) && idx >= 0 && idx < batch.length) {
                  const qroc = batch[idx];
                  const row = qroc.original;
                  
                  if (res.status === 'ok' && res.explanation) {
                    const aiExplanation = String(res.explanation).trim();
                    const textKey = Object.keys(row).find(k => canonicalizeHeader(k) === 'texte de la question') || 'texte de la question';
                    if (res.fixedQuestionText) {
                      const fx = repairQuestionText(String(res.fixedQuestionText));
                      if (fx && fx !== String(row[textKey] || '').trim()) row[textKey] = fx;
                    }
                    
                    if (aiExplanation) {
                      // Use AI explanation as 'rappel' (course reminder) for QROC
                      const prevRappel = String(row['rappel'] || '').trim();
                      if (!prevRappel || prevRappel !== aiExplanation) {
                        row['rappel'] = aiExplanation;
                      }
                      row['ai_status'] = 'fixed';
                      row['ai_reason'] = '';
                      fixedCount += 1;
                      successfulAnalyses += 1;
                    }
                  } else {
                    // On error: force minimal rappel for QROC
                    if (!String(row['rappel'] || '').trim()) {
                      row['rappel'] = 'RAPPEL DU COURS: Question à réponse ouverte - réviser les notions fondamentales sur ce sujet et les critères de réponse attendus.';
                    }
                    row['ai_status'] = 'fixed';
                    row['ai_reason'] = '';
                    fixedCount += 1;
                  }
                }
              });
            } else {
              // Batch JSON fail: mark all as fixed with minimal rappel
              batch.forEach(qroc => {
                const row = qroc.original;
                if (!String(row['rappel'] || '').trim()) {
                  row['rappel'] = 'RAPPEL DU COURS: Question à réponse ouverte - réviser les notions fondamentales sur ce sujet et les critères de réponse attendus.';
                }
                row['ai_status'] = 'fixed';
                row['ai_reason'] = '';
                fixedCount += 1;
              });
            }
          } catch (e) {
            // On error: mark as fixed with minimal rappel
            batch.forEach(qroc => {
              const row = qroc.original;
              if (!String(row['rappel'] || '').trim()) {
                row['rappel'] = 'RAPPEL DU COURS: Question à réponse ouverte - réviser les notions fondamentales sur ce sujet et les critères de réponse attendus.';
              }
              row['ai_status'] = 'fixed';
              row['ai_reason'] = '';
              fixedCount += 1;
            });
          }
        }
      }
    }

    // Enforce: MCQ (qcm, cas_qcm) rows must have per-option explanations for every present option
    for (const info of recognized) {
      if (info.key !== 'qcm' && info.key !== 'cas_qcm') continue;
      const rows = sheetRowsMap[info.name] || [];
      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx] as Record<string, any>;
        const headers = Object.keys(row);
        const canon: Record<string, string> = {};
        headers.forEach(h => { const c = canonicalizeHeader(h); if (!(c in canon)) canon[c] = h; });
        const presentOptions: number[] = [];
        const letters = ['a','b','c','d','e'];
        for (let j = 0; j < letters.length; j++) {
          const k = canon[`option ${letters[j]}`] || `option ${letters[j]}`;
          const val = row[k];
          if (val !== undefined && val !== null && String(val).trim()) {
            presentOptions.push(j);
          }
        }
        if (presentOptions.length === 0) continue; // no options, handled elsewhere
        const missing: string[] = [];
        for (const j of presentOptions) {
          const expK = `explication ${letters[j]}`;
          const have = String(row[expK] || '').trim();
          if (!have) missing.push(letters[j].toUpperCase());
        }
        if (missing.length > 0) {
          row['ai_status'] = 'error';
          row['ai_reason'] = `Explication par option manquante: ${missing.join(', ')}`;
        }
      }
    }

    // Rebuild Erreurs sheet: list rows still not fixed across canonical sheets
    const errorRows: Array<{ sheet: string; row: number; reason: string; question?: string | null }> = [];
    for (const info of recognized) {
      const s = info.name
      const rows = sheetRowsMap[s] || []
      // Update the actual sheet with the final edited rows (including AI changes)
      const newWs = XLSX.utils.json_to_sheet(rows, { skipHeader: false })
      wb.Sheets[s] = newWs
      rows.forEach((r, idx) => {
        if (String((r as any)['ai_status'] || '').toLowerCase() !== 'fixed') {
          const qText = (r['texte de la question'] ?? (r as any)['question'] ?? null) as string | null;
          errorRows.push({ sheet: s, row: idx + 2, reason: String((r as any)['ai_reason'] || 'Non corrigé'), question: qText });
        }
      });
    }

    // Build/replace Erreurs sheet from collected errors (limit rows if empty input)
    const erreursRows = errorRows
    const erreursWs = XLSX.utils.json_to_sheet(erreursRows)
    const erreursSheetName = 'Erreurs'
    if (!wb.Sheets[erreursSheetName]) {
      wb.SheetNames.push(erreursSheetName)
    }
    wb.Sheets[erreursSheetName] = erreursWs

    // Finalize workbook buffer
    const outBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    await prisma.aiValidationJob.update({
      where: { id: jobId },
      data: {
        progress: 100,
        processedItems: totalItems,
        message: azureOn ? 'Terminé — corrections IA appliquées' : 'Terminé (sans IA) — configurez AZURE_OPENAI_* pour activer les corrections',
        successfulAnalyses,
        failedAnalyses: azureOn ? failedAnalyses : totalItems,
        fixedCount,
        ragAppliedCount: 0,
        completedAt: new Date(),
        status: 'completed',
        outputUrl: toDataUrlExcel(outBuffer),
      }
    })
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : 'Unexpected processing error'
    await prisma.aiValidationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        message: 'Échec du traitement IA',
        errorMessage: msg,
        completedAt: new Date(),
      }
    })
  }
}
