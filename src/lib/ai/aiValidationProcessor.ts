import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { isAzureConfigured, chatCompletion } from './azureClient'

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
    'source': 'source',
    'cas n': 'cas n',
    'texte du cas': 'texte du cas',
    'question n': 'question n',
  };
  return map[n] ?? n;
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
    for (const info of recognized) {
      const s = info.name
      const ws = wb.Sheets[s]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })
      totalItems += rows.length
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
    const qrocRows: Array<{ sheet: 'qroc' | 'cas_qroc'; index: number; original: Record<string, any>; text: string; existingAnswer: string; existingExplication: string }> = [];

    // Process each canonical sheet, collect data, and ensure ai_status/ai_reason columns
    for (const info of recognized) {
      const s = info.name
      const ws = wb.Sheets[s]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })
      
      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const headers = Object.keys(row);
        const canon: Record<string, string> = {};
        headers.forEach(h => {
          const c = canonicalizeHeader(h);
          if (!(c in canon)) canon[c] = h;
        });

        // Initialize ai_status and ai_reason for all rows
        if (row.ai_status === undefined) row.ai_status = 'unfixed';
        if (row.ai_reason === undefined) row.ai_reason = 'En attente d\'analyse IA';

        // Normalize source value if present
        if (canon['source']) {
          const key = canon['source'];
          row[key] = normalizeSource(row[key]);
        }

        // Collect for AI processing
        const isMcq = info.key === 'qcm' || info.key === 'cas_qcm';
        const isQroc = info.key === 'qroc' || info.key === 'cas_qroc';
        
        if (isMcq) {
          const textKey = canon['texte de la question'] || 'texte de la question';
          const text = String(row[textKey] ?? '').trim();
          const options: string[] = [];
          ['option a','option b','option c','option d','option e'].forEach(k => {
            const key = canon[k] || k;
            const v = row[key];
            if (v !== undefined && v !== null && String(v).trim()) options.push(String(v).trim());
          });
          const answerKey = canon['reponse'] || 'reponse';
          const answerLetters = parseAnswerLetters(row[answerKey]);
          
          mcqRows.push({
            sheet: info.key as 'qcm' | 'cas_qcm',
            index: idx + 1,
            original: row,
            text,
            options,
            answerLetters,
            caseText: canon['texte du cas'] ? String(row[canon['texte du cas']] || '').trim() : undefined,
            caseNumber: canon['cas n'] ? (parseInt(String(row[canon['cas n']])) || null) : undefined,
            caseQuestionNumber: canon['question n'] ? (parseInt(String(row[canon['question n']])) || null) : undefined,
          });
        } else if (isQroc) {
          const textKey = canon['texte de la question'] || 'texte de la question';
          const text = String(row[textKey] ?? '').trim();
          const answerKey = canon['reponse'] || 'reponse';
          const existingAnswer = String(row[answerKey] || '').trim();
          const existingExplication = String(row['explication'] || '').trim();
          
          qrocRows.push({
            sheet: info.key as 'qroc' | 'cas_qroc',
            index: idx + 1,
            original: row,
            text,
            existingAnswer,
            existingExplication,
          });
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

      // Update the sheet with the processed rows
      const newWs = XLSX.utils.json_to_sheet(rows, { skipHeader: false })
      wb.Sheets[s] = newWs
    }

    // If Azure configured, batch analyze MCQ and QROC rows
    const azureOn = isAzureConfigured();
    if (azureOn && (mcqRows.length > 0 || qrocRows.length > 0)) {
      // Read tuning from env with defaults matching docs (batch 50, concurrency 4)
      const batchSize = Math.max(1, parseInt(process.env.AI_BATCH_SIZE || '50', 10));
      const concurrency = Math.max(1, parseInt(process.env.AI_CONCURRENCY || '4', 10));

      // Default system prompt from working implementation
      const defaultSystem = `Tu aides des étudiants en médecine à corriger des QCM.
STYLE & TON:
- Écris comme un excellent étudiant de dernière année qui explique rapidement à des camarades (pas de ton professoral ni de formules d'introduction / conclusion globales).
- Chaque option reçoit 1 à 2 phrases le plus souvent, mais peut être plus longue si nécessaire pour justifier correctement. Pas de limitation artificielle.
- Varie systématiquement les connecteurs initiaux: "Oui", "Exact", "Effectivement", "Au contraire", "Non, en fait", "Plutôt", "Pas vraiment", "Correct", "Faux", "Juste"…

CITATIONS / SOURCES:
- Si un CONTEXTE (extraits cours) est fourni, cite une phrase pertinente entière (pas « selon la source » mais directement la phrase).
- Sinon, explique selon tes connaissances médicales.

FORMAT DE SORTIE:
- JSON STRICT uniquement. Structure: { "results": [ { "id": "string", "status": "ok"|"error", "correctAnswers": [indices], "optionExplanations": ["expl option A", "expl option B", ...], "globalExplanation": "résumé optionnel", "error": "message si status=error" } ] }
- correctAnswers: indices numériques (ex: [0,2] pour A,C).
- optionExplanations: un élément par option reçue dans l'ordre. Jamais plus ni moins d'explications que d'options.
- Aucune clé supplémentaire.
- Pas de markdown.
- Pas d'introduction ni conclusion générale.
- Si incertitude majeure empêchant décision fiable pour ≥1 option: status="error" et message dans error (sinon status="ok").
- Évite les répétitions exactes d'un même connecteur sur deux options consécutives si possible.

RAPPEL: Réponds uniquement avec le JSON.`;

      function buildUserPayload(items: McqRow[]) {
        return JSON.stringify({
          task: 'analyze_mcq_batch',
          items: items.map((q, i) => ({
            id: String(i),
            questionText: q.text,
            options: q.options,
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

      // Split into batches
      const batches: McqRow[][] = []
      for (let i = 0; i < mcqRows.length; i += batchSize) {
        batches.push(mcqRows.slice(i, i + batchSize))
      }

      const totalBatches = batches.length
      await updateJob(jobId, { currentBatch: 1, totalBatches })

      const systemPrompt = (instructions && instructions.trim()) ? instructions.trim() : defaultSystem

      async function processOneBatch(batch: McqRow[], batchIndex: number) {
        try {
          await updateJob(jobId, {
            message: `Analyse IA des QCMs ${batchIndex * batchSize + 1}-${batchIndex * batchSize + batch.length} / ${mcqRows.length}`,
            currentBatch: batchIndex + 1,
          });

          const userPayload = buildUserPayload(batch);
          const { content } = await chatCompletion([
            { role: 'user', content: userPayload }
          ], {
            maxTokens: 1800,
            systemPrompt,
          });

          const parsed = extractJson(content);
          if (!parsed || !Array.isArray(parsed.results)) {
            failedAnalyses += batch.length;
            return;
          }

          // Process each result from the AI response
          for (const result of parsed.results) {
            const idx = Number(result?.id);
            if (!Number.isInteger(idx) || idx < 0 || idx >= batch.length) continue;
            
            const mcq = batch[idx];
            const row = mcq.original;
            
            if (result.status === 'error') {
              row['ai_status'] = 'unfixed';
              row['ai_reason'] = result.error || 'Erreur IA';
              failedAnalyses += 1;
              continue;
            }

            // Process successful result
            let changed = false;
            
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
              const existingExplication = String(row['explication'] || '').trim();
              const optionLines = result.optionExplanations.map((exp: string, j: number) => 
                `- (${String.fromCharCode(65 + j)}) ${exp}`
              ).join('\n');
              
              const header = result.globalExplanation ? result.globalExplanation + '\n\n' : '';
              const aiBlock = header + 'Explications (IA):\n' + optionLines;
              const newExplication = existingExplication ? 
                `${existingExplication}\n\n${aiBlock}` : 
                aiBlock;
              
              if (newExplication !== existingExplication) {
                row['explication'] = newExplication;
                changed = true;
              }

              // Also set per-option explanation columns
              const letters = ['a','b','c','d','e'];
              for (let j = 0; j < Math.min(letters.length, result.optionExplanations.length); j++) {
                const key = `explication ${letters[j]}`;
                const val = String(result.optionExplanations[j] || '').trim();
                if (val && val !== String(row[key] || '').trim()) {
                  row[key] = val;
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
              row['ai_status'] = 'unfixed';
              row['ai_reason'] = 'Aucun changement proposé par l\'IA';
              failedAnalyses += 1;
            }
          }

          // Persist progress
          processed = Math.min(totalItems, processed + batch.length);
          await updateJob(jobId, {
            processedItems: processed,
            progress: totalItems ? Math.min(99, Math.floor((processed / totalItems) * 100)) : 99,
          });
        } catch (e) {
          // Mark entire batch as failed
          batch.forEach(mcq => {
            mcq.original['ai_status'] = 'unfixed';
            mcq.original['ai_reason'] = `IA: ${e instanceof Error ? e.message : 'erreur'}`;
          });
          failedAnalyses += batch.length;
          await updateJob(jobId, { message: 'Erreur IA sur un lot, poursuite...' });
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

      // Process QROC rows if any
      if (qrocRows.length > 0) {
        await updateJob(jobId, { message: 'Génération d\'explications QROC...', currentBatch: 1, totalBatches: 1 });
        
        const qrocBatchSize = Math.max(1, parseInt(process.env.AI_BATCH_SIZE || '30', 10));
        for (let i = 0; i < qrocRows.length; i += qrocBatchSize) {
          const batch = qrocRows.slice(i, i + qrocBatchSize);
          
          try {
            const qrocPrompt = (instructions && instructions.trim()) ? instructions.trim() : 
              `Tu aides des étudiants en médecine. Pour chaque question QROC:
1. Si la réponse est vide: status="error" et error="Réponse manquante" (pas d'explication).
2. Sinon, génère UNE explication concise (1-3 phrases) style étudiant (pas d'intro/conclusion globales), éventuellement plus longue si un mécanisme doit être clarifié.
3. Pas de ton professoral; utilise un style naturel.
4. Si la réponse semble incorrecte ou incohérente, status="error" avec une courte explication dans error au lieu d'une explication normale.
5. Sortie JSON STRICT uniquement (le mot JSON est présent pour contrainte Azure).
Format:
{
  "results": [ { "id": "<id>", "status": "ok" | "error", "explanation": "...", "error": "..." } ]
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
              maxTokens: 1200,
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
                    const existingExplication = String(row['explication'] || '').trim();
                    const aiExplanation = String(res.explanation).trim();
                    
                    if (aiExplanation) {
                      row['explication'] = existingExplication ? 
                        `${existingExplication}\n\nExplication (IA): ${aiExplanation}` :
                        `Explication (IA): ${aiExplanation}`;
                      row['ai_status'] = 'fixed';
                      row['ai_reason'] = '';
                      fixedCount += 1;
                      successfulAnalyses += 1;
                    }
                  } else {
                    row['ai_status'] = 'unfixed';
                    row['ai_reason'] = res.error || 'IA: pas d\'explication';
                    failedAnalyses += 1;
                  }
                }
              });
            } else {
              // Mark entire batch as failed
              batch.forEach(qroc => {
                qroc.original['ai_status'] = 'unfixed';
                qroc.original['ai_reason'] = 'IA: échec JSON QROC';
              });
              failedAnalyses += batch.length;
            }
          } catch (e) {
            // Mark entire batch as failed
            batch.forEach(qroc => {
              qroc.original['ai_status'] = 'unfixed';
              qroc.original['ai_reason'] = `IA: ${e instanceof Error ? e.message : 'erreur'}`;
            });
            failedAnalyses += batch.length;
          }
        }
      }
    }

    // Rebuild Erreurs sheet: list rows still not fixed across canonical sheets
    const errorRows: Array<{ sheet: string; row: number; reason: string; question?: string | null }> = [];
    for (const info of recognized) {
      const s = info.name
      const ws = wb.Sheets[s];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      rows.forEach((r, idx) => {
        if (String((r as any)['ai_status'] || '').toLowerCase() !== 'fixed') {
          const qText = (r['texte de la question'] ?? r['question'] ?? null) as string | null;
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
