# AI Explanation Prompt & Modes

This document summarizes how AI explanations for QCM/QROC are generated and how to control their style depth.

## Overview
The system generates per-option medical explanations with varied French connectors and a synthesis block. It supports two detail modes controlled by environment variable:

| Mode | Env var `AI_EXPLANATION_STYLE` | Intent | Per-option length | Extra content |
|------|--------------------------------|--------|-------------------|---------------|
| Student (default) | (unset) or `student` | Fast high-yield peer explanation | 1–2 sentences (up to 3–4 if mechanism) | Mechanism OR correction OR key epidemiology |
| Professor | `prof` | Rich, structured, exam-level depth | 2–4 sentences (up to 5 if justified) | Mechanism + consequence + differential/pitfall + optional stat |

## Connectors
The post-processor enforces varied starters (no repetition when possible):
`Oui`, `Exact`, `Effectivement`, `Au contraire`, `Non, en fait`, `Plutôt`, `Pas vraiment`, `Correct`, `Faux`, `Juste`.

If a generated explanation already begins with a valid connector, it is preserved. Otherwise one is injected.

## JSON Output Contract (MCQ)
```
{
  "results": [ {
    "id": "string",
    "status": "ok" | "error",
    "fixedQuestionText": "string",
    "fixedOptions": ["cleaned A", ...],
    "correctAnswers": [0,2],
    "optionExplanations": ["Oui …", "Au contraire …", ...],
    "globalExplanation": "Synthèse 2–4 phrases",
    "error": "(if status=error)"
  } ]
}
```
Rules:
- `optionExplanations.length === options.length` input.
- Indices for `correctAnswers` (A=0).
- No markdown, no extraneous keys.
- All explanations start with a connector after post-processing.

## QROC Output Contract
```
{
  "results": [ { "id": "string", "status": "ok" | "error", "fixedQuestionText": "...", "explanation": "...", "error": "..." } ]
}
```
If the answer is missing we currently DO NOT return `error` (we attempt repair / enrichment) in the streaming variant; in validation processor we may still mark missing answers depending on context.

## Environment Variables
- `AI_EXPLANATION_STYLE=prof` → enables richer professor-level detail.
- `AI_BATCH_SIZE`, `AI_CONCURRENCY` → performance tuning.

## Implementation Entry Points
- MCQ processing: `src/lib/ai/aiValidationProcessor.ts` (defaultSystem prompt building & `applyConnectors`).
- QROC processing: same file (QROC prompt section later in pipeline).
- Streaming admin validation session variant: `src/app/api/validation/ai-progress/route.ts` (simpler system prompt).

## Extending
Add new connectors: update `CONNECTORS` array. Keep short and unambiguous.
Add a new mode: branch on `process.env.AI_EXPLANATION_STYLE` and append a new style block.

## Quality Hints
- If output seems too short in `prof` mode, raise `maxTokens` or slightly encourage more layering (mechanism → implication → differential) in the style block.
- Avoid hallucinated numbers: instruction explicitly says only include figures when certain.

## Quick Switch
In `.env.local`:
```
AI_EXPLANATION_STYLE=prof
```
Restart the server; new jobs will use the professor prompt.

---
Last updated: 2025-09-16
