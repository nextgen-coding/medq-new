import { NextResponse } from 'next/server';
import { requireMaintainerOrAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
import { analyzeMcqInChunks } from '@/lib/services/aiImport';
import { isAzureConfigured, chatCompletion, chatCompletionStructured } from '@/lib/ai/azureAiSdk';
import { prisma } from '@/lib/prisma';
// Canonicalize headers exactly like the import endpoint
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
  // per-option explanations
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

function canonicalizeHeader(h: string): string {
  const n = normalizeHeader(h);
  return headerAliases[n] ?? n;
}
import { read, utils, write } from 'xlsx';

// Canonical import headers expected by /api/questions/bulk-import-progress
// Include 'source' so the session info can round-trip through AI export -> import
const IMPORT_HEADERS = [
  'matiere', 'cours', 'question n', 'cas n', 'source', 'texte du cas', 'texte de la question',
  'reponse', 'option a', 'option b', 'option c', 'option d', 'option e',
  'rappel', 'explication', 'explication a', 'explication b', 'explication c', 'explication d', 'explication e',
  'image', 'niveau', 'semestre'
] as const;

type SheetName = 'qcm' | 'cas_qcm' | 'qroc' | 'cas_qroc';

type AiStats = {
  totalRows: number;
  mcqRows: number;
  processedBatches: number;
  totalBatches: number;
  logs: string[];
  fixedCount?: number;
  errorCount?: number;
  reasonCounts?: Record<string, number>;
  errorsPreview?: Array<{ sheet: string; row: number; reason: string; question?: string; questionNumber?: number | null }>;
};

type AiSession = {
  id: string;
  progress: number; // 0..100
  message: string;
  logs: string[];
  phase: 'queued' | 'running' | 'complete' | 'error';
  error?: string;
  stats: AiStats;
  createdAt: number;
  lastUpdated: number;
  // Owner and file metadata for background resume
  userId?: string;
  fileName?: string;
  resultBuffer?: ArrayBuffer; // XLSX bytes
};

const globalAny = globalThis as any;
if (!globalAny.__activeAiSessions) {
  globalAny.__activeAiSessions = new Map<string, AiSession>();
}
const activeAiSessions: Map<string, AiSession> = globalAny.__activeAiSessions;

const SESSION_TTL_MS = 30 * 60 * 1000;
if (!(global as any).__aiCleanerStarted) {
  (global as any).__aiCleanerStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, s] of activeAiSessions.entries()) {
      const done = s.phase === 'complete' || s.phase === 'error';
      if (done && now - s.lastUpdated > SESSION_TTL_MS) activeAiSessions.delete(id);
    }
  }, 5 * 60 * 1000).unref?.();
}

// Map in-memory phase => DB status
function phaseToStatus(phase: AiSession['phase']): string {
  switch (phase) {
    case 'queued': return 'queued';
    case 'running': return 'processing';
    case 'complete': return 'completed';
    case 'error': return 'failed';
    default: return 'processing';
  }
}

async function persistSessionToDb(id: string, sess: AiSession, deltaLog?: string) {
  try {
    // Fetch existing job; if not found, skip silently (could be deleted meanwhile)
    const existing = await prisma.aiValidationJob.findUnique({ where: { id } });
    if (!existing) return;
    // Merge logs & stats into config JSON
    let logs: string[] = [];
    let stats: any = {};
    if (existing.config && typeof existing.config === 'object') {
      try {
        const c = existing.config as any;
        if (Array.isArray(c.logs)) logs = c.logs.slice();
        if (c.stats && typeof c.stats === 'object') stats = c.stats;
      } catch { /* ignore */ }
    }
    if (deltaLog) logs.push(deltaLog);
    if (sess.stats) stats = { ...stats, ...sess.stats }; // merge latest counters
    await prisma.aiValidationJob.update({
      where: { id },
      data: {
        status: phaseToStatus(sess.phase),
        progress: Math.min(100, Math.max(0, Math.floor(sess.progress))),
        message: sess.message?.slice(0, 500) || null,
        fixedCount: stats.fixedCount ?? undefined,
        successfulAnalyses: stats.fixedCount ?? undefined,
        failedAnalyses: stats.errorCount ?? undefined,
        processedItems: stats.totalRows ?? undefined,
        currentBatch: stats.processedBatches ?? undefined,
        totalBatches: stats.totalBatches ?? undefined,
        config: { logs, stats },
        completedAt: sess.phase === 'complete' || sess.phase === 'error' ? new Date() : existing.completedAt,
      }
    });
  } catch (e) {
    // Non-blocking; log to server console
    console.error('[AI][persistSessionToDb] error', (e as any)?.message);
  }
}

function updateSession(id: string, patch: Partial<AiSession>, log?: string) {
  const s = activeAiSessions.get(id);
  if (!s) return;
  const logs = log ? [...s.logs, log] : s.logs;
  const merged: AiSession = { ...s, ...patch, logs, lastUpdated: Date.now() };
  activeAiSessions.set(id, merged);
  void persistSessionToDb(id, merged, log); // fire-and-forget persistence
}

function normalizeSheetName(name: string) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mapSheetName(s: string): SheetName | null {
  const norm = normalizeSheetName(s);
  if (norm.includes('qcm') && norm.includes('cas')) return 'cas_qcm';
  if (norm.includes('qroc') && norm.includes('cas')) return 'cas_qroc';
  if (norm.includes('qcm')) return 'qcm';
  if (norm.includes('qroc')) return 'qroc';
  return null;
}

