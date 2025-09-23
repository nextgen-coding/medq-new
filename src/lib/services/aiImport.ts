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

// PERFECT SYSTEM PROMPT - NO AMBIGUITY, COMPLETE DETAILS, EXACT FORMATTING
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
    
    // Try to complete truncated JSON by finding the last complete object
    let braceCount = 0;
    let lastValidPos = -1;
    for (let i = 0; i < sub.length; i++) {
      if (sub[i] === '{') braceCount++;
      else if (sub[i] === '}') {
        braceCount--;
        if (braceCount === 0) lastValidPos = i;
      }
    }
    if (lastValidPos > 0) {
      try { return JSON.parse(sub.slice(0, lastValidPos + 1)); } catch {}
    }
  }
  
  // 2c) Look for any object start and try parsing from there
  const objIdx = raw.indexOf('{');
  if (objIdx >= 0) {
    const sub = raw.slice(objIdx);
    try { return JSON.parse(sub); } catch {}
  }
  
  // 3) Slice to last closing brace with better logic
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

  // Use AI SDK structured approach by default for guaranteed JSON reliability
  // Can be disabled with USE_STRUCTURED_AI_SDK=false if needed for debugging
  const useStructuredSDK = process.env.USE_STRUCTURED_AI_SDK !== 'false';
  
  if (useStructuredSDK) {
    try {
      console.log('[AI] Using structured AI SDK approach with generateObject for guaranteed JSON reliability');
      const result = await chatCompletionStructured([
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ], { 
        maxTokens: 800  // Optimal tokens for complete responses
      });
      content = result.content;
      lastErr = null;
      console.log('[AI] Structured SDK succeeded, content length:', content?.length || 0);
    } catch (err: any) {
      console.warn('[AI] Structured SDK failed, falling back to REST:', err?.message || err);
      console.warn('[AI] Structured SDK error details:', err);
      lastErr = err;
    }
  } else {
    console.log('[AI] Using REST approach (structured SDK explicitly disabled)');
  }

  // Use REST approach if structured SDK disabled or failed
  if (!content) {
    // Use the same working approach as QROC with fixed token limit
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Use chatCompletion like QROC does, with token limit for PERFECT responses
        const result = await chatCompletion([
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ], {
          maxTokens: 800  // Increased back to 800 for better JSON completion
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
  
  if (!content && lastErr) {
    // Propagate a clearer error so caller can fallback per-item
    throw new Error(`Azure request failed after ${maxAttempts} attempt(s): ${String(lastErr?.message || lastErr)}`);
  }
  let parsed: any = safeParseJson(content);
  if (!parsed) {
    console.error(`[AI] JSON parse failed (batch); using single-item salvage (structured retry disabled). content:`, content?.slice(0, 500));
    // Skip structured retry since it's failing with "Resource not found" - go straight to single salvage
  }

  if (!parsed) {
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
          salvaged.push({ id: it.id, status: 'error', error: 'No AI response (single-item salvage)' });
        }
      } catch (ie: any) {
        salvaged.push({ id: it.id, status: 'error', error: `Single-item salvage fail: ${String(ie?.message || ie)}` });
      }
    }
    return salvaged;
  }
  // Process successful batch results
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || '');
    const match = items.find(i => i.id === id);
    if (!match) continue;
    results.push({
      id,
      status: raw.status === 'ok' ? 'ok' : 'error',
      correctAnswers: Array.isArray(raw.correctAnswers) ? raw.correctAnswers.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0) : undefined,
      noAnswer: !!raw.noAnswer,
      optionExplanations: Array.isArray(raw.optionExplanations) ? raw.optionExplanations.map((s: any) => String(s || '')) : undefined,
      globalExplanation: typeof raw.globalExplanation === 'string' ? raw.globalExplanation : undefined,
      error: typeof raw.error === 'string' ? raw.error : undefined
    });
  }
  // Add errors for any missing items
  for (const it of items) {
    if (!results.find(r => r.id === it.id)) {
      results.push({ id: it.id, status: 'error', error: 'Missing from AI response' });
    }
  }
  return results;
}

export async function analyzeMcqInChunks(
  items: MCQAiItem[],
  options: {
    batchSize?: number;
    concurrency?: number;
    onProgress?: (completed: number, total: number, stage: string) => void;
    systemPrompt?: string;
  } = {}
): Promise<MCQAiResult[]> {
  const { batchSize = 50, concurrency = 50, onProgress, systemPrompt } = options;
  
  const allResults: MCQAiResult[] = [];
  const chunks: MCQAiItem[][] = [];
  
  // Create chunks
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }
  
  const processChunk = async (chunk: MCQAiItem[], index: number) => {
    try {
      onProgress?.(index, chunks.length, `Processing batch ${index + 1}/${chunks.length}`);
      const results = await analyzeMcqBatch(chunk, systemPrompt);
      return results;
    } catch (err: any) {
      console.error(`[AI] Chunk ${index} failed:`, err?.message);
      return chunk.map(item => ({ 
        id: item.id, 
        status: 'error' as const, 
        error: `Batch failed: ${String(err?.message || err)}` 
      }));
    }
  };
  
  // Process chunks with concurrency control
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const promises = batch.map((chunk, localIndex) => processChunk(chunk, i + localIndex));
    const batchResults = await Promise.all(promises);
    
    for (const results of batchResults) {
      allResults.push(...results);
    }
  }
  
  onProgress?.(chunks.length, chunks.length, 'Complete');
  return allResults;
}