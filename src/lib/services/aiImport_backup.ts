// Single implementation kept below
// Use Azure AI SDK wrapper for configuration check
import { isAzureConfigured, chatCompletionStructured } from '../ai/azureAiSdk';

// For the same approach as working QROC
import { chatCompletion } from '../ai/azureAiSdk';

export type MCQAiItem = {
  id: string; // unique per row (e.g., `${sheet}:${index}`)
  questionText: string;
  options: string[]; // A..E length <= 5
  providedAnswerRaw?: string; // e.g., "A, C" or "?" etc.
};

export type MCQAiResult = {
  id: string;
  status: 'ok' | 'error';
  correctAnswers?: number[]; // indices in options
  noAnswer?: boolean;
  optionExplanations?: string[]; // same length as options
  globalExplanation?: string;
  error?: string;
};

// Professor-level prompt: always produce detailed, multi‑sentence per‑option explanations with style variety,
// and ALWAYS return correctAnswers (choose the most plausible if uncertain). Also include
// a RAPPEL DU COURS (small course example/synthesis) mapped to globalExplanation.
// Formatting requirement: Use newline-separated segments so we can render nicely (no markdown bullets, just line breaks).
const DEFAULT_SYSTEM_PROMPT = `Tu es PROFESSEUR de médecine de TRÈS HAUT NIVEAU: tu corriges des QCM pour des étudiants avancés avec une EXIGENCE ABSOLUE de QUALITÉ et COMPLÉTUDE.

NIVEAU ET DÉTAIL OBLIGATOIRE:
- Chaque option reçoit EXACTEMENT 4 à 6 phrases COMPLÈTES en mode professeur expert
- CONTENU SPÉCIFIQUE OBLIGATOIRE à l'option, segments séparés par des retours à la ligne (JAMAIS de listes markdown « - » ou « • »)
- Structure OBLIGATOIRE pour chaque option:
  1. Ouverture: connecteur VARIÉ + validation/réfutation immédiate (JAMAIS d'ouvertures identiques)
  2. Mécanisme physiopathologique DÉTAILLÉ ou principe clé COMPLET; si faux, correction PRÉCISE de la bonne notion
  3. Implication clinique CONCRÈTE (épidémiologie/physio/signes) DÉTAILLÉE liée à l'option
  4. Critère discriminant PRÉCIS (clinique, para-clinique, seuil chiffré EXACT) ou piège + diagnostic différentiel COMPLET
  5. Mini exemple clinique CONCRET (âge/contexte/signes cardinaux) SPÉCIFIQUE à l'option
  6. Rappel théorique SUPPLÉMENTAIRE ou nuance clinique IMPORTANTE

RÈGLES DE FORMATAGE STRICT:
- JAMAIS recopier la formulation brute de l'option
- Commence TOUJOURS par le connecteur puis justification IMMÉDIATE
- Si option FAUSSE: « Non, en fait … car … » puis la bonne notion EXACTE et COMPLÈTE
- VARIATION DE STYLE OBLIGATOIRE: JAMAIS de répétition des connecteurs d'ouverture
- Alterne connecteurs: Effectivement, Oui, Juste, Pertinent, En réalité, À l'inverse, Plutôt, Contrairement, Erreur fréquente, Pas du tout, Absolument, Tout à fait, Précisément, En revanche, Au contraire, Certes, Néanmoins
- INTERDITS: répétition systématique « Exact, cette… », « Au contraire, … »
- Intègre TOUS les mots-clés de chaque option dans l'argumentation SANS paraphraser à vide

RAPPEL DU COURS (OBLIGATOIRE ET COMPLET):
- Fournis une synthèse de 3 à 5 phrases COMPLÈTES (mini cours DÉTAILLÉ) en segments séparés par des retours à la ligne
- Structure obligatoire: notion centrale DÉTAILLÉE, mécanisme clé COMPLET, critères diagnostiques PRÉCIS, piège principal EXPLIQUÉ, exemple clinique CONCRET (pas générique), traitement/prise en charge si pertinent
- Ceci sera stocké dans la colonne "rappel"; fournis-le sous globalExplanation

RÉPONSES OBLIGATOIRES:
- Tu DOIS TOUJOURS fournir "correctAnswers" (indices numériques A=0 …) même si l'étudiant n'a pas répondu
- En cas d'incertitude, choisis la(les) réponse(s) la(les) plus plausible(s) et justifie COMPLÈTEMENT dans les explications
- N'utilise "noAnswer" que si la question est inutilisable structurellement (options manquantes, contradictions bloquantes). Sinon noAnswer=false et status="ok"

EXIGENCES DE LONGUEUR ABSOLUE:
- Chaque explication d'option: MINIMUM 4 phrases COMPLÈTES, MAXIMUM 6 phrases
- Rappel du cours: MINIMUM 3 phrases COMPLÈTES, MAXIMUM 5 phrases
- Chaque phrase se termine OBLIGATOIREMENT par un point
- AUCUNE explication ne doit être vide, tautologique, ou pure paraphrase de l'option
- TOUT doit être DÉTAILLÉ, PRÉCIS, COMPLET sans AUCUNE AMBIGUÏTÉ

SORTIE JSON STRICT (aucun markdown, aucune prose hors JSON):
{
  "results": [
    {
      "id": "question_id",
      "status": "ok" | "error", 
      "correctAnswers": [0,2],
      "noAnswer": false,
  "globalExplanation": "RAPPEL DU COURS COMPLET 3-5 phrases détaillées avec retours ligne",
  "optionExplanations": ["Connecteur_varié: explication_complète_4-6_phrases", "Autre_connecteur: autre_explication_complète_4-6_phrases"],
      "error": "(si status=error)"
    }
  ]
}
CONTRAINTES ABSOLUES:
- optionExplanations: EXACTEMENT une entrée par option reçue (même ordre), longueur OBLIGATOIRE ≥ 4 phrases COMPLÈTES, avec des retours à la ligne internes pour structurer (pas de puces markdown).
  Ouvertures OBLIGATOIREMENT non identiques entre options (les deux premiers mots doivent ABSOLUMENT varier).
- correctAnswers: indices numériques (A=0). JAMAIS des lettres.
- Pas d'autres clés.
- RAPPEL FINAL: AUCUNE explication courte, AUCUNE approximation, TOUT doit être PARFAIT, COMPLET et DÉTAILLÉ.`;

