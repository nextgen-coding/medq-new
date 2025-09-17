# Import and Validation Guide

This guide explains how to validate and import questions, with exact duplicate rules and download options.

## Workflow Overview

- Validate your Excel workbook first via Admin → Validation.
- See counts of valid vs. error rows per sheet (QCM, QROC, CAS QCM, CAS QROC).
- Download two Excel files: only valid, only errors. You can also send the error file to the AI assistant for fixes.
- Import the validated data using the import endpoints/panels.

## File Types

- XLSX/XLS for multi-sheet workbooks with sheets named (case/spacing tolerant): qcm, qroc, cas_qcm, cas_qroc.
- CSV for quick import to a lecture (QROC), see headers below.

## Sheet/Header Conventions (XLSX)

Common columns:
- texte de la question: string (required)
- specialite: string (required)
- cours: string (optional)
- cas: string (optional; only for cas_* sheets)
- niveau: string (required)
- semestre: string (required)

QCM / cas_qcm additional:
- option 1..5: strings (at least two non-empty required)
- bonne reponse: letters A–E (one or more)
- explication: string (required)

QROC / cas_qroc additional:
- reponse: string (required)
- explication: string (required)

Images are supported by including URLs in the question text or reminder fields; media is handled separately during creation.

## Duplicate Rules

- Validation: detects duplicates within a sheet by a canonical key (normalized text/options) to highlight potential issues; duplicates remain in the JSON but are marked.
- Import (strict): a row is considered a duplicate of another row in the SAME FILE only if ALL included fields are byte-for-byte identical after header normalization. Only the first occurrence is imported.
- DB-level identical check: before creating a question, the system checks for an identical existing question (lectureId, type, text, answers/options, number, session, and reminder). Identical matches are skipped to prevent true duplicates.

## Endpoints

- POST /api/validation: upload XLSX to get JSON counts and details.
- GET /api/validation?download=valid|errors: download validated subsets as XLSX.
- POST /api/questions/import: CSV → specific lecture (QROC) with strict duplicate semantics.
- Optional bulk import: if enabled, POST /api/questions/bulk-import with XLSX; then poll GET /api/questions/bulk-import-progress?id=…

## CSV Import (QROC to a Lecture)

Required headers (lowercase, exact):
- matiere, cours, question n, source, texte de la question, reponse

Behavior:
- Full-row duplicate detection inside the same CSV file: only first occurrence kept.
- DB identical check: if a question with same lectureId/type/text/answers/number/session/reminder exists, it is skipped.
- Errors are reported with row numbers and reasons.

## Admin UI Hints

- Admin → Validation: drag your XLSX; review counts; download valid/errors; optional “Send errors to AI”.
- Admin → Import: use bulk import for full workbooks or quick CSV for a single lecture.
- Exercices page supports grouped QROC and grouped QCM blocks with the same interaction model as clinical cases.

## Troubleshooting

- Headers mismatch: ensure names match the conventions above; accents and spaces are accepted but normalized.
- No-answer markers: QCM must have at least one correct letter; explicit “no answer” markers are rejected by validation.
- Dark mode UI: all validation/import panels support dark mode; report any visual bugs.

## Future Extensions

- Add session linking during import.
- AI-assisted correction pipeline from the errors workbook.