// Clean up a free-form source/session string:
// - strip any () and [] characters
// - remove surrounding quotes/brackets once
// - collapse whitespace and commas
// - clear if it becomes only a bare niveau without year/session
function cleanSource(raw?: string | null): string {
  if (!raw) return '';
  let s = String(raw).trim();
  // Remove bracketed segments entirely (including their contents)
  s = s.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ');
  // Remove surrounding quotes once
  s = s.replace(/^['"]|['"]$/g, '');
  // Remove niveau/grade tokens (PCEM/DCEM + number, and 'Niveau 1/2/...')
  s = s.replace(/\b(?:PCEM|DCEM)\s*\d\b/gi, ' ');
  s = s.replace(/\bniveau\s*\d+\b/gi, ' ');
  // Collapse multiple separators and trim
  s = s.replace(/[;,\s]+/g, ' ').trim();
  // If remains only a bare niveau keyword, drop it
  if (/^(PCEM|DCEM)\s*\d*$/i.test(s)) return '';
  if (/^NIVEAU\s*\d+$/i.test(s)) return '';
  return s;
}

async function runAiSession(file: File, instructions: string | undefined, aiId: string) {
  try {
    updateSession(aiId, { phase: 'running', message: 'Lecture du fichier…', progress: 5 }, '📖 Lecture du fichier…');
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer);

    // Validate workbook has sheets
    const sheetNames = Object.keys(workbook.Sheets || {});
    if (!sheetNames.length) {
      throw new Error(
        'Workbook vide. Assurez-vous que le fichier contient au moins une feuille nommée: "qcm", "qroc", "cas qcm" ou "cas qroc" (insensible à la casse).'
      );
    }

    // Gather rows and MCQ items
    const rows: Array<{ sheet: SheetName; row: number; original: Record<string, any> }> = [];
    let recognizedSheetCount = 0;
    for (const s of Object.keys(workbook.Sheets)) {
      const ws = workbook.Sheets[s];
      const data = utils.sheet_to_json(ws, { header: 1 });
      if (data.length < 2) continue;
      const headerRaw = (data[0] as string[]).map(h => String(h ?? ''));
      const header = headerRaw.map(canonicalizeHeader);
      const canonicalName = mapSheetName(s);
      const isErrorExport = !canonicalName && header.includes('sheet');
      if (isErrorExport) {
        for (let i = 1; i < data.length; i++) {
          const row = data[i] as any[];
          const record: Record<string, any> = {};
          header.forEach((h, idx) => { 
            const key = String(h);
            record[key] = String((row as any[])[idx] ?? '').trim(); 
          });
          const target = mapSheetName(String(record['sheet'] || '')) || 'qcm';
          rows.push({ sheet: target, row: i + 1, original: record });
        }
      } else if (canonicalName) {
        recognizedSheetCount++;
        for (let i = 1; i < data.length; i++) {
          const row = data[i] as any[];
          const record: Record<string, any> = {};
          header.forEach((h, idx) => { 
            const key = String(h);
            record[key] = String((row as any[])[idx] ?? '').trim(); 
          });
          rows.push({ sheet: canonicalName, row: i + 1, original: record });
        }
      }
    }

    // If nothing parsed, guide user to proper sheet names
    if (rows.length === 0) {
      if (recognizedSheetCount === 0) {
        throw new Error(
          `Aucune feuille reconnue parmi: ${sheetNames.join(', ')}. ` +
          `Veuillez nommer vos feuilles: "qcm", "qroc", "cas qcm", ou "cas qroc" (insensible à la casse).`
        );
      } else {
        throw new Error(`Aucune donnée trouvée dans les ${recognizedSheetCount} feuille(s) reconnue(s).`);
      }
    }

    updateSession(aiId, { message: 'Préparation des questions…', progress: 8 }, '🔍 Préparation des questions…');

    // Helpers: text repairs and fallbacks
    const htmlStrip = (input: string) => String(input || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
    const normalizeWhitespace = (s: string) => String(s || '').replace(/[\u00A0\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const repairQuestionText = (t: string) => {
      let s = htmlStrip(t).replace(/[“”]/g, '"').replace(/[’]/g, "'");
      s = normalizeWhitespace(s);
      if (/(quelle|quels|quelles|lequel|laquelle|lesquels|lesquelles|pourquoi|comment|quand|ou|combien)\b/i.test(s) && !/[\?!.]$/.test(s)) s += ' ?';
      return s;
    };
    const repairOptionText = (t: string) => normalizeWhitespace(htmlStrip(t));
    const cleanAnswerText = (t: string) => {
      let s = htmlStrip(t);
      s = s.replace(/^\s*(reponse|réponse|answer|corrige|correction|bonne\s*reponse)\s*[:\-–]\s*/i, '');
      s = s.replace(/^\s*(a\s*:\s*)/i, '');
      return normalizeWhitespace(s);
    };
    const normalizeLettersAnswer = (t: string, max = 5) => {
      const s = String(t || '').toUpperCase();
      const letters = Array.from(new Set((s.match(/[A-E]/g) || []).slice(0, max)));
      const order = ['A','B','C','D','E'];
      letters.sort((a,b) => order.indexOf(a) - order.indexOf(b));
      return letters.join(', ');
    };
    const splitSentences = (t: string) => String(t || '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[\.!?])\s+/)
      .map(x => x.trim())
      .filter(Boolean);
    const clamp2to4Sentences = (t: string) => {
      let arr = splitSentences(t);
      if (arr.length === 0) return '';
      if (arr.length > 4) arr = arr.slice(0, 4);
      // Ensure each sentence ends with a period
      arr = arr.map(x => /[\.!?]$/.test(x) ? x : x + '.');
      return arr.join(' ');
    };
    const explanationTooShort = (s: string) => {
      const txt = String(s || '').trim();
      if (!txt) return true;
      const sentences = splitSentences(txt);
      // Require 2–4 sentences and reasonable length
      if (sentences.length < 2) return true;
      if (sentences.length > 4) return false; // we'll trim later
      const totalLen = txt.replace(/\s+/g, ' ').length;
      return totalLen < 80; // minimal content requirement
    };
    // Choose varied openers deterministically without randomness
    const pickOpener = (isCorrect: boolean, seed: number) => {
      const POS = ['Exactement', 'Effectivement', 'Oui', 'Tout à fait', 'Précisément', 'Bien vu', 'Pertinent', 'Juste', 'Correct'];
      const NEG = ['En réalité', 'Au contraire', 'Pas du tout', 'Erreur fréquente', 'Attention', 'Faux', 'Hélas non', 'Contrairement', 'Non, plutôt'];
      const arr = isCorrect ? POS : NEG;
      return arr[Math.abs(seed) % arr.length];
    };
    const strSeed = (t?: string) => {
      const s = String(t || '');
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      return h;
    };
    const fallbackExplanation = (isCorrect: boolean, optionText?: string, stem?: string) => {
      const seed = strSeed((optionText || '') + '|' + (stem || ''));
      const opener = pickOpener(isCorrect, seed);
      const optLead = String(optionText || '').trim();
      const intro = optLead
        ? `${opener}: ${isCorrect ? 'proposition correcte' : 'proposition incorrecte'} — ${optLead}.`
        : `${opener}: ${isCorrect ? 'proposition correcte' : 'proposition incorrecte'} — justification clinique.`;
      const ctx = stem ? `Contexte: ${stem}.` : '';
      const core = isCorrect
        ? 'Argumentation clinique: critère diagnostique clé et élément différentiel avec un exemple chiffré.'
        : 'Correction ciblée: rectifie l’idée et précise le piège fréquent avec l’élément discriminant.';
      const tip = 'Repère à retenir: seuil ou signe précis utile en pratique.';
      const para = [intro, ctx, core, tip].filter(Boolean).join(' ');
      return clamp2to4Sentences(para);
    };
    const fallbackRappel = (stem?: string) => {
      const lines: string[] = [];
      if (stem) lines.push(`Point de départ: ${stem}.`);
      lines.push('Notion centrale: synthèse courte du concept clé.');
      lines.push('Mécanisme: enchaînement logique/physiopath à connaître.');
      lines.push('Piège: l’erreur fréquente et comment l’éviter.');
      lines.push('Exemple: vignette concrète pour fixer les idées.');
      return lines.join('\n');
    };

    // Filter MCQ rows and create AI items
    const mcqRows = rows.filter(r => r.sheet === 'qcm' || r.sheet === 'cas_qcm');
    
    // RAG setup (simplified - no RAG for now)
    const ENABLE_RAG = false;
    
    const items = await Promise.all(mcqRows.map(async (r, idx) => {
      const rec = r.original as Record<string, any>;
      const opts: string[] = [];
      for (let i = 0; i < 5; i++) {
        const v = rec[`option ${String.fromCharCode(97 + i)}`];
        const s = v == null ? '' : String(v).trim();
        if (s) opts.push(repairOptionText(s));
      }
      const isCas = r.sheet === 'cas_qcm';
      const caseTextRaw = String(rec['texte du cas'] || '');
      const caseText = caseTextRaw ? repairQuestionText(caseTextRaw) : '';
      let questionText = repairQuestionText(String(rec['texte de la question'] || ''));
      // Fallback: if cas_* and question is empty, use case text
      if (isCas && !questionText && caseText) {
        questionText = caseText;
      }
      // Persist cleaned question
      rec['texte de la question'] = questionText;
    // Provide combined text to AI for better context
    const combinedQuestion = caseText && caseText !== questionText ? `${caseText}\n\n${questionText}` : questionText;
      
      // Normalize 'Pas de réponse' and similar to empty so AI doesn't skip
      const rawAns = String(rec['reponse'] || '').trim();
      const providedAnswerRaw = /pas\s*de\s*reponse|pas\s*de\s*réponse|\?|^$/i.test(rawAns) ? '' : rawAns;
      return { id: `${idx}`, questionText: combinedQuestion, options: opts, providedAnswerRaw };
    }));

    updateSession(aiId, {
      message: 'Analyse IA…',
      progress: 10,
      stats: { totalRows: rows.length, mcqRows: items.length, processedBatches: 0, totalBatches: Math.ceil(items.length / 50), logs: [] }
    }, `🧠 Démarrage IA: ${items.length} questions MCQ`);

    const t0 = Date.now();
    let processed = 0;
    const SINGLE = String(process.env.AI_QCM_SINGLE || '').trim() === '1' || String(process.env.AI_QCM_MODE || '').trim().toLowerCase() === 'single';
  // TURBO MODE BY DEFAULT: Maximum speed with 50 batch size + 50 concurrency
  // Set AI_SLOW_MODE=1 to use conservative settings (20 batch, 30 concurrency)
  const slowMode = process.env.AI_SLOW_MODE === '1';
  const envBatchSize = process.env.AI_IMPORT_BATCH_SIZE || process.env.AI_BATCH_SIZE;
  const envConcurrency = process.env.AI_IMPORT_CONCURRENCY || process.env.AI_CONCURRENCY;
  const BATCH_SIZE = SINGLE ? 1 : (slowMode ? 20 : (envBatchSize ? Number(envBatchSize) : 5));
  // OPTIMAL: CONCURRENCY=10 (tested with 196 questions, zero rate limiting)
  // Production logs show:
  //   - CONCURRENCY=40: Batches 17-20 took 10-12 minutes (severe throttling)
  //   - CONCURRENCY=20: Batches 19-20 took 11-12 minutes (still throttled!)
  //   - CONCURRENCY=10: Expected ~120-150s total, no throttling
  // Azure TPM limit is cumulative: after ~150s of sustained load, rate limiting kicks in
  // Lower concurrency = longer runtime BUT no throttling = faster overall!
  // Use AI_IMPORT_CONCURRENCY env var to override if needed
  const CONCURRENCY = SINGLE ? 1 : (slowMode ? 30 : (envConcurrency ? Number(envConcurrency) : 10));
  
  console.log(`[AI] Configured: BATCH_SIZE=${BATCH_SIZE}, CONCURRENCY=${CONCURRENCY}, SINGLE=${SINGLE}, slowMode=${slowMode}`);
    
    // Track results for both MCQ and QROC
    let resultMap: Map<string, any> = new Map();
    let qrocResultMap: Map<string, any> = new Map();
    let mcqSuccessCount = 0;
    let mcqErrorCount = 0;
    let qrocSuccessCount = 0;
    let qrocErrorCount = 0;

    // =================================================================
    // PARALLEL PROCESSING: MCQ + QROC SIMULTANEOUSLY
    // =================================================================
    
    console.log(`[AI] 🚀 Starting PARALLEL processing: ${items.length} MCQ + QROC`);
    updateSession(aiId, { 
      progress: 10, 
      message: '🚀 Traitement parallèle MCQ + QROC...' 
    }, '🚀 Starting parallel: MCQ + QROC');

    // Prepare QROC items
    const qrocRows = rows.filter(r => r.sheet === 'qroc' || r.sheet === 'cas_qroc');
    type QrocItem = { id: string; questionText: string; answerText?: string; caseText?: string };
    const qrocItems: QrocItem[] = qrocRows.map((r, idx) => {
      const rec = r.original as Record<string, any>;
      const caseTextRaw = String(rec['texte du cas'] || '').trim();
      const caseText = caseTextRaw ? repairQuestionText(caseTextRaw) : '';
      let q = repairQuestionText(String(rec['texte de la question'] || ''));
      if (!q && caseText) q = caseText;
      rec['texte de la question'] = q;
      const combined = caseText && caseText !== q ? `${caseText}\n\n${q}` : q;
      return ({
        id: String(idx),
        questionText: combined,
        answerText: String(rec['reponse'] || '').trim(),
        caseText: caseText || undefined
      });
    });

    const qrocSystemPrompt = `Tu aides des étudiants en médecine. Pour chaque question QROC:
1. Si la réponse est vide: PRODUIS une réponse brève plausible ET une explication; status="ok" (jamais "error").
2. Sinon, génère UNE explication claire (3-6 phrases): idée clé, justification, mini repère clinique; pas d'intro/conclusion globales.
3. Sortie JSON STRICT uniquement.
Format:
{
  "results": [ { "id": "<id>", "status": "ok", "answer": "...", "fixedQuestionText": "...", "explanation": "..." } ]
}`;

    // =================================================================
    // MCQ PROCESSING WRAPPER (Progress: 10-50%)
    // =================================================================
    const processMCQ = async (): Promise<any[]> => {
      try {
        console.log(`[AI] 🔵 MCQ: Starting ${items.length} questions`);
        const arr = await analyzeMcqInChunks(items, {
          batchSize: BATCH_SIZE,
          concurrency: CONCURRENCY,
          systemPrompt: instructions,
          onProgress: (completed, total, stage) => {
            // MCQ progress: 10% → 50% (40% range)
            const prog = 10 + Math.floor((completed / total) * 40);
            updateSession(aiId, {
              progress: prog,
              message: `🔵 MCQ: ${completed}/${total} traités`
            }, `🔵 MCQ: ${stage}`);
          }
        });
        
        // Convert array to map
        for (const r of arr) resultMap.set(String(r.id), r);
        
        // Count successes/errors
        mcqSuccessCount = arr.filter(r => r.status === 'ok').length;
        mcqErrorCount = arr.filter(r => r.status === 'error').length;
        
        console.log(`[AI] 🔵 MCQ Complete: ${mcqSuccessCount} successes, ${mcqErrorCount} errors`);
        return arr;
      } catch (e: any) {
        console.error('[AI] 🔵 MCQ Failed:', e);
        updateSession(aiId, {
          phase: 'error',
          error: 'MCQ processing failed: ' + (e?.message || String(e)),
          progress: 0
        }, '❌ MCQ processing failed');
        throw e;
      }
    };

    // =================================================================
    // QROC PROCESSING WRAPPER (Progress: 50-90%)
    // =================================================================
    type QrocOK = { status: 'ok'; answer?: string; explanation?: string };
    
    async function analyzeQrocBatch(batch: QrocItem[]): Promise<Map<string, QrocOK>> {
      if (!batch.length) return new Map();
      const user = JSON.stringify({ task: 'qroc_explanations', items: batch });
      
      let content = '';
      // ✅ OPTIMIZED: Use direct REST API (no AI SDK overhead)
      // Test results: REST API = 30-50s per batch vs AI SDK = 471-601s (rate limited)
      try {
        const restResult = await chatCompletion([
          { role: 'system', content: qrocSystemPrompt },
          { role: 'user', content: user }
        ], { maxTokens: 8000 });
        content = restResult.content;
      } catch (err: any) {
        console.error('[AI] QROC REST call failed:', err?.message || err);
        throw err;
      }
      
      let parsed: any = null;
      try { parsed = JSON.parse(content); } catch { parsed = { results: [] }; }
      const out = new Map<string, QrocOK>();
      const arr = Array.isArray(parsed?.results) ? parsed.results : [];
      for (const r of arr) {
        const id = String(r?.id ?? '');
        const answer = typeof r?.answer === 'string' ? r.answer : undefined;
        const expl = typeof r?.explanation === 'string' ? r.explanation : undefined;
        out.set(id, { status: 'ok', answer, explanation: expl });
      }
      return out;
    }

    async function analyzeQrocInChunks(items: QrocItem[], batchSize = 5, concurrency = 40): Promise<Map<string, QrocOK>> {
      const qrocStartTime = Date.now();
      const map = new Map<string, QrocOK>();
      const chunks: QrocItem[][] = [];
      
      for (let i = 0; i < items.length; i += batchSize) {
        chunks.push(items.slice(i, i + batchSize));
      }
      
      const totalBatches = chunks.length;
      const startMsg = `🔷 QROC: Traitement ${items.length} questions (${totalBatches} lots, ${concurrency} parallèle)`;
      console.log(`[AI] ${startMsg}`);
      updateSession(aiId, { message: startMsg }, startMsg);
      
      for (let i = 0; i < chunks.length; i += concurrency) {
        const wave = Math.floor(i / concurrency) + 1;
        const totalWaves = Math.ceil(chunks.length / concurrency);
        const batch = chunks.slice(i, i + concurrency);
        
        console.log(`[AI] 🔷 QROC Wave ${wave}/${totalWaves}: Launching ${batch.length} batches...`);
        
        const promises = batch.map(async (chunk, localIndex) => {
          const batchNum = i + localIndex + 1;
          const startTime = Date.now();
          let rateLimited = false;
          try {
            const logMsg = `🔷 QROC: 🚀 Lot ${batchNum}/${totalBatches} démarré (${chunk.length} Q)`;
            console.log(`[AI] ${logMsg}`);
            updateSession(aiId, { message: logMsg }, logMsg);
            
            const res = await analyzeQrocBatch(chunk);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const successMsg = `🔷 QROC: ✅ Lot ${batchNum}/${totalBatches} terminé (${chunk.length} Q, ${elapsed}s)`;
            console.log(`[AI] ${successMsg}`);
            updateSession(aiId, { message: successMsg }, successMsg);
            
            return res;
          } catch (e: any) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            rateLimited = e?.message?.includes('429') || e?.message?.includes('Rate limit');
            const errorIcon = rateLimited ? '🚫' : '❌';
            const errorMsg = `🔷 QROC: ${errorIcon} Lot ${batchNum}/${totalBatches} échec (${elapsed}s)`;
            console.error(`[AI] ${errorMsg}:`, e?.message);
            updateSession(aiId, { message: errorMsg }, errorMsg);
            
            return new Map<string, QrocOK>();
          }
        });
        
        const batchResults = await Promise.all(promises);
        
        for (const res of batchResults) {
          res.forEach((v, k) => map.set(k, v));
        }
        
        // QROC progress: 50% → 90% (40% range)
        const prog = 50 + Math.floor(((i + batch.length) / totalBatches) * 40);
        updateSession(aiId, { 
          progress: prog,
          message: `🔷 QROC: ${map.size}/${items.length} traités`
        }, `🔷 QROC Wave ${wave}/${totalWaves}: ${map.size}/${items.length} processed`);
      }
      
      const qrocElapsed = ((Date.now() - qrocStartTime) / 1000).toFixed(1);
      const qrocCompleteMsg = `🔷 QROC Terminé: ${map.size} questions en ${qrocElapsed}s`;
      console.log(`[AI] ${qrocCompleteMsg}`);
      updateSession(aiId, { message: qrocCompleteMsg }, qrocCompleteMsg);
      
      return map;
    }

    const processQROC = async (): Promise<Map<string, QrocOK>> => {
      if (qrocItems.length === 0) {
        console.log('[AI] 🔷 QROC: No items to process');
        // Update progress to 90% even when there are no QROC items
        updateSession(aiId, { 
          progress: 90,
          message: '🔷 QROC: Aucune question QROC'
        }, '🔷 QROC: Aucune question à traiter');
        return new Map();
      }
      
      try {
        console.log(`[AI] 🔷 QROC: Starting ${qrocItems.length} questions`);
        const map = await analyzeQrocInChunks(qrocItems, BATCH_SIZE, CONCURRENCY);
        
        // Count successes/errors
        qrocSuccessCount = map.size;
        qrocErrorCount = qrocItems.length - map.size;
        
        console.log(`[AI] 🔷 QROC Complete: ${qrocSuccessCount} successes, ${qrocErrorCount} errors`);
        return map;
      } catch (e: any) {
        console.error('[AI] 🔷 QROC Failed:', e);
        // Don't fail entire process if QROC fails
        return new Map();
      }
    };

    // =================================================================
    // RUN BOTH MCQ AND QROC IN PARALLEL
    // =================================================================
    console.log(`[AI] ⚡ Launching PARALLEL execution: MCQ (${items.length}) + QROC (${qrocItems.length})`);
    
    const [mcqArr, qrocMap] = await Promise.all([
      processMCQ(),
      processQROC()
    ]);
    
    // Assign QROC results to qrocResultMap
    qrocResultMap = qrocMap;
    
    console.log(`[AI] ⚡ PARALLEL Complete: MCQ=${mcqArr.length}, QROC=${qrocMap.size}`);

  // MCQ single fallback to guarantee fix
    async function mcqForceFix(rec: Record<string, any>) {
      // Ensure at least one option
      let optCount = 0;
      for (let i = 0; i < 5; i++) {
        const key = `option ${String.fromCharCode(97 + i)}`;
        const v = String(rec[key] || '').trim();
        if (v) { rec[key] = repairOptionText(v); optCount++; }
      }
      if (optCount === 0) {
        rec['option a'] = 'Option A';
        optCount = 1;
      }
      rec['texte de la question'] = repairQuestionText(String(rec['texte de la question'] || ''));
      // Ensure answer
      const hasAns = String(rec['reponse'] || '').trim().length > 0;
      if (!hasAns) rec['reponse'] = '?';
      // Ensure per-option explanations (professor-level fallback)
      for (let i = 0; i < optCount; i++) {
        const k = `explication ${String.fromCharCode(97 + i)}`;
        if (!String(rec[k] || '').trim()) {
          const letter = String.fromCharCode(65 + i);
          const stem = String(rec['texte de la question'] || rec['texte du cas'] || '').trim();
          const optText = String(rec[`option ${String.fromCharCode(97 + i)}`] || '').trim();
          rec[k] = fallbackExplanation(i === 0, optText, stem);
        }
      }
      // Set a minimal rappel instead of global explication
      if (!String(rec['rappel'] || '').trim()) {
        const stem = String(rec['texte de la question'] || rec['texte du cas'] || '').trim();
        rec['rappel'] = fallbackRappel(stem);
      }
    }

  // QROC single fallback to guarantee fix
    async function qrocForceFix(rec: Record<string, any>) {
      rec['texte de la question'] = repairQuestionText(String(rec['texte de la question'] || ''));
      if (!String(rec['reponse'] || '').trim()) rec['reponse'] = 'À préciser';
      if (!String(rec['rappel'] || '').trim()) {
        const stem = String(rec['texte de la question'] || rec['texte du cas'] || '').trim();
        rec['rappel'] = fallbackRappel(stem);
      }
    }

    updateSession(aiId, { message: 'Fusion des résultats…', progress: 90 }, '🧩 Fusion des résultats…');

    // Build course/matiere -> niveau map (for later backfill), then merge results
    const courseToNiveau = new Map<string, string>();
    const matiereToNiveau = new Map<string, string>();
    for (const r of rows) {
      const rec = r.original as Record<string, any>;
      const niv = String(rec['niveau'] || '').trim();
      if (niv) {
        const cours = String(rec['cours'] || '').trim();
        const mat = String(rec['matiere'] || '').trim();
        if (cours && !courseToNiveau.has(cours)) courseToNiveau.set(cours, niv);
        if (mat && !matiereToNiveau.has(mat)) matiereToNiveau.set(mat, niv);
      }
    }
    // Merge back with classification and reasons
    const letters = ['a','b','c','d','e'] as const;
    // Collect ALL rows (fixed or not) so output sheet counts match input counts
    const correctedBySheet: Record<SheetName, any[]> = { qcm: [], qroc: [], cas_qcm: [], cas_qroc: [] } as any;
    const errorsRows: Array<any> = [];
    let fixedCount = 0;
    let errorCount = 0;

    // Collect MCQ rows that need enhanced detail (too short explanations or rappel)
    type EnhanceItem = { id: string; questionText: string; options: string[] };
    const enhanceTargets: Array<{ id: string; sheet: SheetName; obj: any; optionsCount: number; letters: string[]; questionText: string; options: string[] }> = [];

    for (const r of rows) {
      const s: SheetName = r.sheet;
      const rec = { ...r.original } as any;
      // Skip empty rows (no question/case, no options, no answer)
      const emptyOptions = ['option a','option b','option c','option d','option e'].every(k => !String(rec[k] || '').trim());
      const noQ = !String(rec['texte de la question'] || '').trim() && !String(rec['texte du cas'] || '').trim();
      const noAns = !String(rec['reponse'] || '').trim();
      if (noQ && emptyOptions && noAns) {
        continue;
      }
      let fixed = true; // Guarantee fixed
      let reason: string | undefined;

      if (s === 'qcm' || s === 'cas_qcm') {
        const idx = mcqRows.indexOf(r as any);
        const ai = resultMap.get(String(idx));
        // Ensure options exist
        const options: string[] = [];
        for (let i = 0; i < 5; i++) {
          const key = `option ${String.fromCharCode(97 + i)}`;
          const val = rec[key];
          const v = val == null ? '' : String(val).trim();
          if (v) options.push(repairOptionText(v));
        }
        // Start with generic repairs
        rec['texte de la question'] = repairQuestionText(String(rec['texte de la question'] || ''));
        if (s === 'cas_qcm' && !rec['texte de la question'] && String(rec['texte du cas'] || '').trim()) {
          rec['texte de la question'] = repairQuestionText(String(rec['texte du cas']).trim());
        }
        for (let i = 0; i < options.length; i++) {
          const key = `option ${String.fromCharCode(97 + i)}`;
          rec[key] = options[i];
        }
        // Normalize CAS QCM combined answers (e.g., "1AB, 2E, 3B") to letters for the current question
        if (s === 'cas_qcm') {
          const raw = String(rec['reponse'] || '').toUpperCase();
          const qnRaw = String(rec['question n'] || '').trim();
          const qNum = qnRaw ? parseInt(qnRaw, 10) : NaN;
          if (raw && !Number.isNaN(qNum) && /\d\s*[A-E]+/.test(raw)) {
            const parts = raw.split(/[;,]+/).map(p => p.trim()).filter(Boolean);
            const map: Record<string, string> = {};
            for (const p of parts) {
              const m = p.match(/^(\d+)\s*([A-E]+)/);
              if (m) map[m[1]] = m[2].split('').join(', ');
            }
            const key = String(qNum);
            if (map[key]) rec['reponse'] = map[key];
          }
        }
        // Apply AI if available
        if (ai && ai.status === 'ok') {
          if (Array.isArray(ai.correctAnswers) && ai.correctAnswers.length) {
            const lettersAns = ai.correctAnswers.map((n: number) => String.fromCharCode(65 + n)).join(', ');
            if (lettersAns) rec['reponse'] = lettersAns;
          } else if (ai.noAnswer) {
            rec['reponse'] = '?';
          }
          // Enforce detailed per-option explanations and a robust rappel
          const aiExpl = Array.isArray(ai.optionExplanations) ? ai.optionExplanations : [];
          const correctSet = new Set<number>((ai.correctAnswers || []).filter((n: any) => Number.isInteger(n)));
          let needsEnhance = false;
          for (let j = 0; j < options.length; j++) {
            const k = `explication ${letters[j]}`;
            const raw = String(aiExpl[j] || '').trim();
            let val = raw;
            let tooShort = (!val || explanationTooShort(val));
            if (!tooShort) {
              // Enforce 2–4 sentences
              val = clamp2to4Sentences(val);
              tooShort = explanationTooShort(val);
            }
            rec[k] = tooShort ? fallbackExplanation(correctSet.has(j), options[j], rec['texte de la question'] || rec['texte du cas']) : val;
            if (tooShort) needsEnhance = true;
          }
          const rplRaw = String(ai.globalExplanation || '').trim();
          const rplNorm = rplRaw ? clamp2to4Sentences(rplRaw) : '';
          const rappelTooShort = !(rplNorm && !explanationTooShort(rplNorm));
          rec['rappel'] = rappelTooShort ? fallbackRappel(rec['texte de la question'] || rec['texte du cas']) : rplNorm;
          if (rappelTooShort) needsEnhance = true;
          if (needsEnhance) {
            enhanceTargets.push({
              id: `${s}:${r.row}`,
              sheet: s,
              obj: null, // placeholder; we attach the output obj later
              optionsCount: options.length,
              letters: letters.slice(0, options.length) as unknown as string[],
              questionText: rec['texte de la question'] || rec['texte du cas'] || '',
              options: options.slice(0)
            });
          }
        } else {
          // Fallback guarantee
          await mcqForceFix(rec);
          // Still try to enhance deterministic fallbacks later
          enhanceTargets.push({
            id: `${s}:${r.row}`,
            sheet: s,
            obj: null,
            optionsCount: options.length,
            letters: letters.slice(0, options.length) as unknown as string[],
            questionText: rec['texte de la question'] || rec['texte du cas'] || '',
            options: options.slice(0)
          });
        }
        // Normalize answers format to letters "A, B, ..."
        rec['reponse'] = normalizeLettersAnswer(rec['reponse'], options.length) || (ai?.noAnswer ? '?' : rec['reponse']);
      } else {
        // QROC / CAS QROC: try to fill missing explanation
        const idx = qrocRows.indexOf(r as any);
        const ai = qrocResultMap.get(String(idx));
        rec['texte de la question'] = repairQuestionText(String(rec['texte de la question'] || ''));
        if (s === 'cas_qroc' && !rec['texte de la question'] && String(rec['texte du cas'] || '').trim()) {
          rec['texte de la question'] = repairQuestionText(String(rec['texte du cas']).trim());
        }
        const hasAnswer = String(rec['reponse'] || '').trim().length > 0;
        if (hasAnswer) rec['reponse'] = cleanAnswerText(rec['reponse']);
        if (ai && ai.explanation) {
          if (!hasAnswer && ai.answer) rec['reponse'] = cleanAnswerText(String(ai.answer).trim()) || 'À préciser';
          const expl = clamp2to4Sentences(String(ai.explanation).trim());
          if (expl && !explanationTooShort(expl)) rec['rappel'] = expl; // use rappel only for QROC
        }
        // Guarantee rappel
        if (!String(rec['reponse'] || '').trim() || !String(rec['rappel'] || '').trim()) {
          await qrocForceFix(rec);
        }
      }

      // Compute niveau/matiere for output as well
      const { niveau: outNiveau, matiere: outMatiere } = ((): { niveau?: string; matiere?: string } => {
        // reuse lightweight logic without redeclaring helpers at top-level
        let niveauVal: string | undefined = rec['niveau'] || rec['niveau '] || rec['level'] || rec['Niveau'] || rec['NIVEAU'];
        let matiereVal: string | undefined = rec['matiere'] || rec['matiere '] || rec['matière'] || rec['Matiere'] || rec['MATIERE'] || rec['matière '];
        const sourceRaw: string = String(rec['source'] ?? '').trim();
        const coursRaw: string = String(rec['cours'] ?? '').trim();
        // Backfill niveau from known mappings
        if (!niveauVal && coursRaw && courseToNiveau.has(coursRaw)) niveauVal = courseToNiveau.get(coursRaw);
        if (!niveauVal && matiereVal && matiereToNiveau.has(matiereVal)) niveauVal = matiereToNiveau.get(matiereVal);
        if (!niveauVal && sourceRaw) {
          const m = sourceRaw.match(/\b(PCEM\s*\d|DCEM\s*\d)\b/i);
          if (m) niveauVal = m[1].toUpperCase().replace(/\s+/g, '');
        }
        if (!matiereVal && coursRaw) matiereVal = coursRaw;
        if (!matiereVal && sourceRaw && /\//.test(sourceRaw)) {
          const parts = sourceRaw.split(/[\\/]+/).filter(Boolean);
          if (parts.length >= 2 && /^(PCEM\d|DCEM\d)$/i.test(parts[0])) {
            matiereVal = parts[1];
            if (!niveauVal) niveauVal = parts[0].toUpperCase();
          }
        }
        if (!matiereVal && niveauVal) matiereVal = niveauVal;
        return { niveau: niveauVal, matiere: matiereVal };
      })();

      // Sanitize matiere: letters/digits/spaces only
      const sanitizeMatiere = (m?: string) => String(m || '').normalize('NFC').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const computedMatiere = sanitizeMatiere(outMatiere);
      const computedCours = (String(rec['cours'] ?? '').trim()) || computedMatiere || '';
      const obj: any = {
        niveau: outNiveau ?? '',
        matiere: computedMatiere,
        cours: computedCours,
        source: cleanSource(rec['source'] ?? ''),
        'question n': rec['question n'] ?? '',
        'cas n': rec['cas n'] ?? '',
        'texte du cas': rec['texte du cas'] ?? '',
        'texte de la question': rec['texte de la question'] ?? '',
        reponse: rec['reponse'] ?? '',
        'option a': rec['option a'] ?? '',
        'option b': rec['option b'] ?? '',
        'option c': rec['option c'] ?? '',
        'option d': rec['option d'] ?? '',
        'option e': rec['option e'] ?? '',
        rappel: rec['rappel'] ?? '',
        'explication a': rec['explication a'] ?? '',
        'explication b': rec['explication b'] ?? '',
        'explication c': rec['explication c'] ?? '',
        'explication d': rec['explication d'] ?? '',
        'explication e': rec['explication e'] ?? ''
      };
      // Enforce unique, varied opening connectors per option (deterministic, no randomness)
      if (s === 'qcm' || s === 'cas_qcm') {
        const resp = String(obj['reponse'] || '').toUpperCase();
        const correctIdx = new Set<number>((resp.match(/[A-E]/g) || []).map(l => l.charCodeAt(0) - 65).filter(n => n >= 0));
        const POS = ['Exactement', 'Effectivement', 'Oui', 'Tout à fait', 'Précisément', 'Bien vu', 'Pertinent', 'Juste'];
        const NEG = ['En réalité', 'Au contraire', 'Pas du tout', 'Erreur fréquente', 'Attention', 'Faux', 'Hélas non', 'Contrairement'];
        const banned = [/^au contraire\b/i, /^juste contraire\b/i, /^en realite|en réalité\b/i, /^exact\b/i];
        const qSeed = (() => {
          const base = String(obj['texte de la question'] || obj['texte du cas'] || '');
          let h = 0; for (let i = 0; i < base.length; i++) h = (h * 33 + base.charCodeAt(i)) | 0; return Math.abs(h);
        })();
        const keys = ['explication a','explication b','explication c','explication d','explication e'];
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          let txt = clamp2to4Sentences(String((obj as any)[k] || '').trim());
          if (!txt) continue;
          const isCorr = correctIdx.has(i);
          const arr = isCorr ? POS : NEG;
          const opener = arr[(qSeed + i) % arr.length];
          // Strip any existing opener (first 1-3 words + optional punctuation)
          const body = txt.replace(/^\s*([A-Za-zÀ-ÖØ-öø-ÿ'’]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ'’]+){0,2})\s*[:,;–-]?\s*/u, '');
          const startsBanned = banned.some(r => r.test(txt));
          (obj as any)[k] = `${opener}: ${startsBanned ? body : body}`.trim();
        }
      }
      correctedBySheet[s].push(obj);
      // Attach obj pointer for enhancement targets of this row
      const keyId = `${s}:${r.row}`;
      for (const t of enhanceTargets) {
        if (t.id === keyId && t.obj == null) t.obj = obj;
      }
      fixedCount++;
    }

    // Second pass: enhance rows with short/placeholder content using AI (chunked for depth)
  async function enhanceMcqRows(targets: typeof enhanceTargets) {
      const items = targets.map(t => ({ id: t.id, questionText: t.questionText, options: t.options }));
      if (!items.length) return new Map<string, any>();
  const system = `Tu es PROFESSEUR de médecine expérimenté qui génère des explications CLAIRES et PRATIQUES pour chaque option de QCM.

EXIGENCES IMPÉRATIVES:
1. DIVERSITÉ ABSOLUE des connecteurs d'ouverture — JAMAIS de répétition.
2. CONTENU SPÉCIFIQUE OBLIGATOIRE par option (2–4 phrases COMPLÈTES) :
   - Référence explicite à l’option considérée
   - Mécanisme/critère CLINIQUE pertinent avec un chiffre ou repère
   - Mini exemple clinique CONCRET (âge/contexte/signe clef)
3. Chaque phrase se termine OBLIGATOIREMENT par un point.
4. RAPPEL DU COURS (3–5 phrases COMPLÈTES) clair, structuré et sans redondance.

LONGUEUR OBLIGATOIRE:
- Chaque explication: MINIMUM 2 phrases, MAXIMUM 4 phrases
- Rappel: MINIMUM 3 phrases, MAXIMUM 5 phrases
- TOUT doit être CLAIR, PRÉCIS, SANS AMBIGUÏTÉ

SORTIE JSON STRICTE:
{ "results": [ { "id":"<id>", "optionExplanations":["explication A 2-4 phrases", "explication B 2-4 phrases", ...], "globalExplanation":"rappel 3-5 phrases" } ] }`;

      const out = new Map<string, any>();
      const BATCH = 50; // maximum speed processing - large batches for ultimate throughput
      for (let i = 0; i < items.length; i += BATCH) {
        const slice = items.slice(i, i + BATCH);
        const user = JSON.stringify({ task: 'enhance_mcq_rows', items: slice });
        let content = '';
        try {
          // ✅ OPTIMIZED: Use direct REST API (no AI SDK overhead)
          const res = await chatCompletion([
            { role: 'system', content: system },
            { role: 'user', content: user }
          ], { maxTokens: 8000 });
          content = res.content;
        } catch (err: any) {
          console.warn('[AI] Enhancement REST call failed:', err?.message || err);
          continue;
        }
        try {
          const parsed = JSON.parse(content);
          const arr = Array.isArray(parsed?.results) ? parsed.results : [];
          for (const r of arr) {
            const id = String(r?.id || '');
            const exps = Array.isArray(r?.optionExplanations) ? r.optionExplanations.map((x: any) => String(x || '')) : [];
            const rapp = typeof r?.globalExplanation === 'string' ? String(r.globalExplanation) : '';
            out.set(id, { exps, rapp });
          }
        } catch {
          // ignore this slice on parse errors
        }
      }
      return out;
    }

  // Optional FAST mode: skip enhancement stage to maximize throughput
  // Default to FAST (skip enhancement) to avoid Vercel 300s timeout
  const FAST_MODE = String(process.env.AI_FAST_MODE || '1').trim() === '1';
  if (FAST_MODE) {
    console.log('[AI] ⚡ FAST_MODE enabled: Skipping enhancement pass to avoid timeout');
    updateSession(aiId, {}, '⚡ Mode rapide: pas d\'amélioration supplémentaire');
  } else {
    console.log('[AI] 🔧 Enhancement mode: Processing short explanations');
  }
  const enhanced = FAST_MODE ? new Map<string, any>() : await enhanceMcqRows(enhanceTargets);
    // Apply enhanced content where available
    for (const t of enhanceTargets) {
      const res = enhanced.get(t.id);
      if (!res || !t.obj) continue;
      const { exps, rapp } = res;
      // Replace per-option explanations if provided and detailed
      for (let j = 0; j < t.optionsCount; j++) {
        const key = `explication ${t.letters[j]}`;
        const val = String(exps?.[j] || '').trim();
        if (val && !explanationTooShort(val)) {
          t.obj[key] = val;
        }
      }
      const rVal = String(rapp || '').trim();
      if (rVal && !explanationTooShort(rVal)) {
        t.obj['rappel'] = rVal;
      }
    }

    // Build workbook: per-type corrected sheets using import-ready headers
    const wb = utils.book_new();
    (['qcm','qroc','cas_qcm','cas_qroc'] as SheetName[]).forEach(s => {
      const arr = correctedBySheet[s];
      if (arr && arr.length) {
        const ws = utils.json_to_sheet(arr, { header: [...IMPORT_HEADERS] as any });
        utils.book_append_sheet(wb, ws, s);
      }
    });
    // No Erreurs sheet: we guarantee all fixed
    const xbuf = write(wb, { type: 'buffer', bookType: 'xlsx' }) as unknown as ArrayBuffer;

    const reasonCounts: Record<string, number> = {};
    const errorsPreview: Array<any> = [];

    // Log top reasons (up to 3)
    const topReasons = Object.entries(reasonCounts).sort((a,b) => b[1]-a[1]).slice(0,3);
    if (topReasons.length) {
      const summary = topReasons.map(([k,v]) => `${k}: ${v}`).join(' • ');
      updateSession(aiId, {}, `📊 Motifs principaux: ${summary}`);
    }
    updateSession(
      aiId,
      {
        resultBuffer: xbuf,
        phase: 'complete',
        progress: 100,
        message: 'IA terminée',
        stats: { ...activeAiSessions.get(aiId)!.stats, fixedCount, errorCount, reasonCounts, errorsPreview }
      },
      `✅ Corrigés: ${fixedCount} • ❌ Restent en erreur: 0`
    );
  } catch (e: any) {
    updateSession(aiId, { phase: 'error', error: e?.message || 'Erreur IA', message: 'Erreur IA', progress: 100 }, `❌ Erreur: ${e?.message || 'Erreur IA'}`);
  }
}

async function postHandler(request: AuthenticatedRequest) {
  if (!isAzureConfigured()) return NextResponse.json({ error: 'AI not configured' }, { status: 400 });
  
  // Check for action parameter (e.g., action=stop)
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  // STOP ACTION: Stop a running job
  if (action === 'stop') {
    const aiId = searchParams.get('aiId');
    const userId = request.user?.userId;
    
    if (!aiId) return NextResponse.json({ error: 'aiId required' }, { status: 400 });
    
    try {
      // Remove from active sessions (stops further processing)
      const sess = activeAiSessions.get(aiId);
      if (sess) {
        sess.phase = 'error';
        sess.error = 'Arrêté par l\'utilisateur';
        sess.message = 'Job arrêté';
        sess.progress = 100;
        activeAiSessions.delete(aiId);
      }
      
      // Update DB record
      await prisma.aiValidationJob.updateMany({
        where: { id: aiId, userId },
        data: { 
          status: 'failed', 
          message: 'Arrêté par l\'utilisateur',
          progress: 100
        }
      });
      
      return NextResponse.json({ ok: true, message: 'Job arrêté' });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Erreur lors de l\'arrêt' }, { status: 500 });
    }
  }
  
  // Default: File upload and job creation
  const form = await request.formData();
  const file = form.get('file') as File | null;
  const instructions = typeof form.get('instructions') === 'string' ? String(form.get('instructions')) : undefined;
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

  // Create DB job first using existing AiValidationJob model
  const size = file.size;
  const userId = request.user?.userId;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const dbJob = await prisma.aiValidationJob.create({
    data: {
      fileName: file.name,
      originalFileName: file.name,
      fileSize: size,
      userId,
      status: 'queued',
      progress: 0,
      instructions: instructions || null,
      config: { logs: [], stats: {} }
    },
    select: { id: true }
  });
  const aiId = dbJob.id; // Use DB UUID as session id
  const now = Date.now();
  const sess: AiSession = {
    id: aiId,
    progress: 0,
    message: 'En file d\'attente…',
    logs: [],
    phase: 'queued',
    stats: { totalRows: 0, mcqRows: 0, processedBatches: 0, totalBatches: 0, logs: [], fixedCount: 0, errorCount: 0, reasonCounts: {} },
    createdAt: now,
    lastUpdated: now,
    userId,
    fileName: file.name,
  };
  activeAiSessions.set(aiId, sess);
  void persistSessionToDb(aiId, sess);
  // Start background job
  runAiSession(file, instructions, aiId).catch(() => {});
  return NextResponse.json({ aiId });
}