// Robust JSON parsing with salvage strategies for truncated outputs
function safeParseJson(content: string): any | null {
  if (!content || typeof content !== 'string') return null;
  const raw = content.trim();
  
  // 1) Direct parse
  try { return JSON.parse(raw); } catch {}
  
  // 2) Code fence extraction
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  
  // 2b) Try from first occurrence of a JSON object that likely starts results
  const resIdx = raw.indexOf('{"results"');
  if (resIdx >= 0) {
    const sub = raw.slice(resIdx);
    try { return JSON.parse(sub); } catch {}
  }
  
  // 2c) Look for any object start and try parsing from there
  const objIdx = raw.indexOf('{');
  if (objIdx >= 0) {
    const sub = raw.slice(objIdx);
    try { return JSON.parse(sub); } catch {}
  }
  
  // 3) Slice to last closing brace
  const lastBrace = raw.lastIndexOf('}');
  if (lastBrace > 0) {
    const sliced = raw.slice(0, lastBrace + 1);
    try { return JSON.parse(sliced); } catch {}
  }
  const lastBracket = raw.lastIndexOf(']');
  if (lastBracket > 0) {
    const sliced = raw.slice(0, lastBracket + 1);
    try { return JSON.parse(sliced); } catch {}
  }
  
  // 4) Naive brace/bracket balancing (append closers up to a limit)
  const openCurly = (raw.match(/{/g) || []).length;
  const closeCurly = (raw.match(/}/g) || []).length;
  const openSquare = (raw.match(/\[/g) || []).length;
  const closeSquare = (raw.match(/\]/g) || []).length;
  let fixed = raw;
  const needCurly = Math.max(0, Math.min(10, openCurly - closeCurly));
  const needSquare = Math.max(0, Math.min(10, openSquare - closeSquare));
  if (needSquare) fixed += ']'.repeat(needSquare);
  if (needCurly) fixed += '}'.repeat(needCurly);
  try { return JSON.parse(fixed); } catch {}
  
  // 5) Strip trailing commas before } or ]
  try {
    const stripped = raw.replace(/,\s*(\}|\])/g, '$1');
    return JSON.parse(stripped);
  } catch {}
  
  // 6) Ultra-aggressive: try to extract any partial results array
  const resultsMatch = raw.match(/"results"\s*:\s*\[([^\]]*)/);
  if (resultsMatch) {
    try {
      const partial = `{"results":[${resultsMatch[1]}]}`;
      return JSON.parse(partial);
    } catch {}
  }
  
  return null;
}

