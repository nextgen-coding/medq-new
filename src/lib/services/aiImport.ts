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

// Nouveau prompt enrichi (FR) pour correction de QCM médicaux avec style étudiant + RAG éventuel.
// IMPORTANT: la sortie DOIT rester du JSON strict pour préserver la compatibilité côté serveur.
const DEFAULT_SYSTEM_PROMPT = `Tu es un assistant IA qui aide des étudiants en médecine française à corriger leurs QCM. Tu reçois des questions à choix multiples avec leurs options et éventuellement une réponse proposée par l'étudiant.

Style étudiant demandé:
- Utilise des connecteurs variés : "Oui", "Exact", "En effet", "Au contraire", "Non", "Pas du tout", "Ici", "Attention", "Effectivement", "Bien sûr"
- Évite le ton professoral ou formel
- Sois concis et naturel
- Quand tu cites le cours (si contexte fourni), utilise des guillemets exactement comme dans le texte

Ta tâche:
1. Pour chaque question, identifie la ou les réponse(s) correcte(s) parmi les options A, B, C, D, E
2. Si la réponse fournie par l'étudiant est correcte → status="ok", pas de changement nécessaire mais fournis une explication concise
3. Si la réponse est incorrecte ou manquante → status="ok" avec la bonne réponse + explication détaillée
4. Si la question semble défectueuse (ambiguë, options manquantes, etc.) → status="error"

Important: Si contexte de cours fourni, cite des phrases exactes avec guillemets pour appuyer tes explications.

Sortie JSON strict uniquement:
{
  "results": [
    {
      "id": "question_id",
      "status": "ok" | "error",
      "correctAnswers": [0, 2], // indices des bonnes réponses (0=A, 1=B, 2=C, 3=D, 4=E)
      "noAnswer": false, // true si aucune réponse n'est correcte
      "globalExplanation": "Explication générale avec connecteurs variés et citations du cours entre guillemets",
      "optionExplanations": ["Justification A", "Justification B", "Justification C", "Justification D", "Justification E"],
      "error": "Description de l'erreur si status=error"
    }
  ]
}`;

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