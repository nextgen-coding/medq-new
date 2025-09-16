// Single implementation kept below
import { chatCompletions, isAzureConfigured } from './azureOpenAI';

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

// Prompt enrichi: toujours produire des explications DÉTAILLÉES multi-phrases par option.
// Objectif: mécanisme / correction / statistique (si sûre) / différentiel ou piège.
// IMPORTANT: sortie JSON STRICT.
const DEFAULT_SYSTEM_PROMPT = `Tu aides des étudiants en médecine à corriger des QCM. Tu reçois chaque question avec ses options.

EXIGENCES D'EXPLICATION (TOUJOURS DÉTAILLÉ):
- Chaque option reçoit 2 à 4 phrases (5 si nécessaire) :
  * Phrase 1: Connecteur varié + validation ou réfutation immédiate.
  * Phrase 2: Mécanisme physiopath / principe clé OU correction précise si faux.
  * Phrase 3: Conséquence clinique, épidémiologie ou critère différentiel majeur.
  * Phrase 4 (si utile): Chiffre robuste ou piège classique / différentiel supplémentaire.
- Aucune option ne doit se limiter à une seule phrase sauf impossibilité factuelle.
- Varie les connecteurs : "Oui", "Exact", "Effectivement", "Au contraire", "Non, en fait", "Plutôt", "Pas du tout", "Correct", "Faux", "Juste" (pas deux identiques de suite si possible).
- Ne recopie pas littéralement l'intitulé de l'option pour débuter; commence directement par le connecteur et la justification.
- Si option FAUSSE: formuler la bonne notion après la correction (« Non, en fait ... car ... »).
- Si chiffre incertain: ne pas inventer.

GLOBAL EXPLANATION (facultatif): brève synthèse (2–3 phrases) : mécanisme central + piège principal + perle clinique.

ERREURS:
- Utilise status="error" uniquement si question structurellement inutilisable (options manquantes, contradiction bloquante). Sinon toujours status="ok" même si la réponse fournie par l'étudiant est fausse.

SORTIE JSON STRICT UNIQUEMENT (pas de markdown ni texte hors JSON):
{
  "results": [
    {
      "id": "question_id",
      "status": "ok" | "error",
      "correctAnswers": [0,2],
      "noAnswer": false,
      "globalExplanation": "...",
      "optionExplanations": ["Oui …", "Au contraire …", "…"],
      "error": "(si status=error)"
    }
  ]
}
CONTRAINTES:
- optionExplanations: EXACTEMENT une entrée par option, longueur >= 2 phrases chacune (sauf impossibilité mentionnée).
- correctAnswers: indices numériques (A=0).
- Pas d'autres clés.
- Aucune explication ne doit être vide ou purement tautologique.
`;

function buildUserPrompt(items: MCQAiItem[]) {
  return JSON.stringify({
    task: 'analyze_mcq_batch',
    items: items.map(i => ({ id: i.id, questionText: i.questionText, options: i.options, providedAnswerRaw: i.providedAnswerRaw || null }))
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
  const content = await chatCompletions([
    { role: 'system', content: sys },
    { role: 'user', content: user }
  ]);
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (e: any) {
    console.error(`[AI] JSON parse failed:`, e?.message || e, 'content:', content?.slice(0, 500));
    return items.map(i => ({ id: i.id, status: 'error', error: 'Invalid JSON response from AI' }));
  }
  const results: MCQAiResult[] = [];
  const arr = Array.isArray(parsed?.results) ? parsed.results : [];
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

export async function analyzeMcqInChunks(items: MCQAiItem[], options?: { batchSize?: number; concurrency?: number; systemPrompt?: string; onBatch?: (info: { index: number; total: number }) => void; }): Promise<Map<string, MCQAiResult>> {
  const { batchSize = 200, concurrency = 12, systemPrompt, onBatch } = options || {};
  const batches: MCQAiItem[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  const results = new Map<string, MCQAiResult>();
  let idx = 0;
  async function runBatch(bIndex: number) {
    const batch = batches[bIndex];
    if (!batch) return;
    const t0 = Date.now();
    options?.onBatch?.({ index: bIndex + 1, total: batches.length });
    try {
      const res = await analyzeMcqBatch(batch, systemPrompt);
      for (const r of res) results.set(r.id, r);
      console.info(`[AI] Batch ${bIndex + 1}/${batches.length} done in ${Date.now() - t0}ms, size=${batch.length}`);
    } catch (e: any) {
      for (const it of batch) {
        results.set(it.id, { id: it.id, status: 'error', error: e?.message || 'Batch processing error' });
      }
      console.error(`[AI] Batch ${bIndex + 1}/${batches.length} failed:`, e?.message || e);
    }
  }
  const runners: Promise<void>[] = [];
  for (let c = 0; c < Math.min(concurrency, batches.length); c++) {
    console.info(`[AI] Starting worker ${c + 1}/${Math.min(concurrency, batches.length)}`);
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