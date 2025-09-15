# AI Validation & Correction Pipeline

This document explains how the AI validation/correction feature works, why input vs output row counts could differ before, and what was changed to guarantee parity.

## Overview
You can launch an AI correction run via the streaming endpoint:
- `POST /api/validation/ai-progress` (multipart form: `file` + optional `instructions`)
- Poll / stream with `GET /api/validation/ai-progress?aiId=...` (SSE)
- Download result with `GET /api/validation/ai-progress?aiId=...&action=download`

The feature:
1. Parses the uploaded XLSX (supports canonical sheets: `qcm`, `cas_qcm`, `qroc`, `cas_qroc` or a consolidated error/validation sheet containing a `sheet` column).
2. Splits MCQ rows (QCM + CAS_QCM) and batches them through Azure OpenAI (deployment: `gpt-5-mini`). If a RAG index is configured, each MCQ is enriched with relevant course excerpts before analysis.
3. Generates/normalizes answers and explanations; merges them back.
4. Generates missing explanations for QROC / CAS_QROC answers.
5. Writes a new workbook with:
   - Each sheet containing ALL original rows (now labeled with AI status) so counts match input.
   - An `Erreurs` sheet that lists only *unfixed* rows with reasons.
6. Streams real-time progress + stats (fixed vs unfixed counts, top reasons, preview of first errors).

## Batching
Configured (and adjustable) parameters:
- Batch size: 50
- Concurrency: 4
These values balance token usage and latency for `gpt-5-mini`. You can override with env `AI_BATCH_SIZE` and `AI_CONCURRENCY`.

## Columns Added
Each per-sheet output now includes:
- `ai_status`: `fixed` | `unfixed`
- `ai_reason`: reason when `unfixed` (empty if fixed)
This ensures you can filter without having to consult `Erreurs`.

## Reasons Catalog (Examples)
- `MCQ sans options`: No answer options present.
- `Résultat IA manquant`: Model didn’t return a row result.
- `IA: <message>`: Model error / parsing issue.
- `Aucun changement proposé par l’IA`: AI judged the row already consistent.
- `Réponse manquante` (QROC): Blank answer row.
- `Déjà expliqué`: QROC already had an explanation.
- `IA: pas d’explication`: Model failed to produce an explanation.

## Input vs Output Row Count Issue (Fixed)
### Previous Behavior
Only corrected ("fixed") rows were written to the per-type sheets; unfixed rows were excluded except inside `Erreurs`. This caused a mismatch: output sheet counts < input counts.

### Current Behavior
All rows are preserved in their original sheet with AI annotations. The workbook row count per sheet now equals the input (ignoring any entirely empty lines dropped during parsing). The `Erreurs` sheet is *additional* and does not remove rows elsewhere.

## SSE Payload Structure (Excerpt)
```
{
  id: string,
  phase: 'queued' | 'running' | 'complete' | 'error',
  progress: 0..100,
  message: string,
  logs: string[],
  stats: {
    totalRows: number,
    mcqRows: number,
    processedBatches: number,
    totalBatches: number,
    fixedCount: number,
    errorCount: number,
    reasonCounts: { [reason: string]: number },
    errorsPreview: Array<{ sheet: string; row: number; reason: string; question?: string; questionNumber?: number | null }>
  }
}
```

## How to Integrate in UI
1. `POST` the file -> receive `{ aiId }`.
2. Open `EventSource` to `/api/validation/ai-progress?aiId=...`.
3. Update progress bar from `progress` and `stats`.
4. When `phase === 'complete'`, enable download button.
5. Optionally render `errorsPreview` table.

## Custom Instructions
You can add domain-specific normalization instructions by including a text field `instructions` in the multipart form. These are passed as a system prompt override.

### Built‑in Default Prompt (FR – QCM Médicaux)
The default system prompt now enforces a French medical QCM correction style:
- Tone: final‑year med student explaining to peers (no formal intro/outro).
- Each option explanation starts with a varied connector (e.g. "Oui", "Exact", "Au contraire", "Non, en fait", etc.).
- Option explanations usually 1–2 sentences but can be longer if justified.
- Encourages citing an entire relevant sentence from provided context (future RAG integration) without saying "selon la source".
- Produces strict JSON only; number of optionExplanations equals number of provided options.
- If genuine uncertainty blocks evaluation: marks the item as error instead of hallucinating.

You can fully replace this behavior by supplying your own `instructions` payload; a custom prompt completely overrides the default system prompt.

### Optional RAG Enrichment
You can activate RAG enrichment so the AI bases explanations on your ingested course PDFs.

Configuration options:
- `RAG_INDEX_ID`: single index ID (UUID) to use for all MCQs.
- `RAG_INDEX_MAP`: JSON object mapping keys like "DCEM3|Neurologie" or "|Cardiologie" (matière-only) to specific index IDs. Keys are normalized (accents removed, lowercased). The map takes priority over `RAG_INDEX_ID`.
- `RAG_SEARCH_PER_OPTION` (default `1`): when enabled, the system searches for the question and each option text independently and merges results (notebook parity).
- `RAG_K` (default `10`): number of nearest chunks per query before merge/dedup.
- `RAG_TOP` (default `8`): top chunks kept after dedup and sorting.
- `RAG_CONTEXT_MAX` (default `2500`): max characters for the injected context.

Behavior:
- If an index is chosen for a question, the backend builds a `CONTEXTE (extraits cours …)` block containing bullet-listed top chunks, then appends the original question.
- The AI prompt explicitly instructs the model to prioritize this CONTEXTE and include exactly one quoted sentence copied from it in the explanations.
- If RAG lookup fails or no index matches, it silently falls back to the plain question.

Telemetry:
- The SSE log line at AI start includes `RAG appliqué: X/Y (manqué: Z)` so you can verify how many MCQs received context. This helps explain empty citation lines if RAG wasn't applied.

## Error Handling
- Database or OpenAI configuration issues are surfaced as `IA:` reasons in rows.
- The session is cleaned up automatically ~30 minutes after completion.
- Partial failures (e.g., one batch fails) mark only affected rows with error reasons and continue.

## Tuning Tips
| Goal | Parameter | Trade-off |
|------|-----------|-----------|
| Faster wall clock | Increase concurrency | More parallel token usage (rate limits) |
| Lower cost | Decrease batch size | More roundtrips (slower) |
| Better determinism | Add instructions | Slightly higher token usage |

## Future Enhancements (Ideas)
- Add token usage telemetry per batch.
- Retry strategy for transient OpenAI failures.
- Expose a filter to hide already "fixed" rows in UI preview.
- Automatic detection of duplicated questions before AI pass.

## Troubleshooting
| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| Output has fewer rows (old behavior) | Version before full-row preservation | Re-run with updated backend |
| Many `Résultat IA manquant` | Model JSON parse failure | Increase system prompt clarity / add retry |
| All QROC explanations missing | Chat deployment misconfigured | Check `AZURE_OPENAI_CHAT_DEPLOYMENT` env |
| Slow first batch | Cold start / network | First batch warms; subsequent faster |

## Environment Variables
- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_TARGET`, `AZURE_OPENAI_CHAT_DEPLOYMENT` must be set.
- Optional: `AUTH_REQUIRE_EMAIL_VERIFICATION=false` if you want immediate access after registration.

## Summary
The AI pipeline now preserves every input row, annotates them with correction status, centralizes unfixed reasons, and streams structured progress for UI feedback. Row count mismatches are resolved.