function buildUserPrompt(items: MCQAiItem[]) {
  // Cap lengths to keep requests small and robust
  const cap = (s: string, n: number) => (s && s.length > n ? s.slice(0, n) : s);
  const QT = Number(process.env.AI_IMPORT_QTEXT_CAP || 350);
  const OT = Number(process.env.AI_IMPORT_OPTION_CAP || 120);
  return JSON.stringify({
    task: 'analyze_mcq_batch',
    items: items.map(i => ({
      id: i.id,
      questionText: cap(i.questionText, QT),
      options: i.options.map(o => cap(o, OT)),
      providedAnswerRaw: i.providedAnswerRaw || null
    }))
  });
}

export async function analyzeMcqBatch(items: MCQAiItem[], systemPrompt?: string): Promise<MCQAiResult[]> {
  if (!isAzureConfigured()) {
    // If not configured, return error results so caller can fallback
    return items.map(i => ({ id: i.id, status: 'error', error: 'Azure OpenAI not configured' }));
  }
  // If caller provided extra instructions, append them to the default to preserve JSON constraints
  const base = process.env.AI_IMPORT_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
  const sys = systemPrompt ? `${base}

INSTRUCTIONS ADMIN:
${systemPrompt}
` : base;
  const user = buildUserPrompt(items);
  console.info(`[AI] analyzeMcqBatch: size=${items.length}${systemPrompt ? ', customPrompt=true' : ''}`);
  // Transient network errors sometimes surface as "fetch failed"; add light retries
  const maxAttempts = Math.max(1, Number(process.env.AI_RETRY_ATTEMPTS || 2));
  let lastErr: any = null;
  let content: string = '';
  // Try AI SDK structured approach first for better reliability if enabled
  const useStructuredSDK = process.env.USE_STRUCTURED_AI_SDK === 'true';
  
  if (useStructuredSDK) {
    try {
      console.log('[AI] Using structured AI SDK approach for JSON reliability');
      const result = await chatCompletionStructured([
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ], { 
        maxTokens: 800  // Ultra-fast responses
      });
      content = result.content;
      lastErr = null;
    } catch (err: any) {
      console.warn('[AI] Structured SDK failed, falling back to REST:', err?.message);
      lastErr = err;
    }
  }

  // Use REST approach if structured SDK disabled or failed
  if (!content) {
    // Use the same working approach as QROC with fixed token limit
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Use chatCompletion like QROC does, with hardcoded 1600 token limit that works
        const result = await chatCompletion([
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ], {
          maxTokens: 800  // Ultra-fast responses
        });
        content = result.content;
        lastErr = null;
        break;
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message || e);
        console.error(`[AI] chatCompletion attempt ${attempt}/${maxAttempts} failed: ${msg}`);
        if (attempt < maxAttempts && /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
          const backoff = 500 * attempt;
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        break;
      }
    }
  }
  if (lastErr) {
    // Propagate a clearer error so caller can fallback per-item
    throw new Error(`Azure request failed after ${maxAttempts} attempt(s): ${String(lastErr?.message || lastErr)}`);
  }
  let parsed: any = safeParseJson(content);
  if (!parsed) {
    console.error(`[AI] JSON parse failed (batch); trying single salvage. content:`, content?.slice(0, 500));
    // Fallback: try per-item analysis to salvage results when batch JSON fails
    const results: MCQAiResult[] = [];
    for (const it of items) {
      try {
        const singlePayload = buildUserPrompt([it]);
        const single = await chatCompletion([
          { role: 'system', content: sys },
          { role: 'user', content: singlePayload }
        ], { maxTokens: 800 }); // Fast single salvage
        const singleJson = safeParseJson(single.content);
        const rec = Array.isArray(singleJson?.results) ? singleJson.results.find((r: any) => String(r?.id || '') === it.id) : null;
        if (rec && typeof rec === 'object') {
          results.push({
            id: it.id,
            status: rec.status === 'ok' ? 'ok' : 'error',
            correctAnswers: Array.isArray(rec.correctAnswers) ? rec.correctAnswers.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0) : undefined,
            noAnswer: !!rec.noAnswer,
            optionExplanations: Array.isArray(rec.optionExplanations) ? rec.optionExplanations.map((s: any) => String(s || '')) : undefined,
            globalExplanation: typeof rec.globalExplanation === 'string' ? rec.globalExplanation : undefined,
            error: typeof rec.error === 'string' ? rec.error : undefined
          });
        } else {
          results.push({ id: it.id, status: 'error', error: 'No AI response (single-item)' });
        }
      } catch (ie: any) {
        results.push({ id: it.id, status: 'error', error: `Single-item fail: ${String(ie?.message || ie)}` });
      }
    }
    return results;
  }
  const results: MCQAiResult[] = [];
  let arr = Array.isArray(parsed?.results) ? parsed.results : [];
  // If model answered but results missing/empty, salvage per item
  if (!arr.length) {
    console.warn('[AI] Batch JSON has no results — switching to single-item salvage');
    const salvaged: MCQAiResult[] = [];
    for (const it of items) {
      try {
        const singlePayload = buildUserPrompt([it]);
        const single = await chatCompletion([
          { role: 'system', content: sys },
          { role: 'user', content: singlePayload }
        ], { maxTokens: 800 }); // Fast single salvage
        const singleJson = safeParseJson(single.content);
        const rec = Array.isArray(singleJson?.results) ? singleJson.results.find((r: any) => String(r?.id || '') === it.id) : null;
        if (rec && typeof rec === 'object') {
          salvaged.push({
            id: it.id,
            status: rec.status === 'ok' ? 'ok' : 'error',
            correctAnswers: Array.isArray(rec.correctAnswers) ? rec.correctAnswers.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0) : undefined,
            noAnswer: !!rec.noAnswer,
            optionExplanations: Array.isArray(rec.optionExplanations) ? rec.optionExplanations.map((s: any) => String(s || '')) : undefined,
            globalExplanation: typeof rec.globalExplanation === 'string' ? rec.globalExplanation : undefined,
            error: typeof rec.error === 'string' ? rec.error : undefined
          });
        } else {
          salvaged.push({ id: it.id, status: 'error', error: 'No AI response (single-item)' });
        }
      } catch (ie: any) {
        salvaged.push({ id: it.id, status: 'error', error: `Single-item fail: ${String(ie?.message || ie)}` });
      }
    }
    return salvaged;
  }
  // Map responses back to input items
  for (const item of items) {
    const found = arr.find((r: any) => String(r?.id || '') === item.id);
    if (found && typeof found === 'object') {
      results.push({
        id: item.id,
        status: found.status === 'ok' ? 'ok' : 'error',
        correctAnswers: Array.isArray(found.correctAnswers) ? found.correctAnswers.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0) : undefined,
        noAnswer: !!found.noAnswer,
        optionExplanations: Array.isArray(found.optionExplanations) ? found.optionExplanations.map((s: any) => String(s || '')) : undefined,
        globalExplanation: typeof found.globalExplanation === 'string' ? found.globalExplanation : undefined,
        error: typeof found.error === 'string' ? found.error : undefined
      });
    } else {
      results.push({ id: item.id, status: 'error', error: 'No AI response for this item' });
    }
  }
  return results;
}

