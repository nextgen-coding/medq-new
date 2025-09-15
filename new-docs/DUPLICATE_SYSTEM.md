# Duplicate Detection (Import)

This short note explains how duplicates are detected during Excel imports.

## Where
- Logic lives in `src/app/api/questions/bulk-import-progress/route.ts`.
- Errors are surfaced live in the import UI and can be downloaded as CSV/XLSX.

## 1) File‑level duplicates (within the same uploaded file)
- We compute a strict key over the entire row (all canonicalized columns, values trimmed).
- If another identical row (same key) appears later, it’s rejected.
- Error message example: `Duplicate in file: identical row already present (matches row 7)`.

Notes:
- Header names are canonicalized (e.g., `texte question` → `texte de la question`).
- Cell values are compared as strings after trim.

How it works (under the hood):
- Scope: detection runs per sheet inside the uploaded workbook (QCM, QROC, etc.). Two identical rows on different sheets are allowed; two identical rows on the same sheet are rejected.
- Canonical headers: the first row (header) is normalized using aliases (accents removed, common variants mapped). This ensures we compare the same fields across rows.
- Row normalization: for each data row, we build an object with only the sheet’s columns; each cell is converted to a string and trimmed (leading/trailing spaces removed). Internal spaces/punctuation are preserved.
- Key generation: we take all keys present in that sheet, sort them alphabetically for stability, and build a key like `key1=value1|key2=value2|...`.
- First‑seen map: when a row’s key is seen for the first time, we store its index; if the same key appears again, we reject the later row and point to the earlier row number (header offset included).

Exact‑match rules (what counts as the “same” row):
- Same header set (implicitly true within one sheet) and the same cell values after String() + trim.
- `"  A, C  "` vs `"A, C"` → considered the same (only edges trimmed).
- `"A, C"` vs `"A,C"` → different (internal punctuation/spacing differs and is preserved).
- `1` vs `"1"` → same (both become `"1"`). `1.0` vs `1` → different (`"1.0"` ≠ `"1"`).
- Empty or missing cells become empty strings; two empty cells compare equal.

Examples:
- Duplicate:
  - Row 5: `matiere=Cardio`, `cours=Intro`, `question n=1`, `texte de la question="Un QCM"`, `reponse="A, C"`.
  - Row 12: same values (even if padded with spaces). → Rejected with `matches row 5`.
- Not a duplicate:
  - Row 5: `reponse="A, C"` vs Row 12: `reponse="A,C"`. → Allowed (internal comma spacing differs).
  - Row 5: `question n=1` vs Row 12: `question n=2`. → Allowed (value differs).

## 2) Database‑level duplicates (already imported)
- After normalizing the new row, we search existing questions in the same lecture and only reject if ALL fields match.
- Exact‑match fields:
  - lectureId, text, type
  - options (order‑sensitive)
  - correctAnswers (order‑sensitive, indexes of A=0..E)
  - explanation (combined from `explication` + per‑option explanations)
  - courseReminder (rappel)
  - session (source)
  - number (question n)
  - mediaUrl, mediaType
  - caseNumber, caseText, caseQuestionNumber (for clinical sheets)
- Error message: `Duplicate in database: exact duplicate (all fields equal) already exists`.

## Edge cases and normalization
- Whitespace is trimmed; header aliases are unified.
- `session/source` may be cleaned (bare niveau like `DCEM3` without year is cleared), which affects equality.
- If answers mean “no answer” (e.g., `?` or `Pas de réponse`), that becomes an empty correctAnswers array.
- Explanations can be merged (global + per‑option) before comparison.

## How to resolve a duplicate
- Change any relevant field (e.g., question number, text, options, session, or explanation), or remove the duplicate row.
- For file‑level duplicates, keep only one row.

If you need a "near‑duplicate" check (same text/options but different number), we can add a softer rule alongside the current exact‑match rule.
