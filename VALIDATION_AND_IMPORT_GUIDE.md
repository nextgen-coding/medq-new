# Validation (Filter) & Import — How It Works

This guide explains the two-step pipeline used to bring your question bank into the app:
1) **Validation (aka Filter)** — sanity checks and normalization of your Excel workbook
2) **Import** — creates Questions in the database based on the validated structure

Both steps accept one Excel workbook (.xlsx) with one or more sheets named:
- `qcm`
- `qroc`
- `cas qcm` (aka `cas_qcm`)
- `cas qroc` (aka `cas_qroc`)

Common variations (hyphen/underscore/spacing or clinic wording) are accepted automatically.

---

## 1) Validation (Filter)
**Location**: Admin → Validation

**Purpose**: Quickly verify that your workbook is usable, highlight missing fields, and help you fix rows before import.

### What it checks
- Workbook not empty, at least one recognized sheet
- Columns present per sheet type (see below)
- QCM answers are valid (A–E), or explicit "no answer": `?` / `Pas de réponse`
- QROC answers not empty
- Explanations present: either a global `explication` or per-option explanations
- Optional: logs any detected image/URL column (used later by import)

### Canonical headers by sheet

#### QCM
- **Required**: `matiere` (specialty), `cours` (lecture), `texte de la question`, at least one `option a..e`
- **Recommended**: `explication` (global) or `explication a..e`
- **Optional**: `reponse` (A..E), `niveau`, `semestre`, `image`

#### QROC
- **Required**: `matiere`, `cours`, `texte de la question`, `reponse`
- **Recommended**: `explication`
- **Optional**: `niveau`, `semestre`, `image`

#### CAS QCM
- **Required**: `matiere`, `cours`, `texte du cas` or `case`, `texte de question`, `option a..e`
- **Optional**: `reponse`, `explication` or `explication a..e`, `niveau`, `semestre`, `image`

#### CAS QROC
- **Required**: `matiere`, `cours`, `texte du cas` or `case`, `texte de question`, `reponse`
- **Optional**: `explication`, `niveau`, `semestre`, `image`

### Normalization performed
- Sheet name normalization (hyphens/underscores/spaces/clinic wording)
- Header normalization (e.g., `texte question` → `texte de la question`)
- Trimming of values, conversion of non-string cell values to strings
- QCM `reponse` letters (A–E) are accepted in flexible formats ("A, C", "ACE", etc.)

### Outputs
- Good rows (pass checks) vs Bad rows (with a reason) shown in the UI
- You can download or continue to the AI Assistance step to auto-fix formatting/explanations

---

## 2) Import
**Location**: Admin → Import

**Purpose**: Persist validated questions into the database (Prisma) and attach metadata.

### How mapping works
- **Specialty & lecture**: matched or created based on `matiere`/`cours`
- **Question type** is inferred from the sheet:
  - `qcm` → MCQ
  - `qroc` → QROC
  - `cas qcm` → Case MCQ
  - `cas qroc` → Case QROC
- **Options**: read from `option a..e` columns; empty/missing options are skipped
- **Answers**:
  - MCQ: letters A–E are parsed to indices 0..4; explicit no-answer (`?` / `Pas de réponse`) becomes an empty set
  - QROC: `reponse` is copied as the single correct answer
- **Explanations**: if global `explication` exists, it is stored; per-option explanations are appended neatly by Import
- **Media**: an `image`/URL column is attached when present; the import logs it

### Safety checks during import
- Strict deduplication key built from full row content to avoid double inserts
- Per-row error handling: a failing row doesn't stop the whole file; errors are logged in progress
- Progress is streamed; you see counts as the file is processed

### Tips for a smooth import
- Keep sheet names canonical or obvious variants
- Provide either a global `explication` or per-option explanations for MCQ
- Use `?` or `Pas de réponse` for "no answer" QCM cases
- Prefer concise, clear QROC answers
- Put an `image` column only when you have a usable URL or image reference

---

## Integration with AI Assistance

If your workbook is messy (answers format, explanations, spacing), run **AI Assistance** first:
1. Go to **Admin → Validation → Assistance IA**
2. Upload your Excel file
3. The AI produces a fixed workbook `ai_fixed.xlsx` with:
   - Normalized answers/explanations
   - Medical student style explanations with French connectors
   - Proper answer formatting (A-E for QCM)
   - Clean text formatting
4. Then import the fixed workbook to minimize manual edits and errors

### AI Processing Features
- **Batch Processing**: Processes 200 items per batch with 12 concurrent API calls for maximum speed
- **Real-time Progress**: Server-Sent Events (SSE) streaming for live updates
- **Medical Style**: Uses varied French connectors ("Oui", "Exact", "Au contraire", etc.)
- **Smart Validation**: Automatically fixes common formatting issues

---

## Troubleshooting

### Common Issues and Solutions

#### Validation Phase
- **"Workbook is empty / no recognized sheets"** → Rename sheets to `qcm`, `qroc`, `cas qcm`, `cas qroc`
- **"MCQ missing options"** → Ensure `option a` (and others) columns are present and non-empty
- **"QROC missing answer"** → Fill `reponse` column
- **"Invalid MCQ answer token"** → Use only A–E, `?`, or `Pas de réponse`

#### Import Phase
- **"Duplicate row"** → The exact content already exists; adjust or remove duplicates
- **"Specialty not found"** → Check `matiere` column spelling and consistency
- **"Lecture creation failed"** → Ensure `cours` column is properly filled

#### AI Assistance
- **Slow processing** → System is optimized for maximum speed (200 batch size, 12 concurrency)
- **Jobs not showing as completed** → Check the "Gestion des Jobs IA" section at the bottom
- **Download not working** → Use the download button in either the top sessions or bottom job management

---

## File Structure Requirements

### Excel File Format
- **File type**: `.xlsx` only
- **Sheets**: One or more recognized sheet names
- **Headers**: First row must contain column headers
- **Data**: Starting from row 2

### Sheet Naming Conventions
Accepted variations for sheet names:
- `qcm`, `QCM`, `Qcm`
- `qroc`, `QROC`, `Qroc`
- `cas qcm`, `cas_qcm`, `cas-qcm`, `CAS QCM`, `CAS_QCM`
- `cas qroc`, `cas_qroc`, `cas-qroc`, `CAS QROC`, `CAS_QROC`

### Column Header Flexibility
The system accepts various formats:
- `matiere` / `matière` / `Matière`
- `cours` / `Cours`
- `texte de la question` / `texte question` / `question`
- `option a` / `Option A` / `OPTION A`
- `reponse` / `réponse` / `Réponse`
- `explication` / `Explication`

---

## Workflow Summary

1. **Prepare Excel File**
   - Use recognized sheet names
   - Include required columns for each sheet type
   - Fill in questions, options, and answers

2. **Validation Step**
   - Upload to Admin → Validation
   - Review good/bad rows
   - Fix issues or proceed to AI Assistance

3. **AI Assistance (Optional)**
   - Use for automatic formatting and explanation enhancement
   - Download the `ai_fixed.xlsx` file
   - Faster processing with optimized batch settings

4. **Import Step**
   - Upload validated file to Admin → Import
   - Monitor real-time progress
   - Questions are created in database

5. **Verification**
   - Check imported questions in the system
   - Verify specialties and lectures were created correctly
   - Test questions in exercise mode

---

For detailed AI behavior (per-option explanations, source cleaning), see the AI system documentation in the validation interface.