export async function analyzeMcqInChunks(items: MCQAiItem[], options?: {
  batchSize?: number;
  concurrency?: number;
  systemPrompt?: string;
  // Deprecated: onBatch (kept for compatibility)
  onBatch?: (info: { index: number; total: number }) => void;
  // New detailed hooks
  onBatchStart?: (info: { index: number; total: number; size: number }) => void;
  onBatchEnd?: (info: { index: number; total: number; size: number; ms: number; ok: boolean; error?: string }) => void;
}): Promise<Map<string, MCQAiResult>> {
  const { batchSize: callerBatch = 50, concurrency: callerConc = 4, systemPrompt, onBatch, onBatchStart, onBatchEnd } = options || {};
  // Effective sizes with conservative defaults and env overrides
  const singleMode = String(process.env.AI_QCM_SINGLE || '').trim() === '1' || String(process.env.AI_QCM_MODE || '').trim().toLowerCase() === 'single' || String(process.env.AI_IMPORT_SINGLE || '').trim() === '1';
  const effBatch = singleMode ? 1 : Math.max(1, Number(process.env.AI_IMPORT_BATCH_SIZE || process.env.AI_BATCH_SIZE || callerBatch || 8));
  const effConc = singleMode ? 1 : Math.max(1, Number(process.env.AI_IMPORT_CONCURRENCY || process.env.AI_CONCURRENCY || callerConc || 1));
  const batches: MCQAiItem[][] = [];
  if (singleMode) {
    console.info('[AI] QCM single-item mode enabled — sending one by one');
    for (let i = 0; i < items.length; i++) batches.push([items[i]]);
  } else {
    for (let i = 0; i < items.length; i += effBatch) {
      batches.push(items.slice(i, i + effBatch));
    }
  }
  const results = new Map<string, MCQAiResult>();
  let idx = 0;
  async function runBatch(bIndex: number) {
    const batch = batches[bIndex];
    if (!batch) return;
    const t0 = Date.now();
    // Back-compat 'onBatch' and new 'onBatchStart'
    try { options?.onBatch?.({ index: bIndex + 1, total: batches.length }); } catch {}
    try { onBatchStart?.({ index: bIndex + 1, total: batches.length, size: batch.length }); } catch {}
    try {
      let res: MCQAiResult[] | null = null;
      let shrink = 0;
      while (res === null) {
        try {
          res = await analyzeMcqBatch(batch.slice(0, batch.length - shrink), systemPrompt);
        } catch (e: any) {
          const msg = String(e?.message || e);
          // If fetch/timeout or payload too large, shrink batch and retry a couple times
          const shouldShrinkForNoContent = /No content from Azure OpenAI/i.test(msg);
          if ((/fetch failed|ETIMEDOUT|EAI_AGAIN|ECONNRESET/i.test(msg) || /413|request too large|payload too large/i.test(msg) || shouldShrinkForNoContent) && (batch.length - shrink) > 1) {
            // If "no content" reported, shrink aggressively to 1 to isolate problematic item
            const target = shouldShrinkForNoContent ? (batch.length - shrink - 1) : Math.max(1, (batch.length - shrink) - Math.ceil((batch.length - shrink) * 0.4));
            shrink = Math.max(0, batch.length - target);
            console.warn(`[AI] Shrinking batch ${bIndex + 1}: trying size=${batch.length - shrink} due to ${shouldShrinkForNoContent ? 'no-content' : 'network/size'} error`);
            continue;
          }
          throw e;
        }
      }
      for (const r of res) results.set(r.id, r);
      const ms = Date.now() - t0;
      console.info(`[AI] Batch ${bIndex + 1}/${batches.length} done in ${ms}ms, size=${batch.length}`);
      try { onBatchEnd?.({ index: bIndex + 1, total: batches.length, size: batch.length, ms, ok: true }); } catch {}
    } catch (e: any) {
      for (const it of batch) {
        results.set(it.id, { id: it.id, status: 'error', error: e?.message || 'Batch processing error' });
      }
      const msg = String(e?.message || e);
      console.error(`[AI] Batch ${bIndex + 1}/${batches.length} failed:`, msg);
      try { onBatchEnd?.({ index: bIndex + 1, total: batches.length, size: batch.length, ms: Date.now() - t0, ok: false, error: msg }); } catch {}
    }
  }
  const runners: Promise<void>[] = [];
  for (let c = 0; c < Math.min(effConc, batches.length); c++) {
    console.info(`[AI] Starting worker ${c + 1}/${Math.min(effConc, batches.length)}`);
    runners.push((async function loop() {
      while (true) {
        const myIndex = idx++;
        if (myIndex >= batches.length) break;
        await runBatch(myIndex);
      }
    })());
  }
  const started = Date.now();
  await Promise.all(runners);
  console.info(`[AI] analyzeMcqInChunks completed in ${Date.now() - started}ms`);
  return results;
}