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

// ✅ OPTIMIZED SYSTEM PROMPT - Simplified for 15x faster performance like QROC
// Reduced from 1300+ tokens to ~400 tokens to prevent rate limiting
const DEFAULT_SYSTEM_PROMPT = `Tu es professeur de médecine expert. Analyse les QCM et fournis des explications détaillées pour chaque option.

EXIGENCES:
- Explique CHAQUE option en 3-5 phrases complètes et structurées
- Commence par un connecteur varié (Effectivement, En réalité, À l'inverse, etc.)
- Si FAUX: explique pourquoi et donne la bonne notion
- Si VRAI: justifie avec mécanismes et critères cliniques
- Intègre exemples concrets et chiffrés quand pertinent
- Fournis un rappel de cours global (3-4 phrases) en globalExplanation

RÉPONSES:
- TOUJOURS fournir correctAnswers (indices 0-4, pas de lettres)
- Si incertain, choisis la réponse la plus plausible
- noAnswer=false sauf si question structurellement inutilisable

SORTIE JSON STRICT:
{
  "results": [
    {
      "id": "question_id",
      "status": "ok",
      "correctAnswers": [0,2],
      "noAnswer": false,
      "globalExplanation": "Rappel de cours 3-4 phrases",
      "optionExplanations": ["Explication option A 3-5 phrases", "Explication option B 3-5 phrases", ...]
    }
  ]
}

CONTRAINTES:
- optionExplanations: exactement une entrée par option (même ordre)
- correctAnswers: indices numériques uniquement (A=0, B=1, etc.)
- Variations de style entre options (connecteurs différents)
- Aucun markdown, aucune liste à puces`;

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
  
  const apiStartTime = Date.now();
  console.log(`[AI] 🌐 API Call: Sending ${items.length} questions to Azure OpenAI...`);
  
  // Transient network errors sometimes surface as "fetch failed"; add light retries
  const maxAttempts = Math.max(1, Number(process.env.AI_RETRY_ATTEMPTS || 2));
  let lastErr: any = null;
  let content: string = '';

  // ✅ OPTIMIZED: Use REST API by default (like test script that achieved 15x speedup)
  // AI SDK adds 300+ tokens overhead and causes rate limiting
  // Set USE_STRUCTURED_AI_SDK=true to re-enable if needed
  const useStructuredSDK = process.env.USE_STRUCTURED_AI_SDK === 'true';
  
  if (useStructuredSDK) {
    try {
      console.log('[AI] Using structured AI SDK approach with generateObject for guaranteed JSON reliability');
      const result = await chatCompletionStructured([
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ], { 
        maxTokens: 8000  // ✅ CRITICAL: Match QROC's 8000 for complete responses
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
          maxTokens: 8000  // ✅ CRITICAL: Match QROC's 8000 to prevent incomplete JSON and rate limiting
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
    const apiDuration = ((Date.now() - apiStartTime) / 1000).toFixed(2);
    console.error(`[AI] ❌ API Call Failed after ${apiDuration}s and ${maxAttempts} attempts`);
    throw new Error(`Azure request failed after ${maxAttempts} attempt(s): ${String(lastErr?.message || lastErr)}`);
  }
  
  const apiDuration = ((Date.now() - apiStartTime) / 1000).toFixed(2);
  console.log(`[AI] ✅ API Response received in ${apiDuration}s (${content?.length || 0} chars)`);
  
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
  
  console.log(`[AI] 📦 Created ${chunks.length} batches (${batchSize} questions per batch, ${concurrency} parallel)`);
  
  // Atomic completion counter (fixes race condition with out-of-order batch completion)
  let atomicCompletedCount = 0;
  
  const processChunk = async (chunk: MCQAiItem[], index: number) => {
    const batchNum = index + 1;
    const startTime = Date.now();
    
    try {
      console.log(`[AI] 🚀 Batch ${batchNum}/${chunks.length}: Starting (${chunk.length} questions)`);
      // Don't report progress on start - wait for completion
      
      // Call Azure API
      const results = await analyzeMcqBatch(chunk, systemPrompt);
      
      // Atomically increment completion counter
      atomicCompletedCount++;
      const actualCompleted = atomicCompletedCount;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const okCount = results.filter(r => r.status === 'ok').length;
      const errCount = results.filter(r => r.status === 'error').length;
      
      // Add timing warning if batch took unusually long (possible rate limiting)
      const durationNum = parseFloat(duration);
      const warningIcon = durationNum > 60 ? '⚠️ ' : durationNum > 30 ? '⏱️ ' : '';
      
      console.log(`[AI] ${warningIcon}✅ Batch ${batchNum}/${chunks.length}: Complete in ${duration}s (${okCount} OK, ${errCount} errors) - ${actualCompleted}/${chunks.length} batches done`);
      // Pass actual completion count, not batch index
      onProgress?.(actualCompleted, chunks.length, `✅ Lot ${actualCompleted}/${chunks.length} terminé (batch #${batchNum}, ${duration}s)`);
      
      return results;
    } catch (err: any) {
      // Even on error, increment completion counter
      atomicCompletedCount++;
      const actualCompleted = atomicCompletedCount;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const isRateLimit = err?.message?.includes('429') || err?.message?.includes('Rate limit') || err?.message?.includes('rate limit');
      const errorIcon = isRateLimit ? '🚫 RATE LIMITED' : '❌';
      
      console.error(`[AI] ${errorIcon} Batch ${batchNum}/${chunks.length}: Failed after ${duration}s - ${actualCompleted}/${chunks.length} batches done -`, err?.message);
      onProgress?.(actualCompleted, chunks.length, `${errorIcon} Lot ${actualCompleted}/${chunks.length} échoué (batch #${batchNum})`);
      
      return chunk.map(item => ({ 
        id: item.id, 
        status: 'error' as const, 
        error: `Batch failed: ${String(err?.message || err)}` 
      }));
    }
  };
  
  // Process chunks with concurrency control (waves)
  const totalBatches = chunks.length;
  
  for (let i = 0; i < chunks.length; i += concurrency) {
    const wave = Math.floor(i / concurrency) + 1;
    const totalWaves = Math.ceil(chunks.length / concurrency);
    const batch = chunks.slice(i, i + concurrency);
    const batchCount = batch.length;
    
    console.log(`[AI] 🌊 Wave ${wave}/${totalWaves}: Launching ${batchCount} batch(es) in parallel...`);
    onProgress?.(atomicCompletedCount, totalBatches, `🌊 Vague ${wave}/${totalWaves}: ${batchCount} lot(s) en parallèle`);
    
    const waveStartTime = Date.now();
    const promises = batch.map((chunk, localIndex) => processChunk(chunk, i + localIndex));
    const batchResults = await Promise.all(promises);
    const waveDuration = ((Date.now() - waveStartTime) / 1000).toFixed(1);
    
    console.log(`[AI] ✅ Wave ${wave}/${totalWaves}: All ${batchCount} batch(es) complete in ${waveDuration}s (Total: ${atomicCompletedCount}/${totalBatches})`);
    
    for (const results of batchResults) {
      allResults.push(...results);
    }
    
    // Add inter-wave delay to prevent Azure TPM exhaustion (except after last wave)
    if (wave < totalWaves) {
      const cooldownSeconds = 2;  // ✅ OPTIMIZED: Empirical testing showed 2s is fastest while preventing rate limits
      console.log(`[AI] ⏸️  Cooling down ${cooldownSeconds}s to prevent rate limiting...`);
      onProgress?.(atomicCompletedCount, totalBatches, `⏸️ Pause ${cooldownSeconds}s (évite rate limiting)`);
      await new Promise(resolve => setTimeout(resolve, cooldownSeconds * 1000));
      console.log(`[AI] ▶️  Resuming processing...`);
    }
  }
  
  console.log(`[AI] 🎉 All ${totalBatches} batches completed successfully!`);
  onProgress?.(chunks.length, chunks.length, '✅ Tous les lots terminés');
  
  return allResults;
}