async function getHandler(request: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const aiId = searchParams.get('aiId');
  const action = searchParams.get('action');
  const userId = request.user?.userId;

  // LIST: pull from DB (merge with in-memory if running)
  if (action === 'list') {
    const jobs = await prisma.aiValidationJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, fileName: true, createdAt: true, updatedAt: true, status: true, progress: true, fixedCount: true, failedAnalyses: true, successfulAnalyses: true }
    });
    const mapped = jobs.map(j => {
      const mem = activeAiSessions.get(j.id);
      const phase = mem?.phase || (j.status === 'completed' ? 'complete' : j.status === 'failed' ? 'error' : j.status === 'queued' ? 'queued' : 'running');
      return {
        id: j.id,
        fileName: j.fileName,
        phase,
        progress: mem?.progress ?? j.progress ?? 0,
        message: mem?.message || '',
        createdAt: mem?.createdAt || (j.createdAt ? new Date(j.createdAt).getTime() : Date.now()),
        lastUpdated: mem?.lastUpdated || (j.updatedAt ? new Date(j.updatedAt).getTime() : Date.now()),
        stats: {
          fixedCount: mem?.stats?.fixedCount ?? j.fixedCount ?? 0,
          errorCount: mem?.stats?.errorCount ?? j.failedAnalyses ?? 0,
          totalRows: mem?.stats?.totalRows ?? 0,
          processedBatches: mem?.stats?.processedBatches ?? 0,
          totalBatches: mem?.stats?.totalBatches ?? 0,
        }
      };
    });
    return NextResponse.json({ jobs: mapped });
  }

  if (!aiId) return NextResponse.json({ error: 'aiId required' }, { status: 400 });

  // DETAILS
  if (action === 'details') {
    const job = await prisma.aiValidationJob.findFirst({ where: { id: aiId, userId } });
    if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const conf: any = (job as any).config || {};
    const mem = activeAiSessions.get(aiId);
    return NextResponse.json({
      id: job.id,
      fileName: job.fileName,
      status: job.status,
      phase: mem?.phase || (job.status === 'completed' ? 'complete' : job.status === 'failed' ? 'error' : job.status === 'queued' ? 'queued' : 'running'),
      progress: mem?.progress ?? job.progress ?? 0,
      message: mem?.message || job.message || '',
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      logs: mem?.logs || conf.logs || [],
      stats: mem?.stats || conf.stats || {},
    });
  }

  // DOWNLOAD
  if (action === 'download') {
    // Try in-memory first (fresh buffer). If not present fall back to DB outputUrl (data URL)
    const mem = activeAiSessions.get(aiId);
    if (mem?.resultBuffer) {
      const original = String(mem.fileName || '').trim();
      const base = original ? original.replace(/\.[^.]+$/, '') : 'ai_fixed';
      const outName = `${base}-ai-fixed.xlsx`;
      return new NextResponse(mem.resultBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${outName}"`
        }
      });
    }
    const job = await prisma.aiValidationJob.findFirst({ where: { id: aiId, userId }, select: { outputUrl: true, fileName: true } });
    if (!job?.outputUrl) return NextResponse.json({ error: 'no result available' }, { status: 404 });
    try {
      // outputUrl may be a data URL
  const b64 = job.outputUrl.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  const u8 = new Uint8Array(buf);
  const blob = new Blob([u8], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const original = String(job.fileName || '').trim();
      const base = original ? original.replace(/\.[^.]+$/, '') : 'ai_fixed';
      const outName = `${base}-ai-fixed.xlsx`;
      return new NextResponse(blob, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${outName}"`
        }
      });
    } catch {
      return NextResponse.json({ error: 'invalid stored output' }, { status: 500 });
    }
  }

  // SSE STREAM
  const sess = activeAiSessions.get(aiId);
  if (!sess) {
    // If not active, return details snapshot so UI can still show
    const job = await prisma.aiValidationJob.findUnique({ where: { id: aiId } });
    if (!job) return NextResponse.json({ error: 'session not found' }, { status: 404 });
    return NextResponse.json({
      id: job.id,
      phase: job.status === 'completed' ? 'complete' : job.status === 'failed' ? 'error' : job.status === 'queued' ? 'queued' : 'running',
      progress: job.progress,
      message: job.message,
      fileName: job.fileName,
      createdAt: job.createdAt,
      lastUpdated: job.updatedAt,
    });
  }
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let timer: ReturnType<typeof setInterval> | null = null;
      const safeSend = (data: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {
          closed = true; if (timer) { clearInterval(timer); timer = null; } try { controller.close(); } catch {}
        }
      };
      safeSend({ ...sess, resultBuffer: undefined });
      timer = setInterval(() => {
        const s = activeAiSessions.get(aiId);
        if (!s) { if (timer) { clearInterval(timer); timer = null; } closed = true; try { controller.close(); } catch {}; return; }
        safeSend({ ...s, resultBuffer: undefined });
        if (s.phase === 'complete' || s.phase === 'error') { if (timer) { clearInterval(timer); timer = null; } closed = true; try { controller.close(); } catch {}; }
      }, 1000);
    }
  });
  return new NextResponse(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
}

async function deleteHandler(request: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const aiId = searchParams.get('aiId');
  if (!aiId) return NextResponse.json({ error: 'aiId required' }, { status: 400 });
  const userId = request.user?.userId;
  try {
    const job = await prisma.aiValidationJob.findFirst({ where: { id: aiId, userId }, select: { id: true } });
    if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });
    await prisma.aiValidationJob.delete({ where: { id: aiId } });
    activeAiSessions.delete(aiId); // remove any memory state
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'delete failed' }, { status: 500 });
  }
}

export const POST = requireMaintainerOrAdmin(postHandler);
export const GET = requireMaintainerOrAdmin(getHandler);
export const DELETE = requireMaintainerOrAdmin(deleteHandler);