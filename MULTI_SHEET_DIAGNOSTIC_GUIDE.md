# Multi-Sheet Excel Processing - Diagnostic Logging Guide

## Overview

This document explains the comprehensive logging system added to diagnose issues with Excel files containing multiple sheets (like "Copy of DCEM 2.xlsx").

## Problem

When uploading Excel files with multiple sheets, users reported incorrect total question counts. The system needs to:
1. Recognize sheet names correctly (QCM, QROC, CAS QCM, CAS QROC)
2. Parse all rows from recognized sheets
3. Filter out empty rows
4. Show accurate counts by type

## Diagnostic Logging Added

### 1. **Workbook Analysis** 📄

When a file is uploaded, the system logs:

```
[AI] 📄 Workbook Analysis: Found 3 sheet(s): QCM, QROC, Feuille ignorée
```

**What it shows:**
- Total number of sheets in the Excel file
- Names of all sheets found

**What to check:**
- Are your sheet names correct? (should contain "qcm", "qroc", "cas qcm", or "cas qroc")
- Are sheets named in French or English?

---

### 2. **Per-Sheet Analysis** 📊

For each sheet, the system logs:

```
[AI] 📊 Sheet "QCM": 523 total rows (including header)
[AI] 🔍 Sheet "QCM": Mapped to "qcm" (isErrorExport: false)
[AI] ✅ Sheet "QCM": Added 522 rows as type "qcm"
```

**What it shows:**
- Total rows in the sheet (including header row)
- How the sheet name was mapped (qcm, cas_qcm, qroc, cas_qroc, or NOT RECOGNIZED)
- Whether it's an error export format
- How many data rows were added

**What to check:**
- Does the row count match your expectations?
- Is the sheet type correctly mapped?
- If NOT RECOGNIZED, the sheet name doesn't match the expected patterns

**Example - Unrecognized sheet:**
```
[AI] 📊 Sheet "Feuille1": 100 total rows (including header)
[AI] 🔍 Sheet "Feuille1": Mapped to "NOT RECOGNIZED" (isErrorExport: false)
[AI] ❌ Sheet "Feuille1": Not recognized - skipped
```

---

### 3. **Total Row Count** 📋

After processing all sheets:

```
[AI] 📋 Total: 845 rows from 2 recognized sheet(s)
```

**What it shows:**
- Total rows parsed from ALL recognized sheets combined
- Number of sheets that were successfully recognized

**Note:** This count includes empty rows! Filtering happens next.

---

### 4. **Rows by Type** 📊

Before filtering empty rows:

```
[AI] 📊 Rows by type (before filtering): QCM=522, CAS_QCM=0, QROC=323, CAS_QROC=0, Total=845
```

**What it shows:**
- How many rows belong to each question type
- Breakdown: QCM, CAS_QCM, QROC, CAS_QROC
- Total must equal the previous step

**What to check:**
- Do the counts match your sheets?
- Are questions distributed correctly by type?

---

### 5. **MCQ Filtering** 🔍

After removing empty MCQ rows:

```
[AI] 🔍 MCQ Filtering: 487 non-empty rows kept, 35 empty rows removed (from 522 total MCQ rows)
```

**What it shows:**
- How many MCQ questions are valid (non-empty)
- How many empty rows were removed
- Original total before filtering

**Empty row criteria:**
- No question text (`texte de la question` AND `texte du cas` both empty)
- No options (all options A-E empty)
- No answer (`reponse` empty)

**What to check:**
- If many rows are removed, check your Excel for blank rows
- Empty rows between data rows are common in exports

---

### 6. **QROC Filtering** 🔍

After removing empty QROC rows:

```
[AI] 🔍 QROC Filtering: 298 non-empty rows kept, 25 empty rows removed (from 323 total QROC rows)
```

**What it shows:**
- How many QROC questions are valid (non-empty)
- How many empty rows were removed
- Original total before filtering

**Same empty row criteria as MCQ**

---

### 7. **Processing Summary** 📈

Final summary before AI processing:

```
[AI] 📈 Processing Summary: 487 MCQ + 298 QROC = 785 total questions to process
```

**What it shows:**
- Final count of MCQ questions (after filtering)
- Final count of QROC questions (after filtering)
- **Total questions that will be processed by AI**

**This is the true count!** This number should match your expectations.

---

### 8. **UI Messages** 🧠

You'll also see updates in the UI:

```
📋 845 lignes trouvées dans 2 feuille(s)
🧠 Démarrage IA MCQ: 487 questions
📋 Total: 487 MCQ + 298 QROC = 785 questions
```

**What it shows:**
- Total raw rows found
- MCQ questions being processed
- Final total including QROC

---

## Common Issues & Solutions

### Issue 1: "Sheet not recognized"

**Symptoms:**
```
[AI] ❌ Sheet "Feuille1": Not recognized - skipped
```

**Solution:**
Rename your sheet to include one of these keywords (case-insensitive):
- `qcm` → Will be treated as QCM
- `qroc` → Will be treated as QROC
- `cas qcm` or `qcm cas` → Will be treated as CAS_QCM
- `cas qroc` or `qroc cas` → Will be treated as CAS_QROC

**Examples of valid sheet names:**
- ✅ "QCM"
- ✅ "qcm 2024"
- ✅ "Cas QCM"
- ✅ "QROC - Semestre 1"
- ✅ "cas_qroc"
- ❌ "Questions" (doesn't contain keyword)
- ❌ "Feuille1" (doesn't contain keyword)

---

### Issue 2: "Too many empty rows removed"

**Symptoms:**
```
[AI] 🔍 MCQ Filtering: 100 non-empty rows kept, 2000 empty rows removed
```

**Causes:**
1. Excel has blank rows between data
2. Excel formatting extends beyond actual data
3. Headers are repeated multiple times

**Solution:**
1. Open Excel and select all rows after your data
2. Right-click → Delete rows
3. Save the file
4. Re-upload

---

### Issue 3: "Count doesn't match my sheet"

**Symptoms:**
```
[AI] 📊 Sheet "QCM": 2749 total rows (including header)
```
But you only have 500 questions.

**Causes:**
1. Excel file has empty rows (common in exports)
2. Formatting extends beyond data

**Check the filtering log:**
```
[AI] 🔍 MCQ Filtering: 487 non-empty rows kept, 2262 empty rows removed
```

**Solution:**
The system automatically filters empty rows. The final count (487) is correct. If you want to clean up the Excel file, use Excel's "Ctrl+End" to see where Excel thinks the data ends, then delete unnecessary rows.

---

### Issue 4: "Multiple sheets combined incorrectly"

**Symptoms:**
```
[AI] 📊 Rows by type (before filtering): QCM=2000, CAS_QCM=1000, QROC=0, CAS_QROC=0
```
But you expected separate counts.

**Explanation:**
If you have two sheets both named "QCM" or similar, they'll be combined into the same category.

**Solution:**
- This is intended behavior - all QCM questions are processed together
- If you want to track them separately, process them in separate uploads
- Or keep them combined - the system handles both correctly

---

### Issue 5: "Error export format detected"

**Symptoms:**
```
[AI] 🔍 Sheet "Errors": Mapped to "NOT RECOGNIZED" (isErrorExport: true)
```

**Explanation:**
The system detected a special "error export" format (has a "sheet" column). This is from a previous validation that had errors. The system will automatically re-map rows to their correct types.

**Solution:**
This is handled automatically. No action needed.

---

## Reading the Full Log Sequence

Here's a complete example with a multi-sheet file:

```
[AI] 📄 Workbook Analysis: Found 3 sheet(s): QCM DCEM 2, QROC DCEM 2, Stats

[AI] 📊 Sheet "QCM DCEM 2": 523 total rows (including header)
[AI] 🔍 Sheet "QCM DCEM 2": Mapped to "qcm" (isErrorExport: false)
[AI] ✅ Sheet "QCM DCEM 2": Added 522 rows as type "qcm"

[AI] 📊 Sheet "QROC DCEM 2": 324 total rows (including header)
[AI] 🔍 Sheet "QROC DCEM 2": Mapped to "qroc" (isErrorExport: false)
[AI] ✅ Sheet "QROC DCEM 2": Added 323 rows as type "qroc"

[AI] 📊 Sheet "Stats": 10 total rows (including header)
[AI] 🔍 Sheet "Stats": Mapped to "NOT RECOGNIZED" (isErrorExport: false)
[AI] ❌ Sheet "Stats": Not recognized - skipped

[AI] 📋 Total: 845 rows from 2 recognized sheet(s)

[AI] 📊 Rows by type (before filtering): QCM=522, CAS_QCM=0, QROC=323, CAS_QROC=0, Total=845

[AI] 🔍 MCQ Filtering: 487 non-empty rows kept, 35 empty rows removed (from 522 total MCQ rows)
[AI] 🔍 QROC Filtering: 298 non-empty rows kept, 25 empty rows removed (from 323 total QROC rows)
[AI] 📈 Processing Summary: 487 MCQ + 298 QROC = 785 total questions to process
```

**Interpretation:**
1. ✅ File has 3 sheets
2. ✅ 2 sheets recognized (QCM DCEM 2, QROC DCEM 2)
3. ✅ 1 sheet ignored (Stats - not a question type)
4. ✅ 845 rows parsed total
5. ✅ 522 MCQ + 323 QROC = 845 rows
6. ✅ 60 empty rows removed (35 MCQ + 25 QROC)
7. ✅ **Final: 785 questions will be processed (487 MCQ + 298 QROC)**

---

## Where to Find Logs

### Console Logs (Server-side)
- Open your terminal where the Next.js dev server is running
- All `[AI]` prefixed logs appear here
- Best for debugging and detailed analysis

### UI Details Dialog (Client-side)
- Click the "Details" button (Terminal icon) on the AI job card
- Shows selected logs that were sent to the UI
- Good for user-friendly progress tracking

---

## Technical Details

### Sheet Name Mapping Logic

```typescript
function mapSheetName(s: string): SheetName | null {
  const norm = normalizeSheetName(s); // lowercase, remove accents, collapse spaces
  if (norm.includes('qcm') && norm.includes('cas')) return 'cas_qcm';
  if (norm.includes('qroc') && norm.includes('cas')) return 'cas_qroc';
  if (norm.includes('qcm')) return 'qcm';
  if (norm.includes('qroc')) return 'qroc';
  return null;
}
```

**Priority:**
1. CAS_QCM (if both "qcm" and "cas" present)
2. CAS_QROC (if both "qroc" and "cas" present)
3. QCM (if "qcm" present)
4. QROC (if "qroc" present)
5. NULL (not recognized)

### Empty Row Detection Logic

```typescript
const isEmptyRow = (rec: Record<string, any>) => {
  const emptyOptions = ['option a','option b','option c','option d','option e'].every(k => !String(rec[k] || '').trim());
  const noQuestion = !String(rec['texte de la question'] || '').trim() && !String(rec['texte du cas'] || '').trim();
  const noAnswer = !String(rec['reponse'] || '').trim();
  return noQuestion && emptyOptions && noAnswer;
};
```

**A row is considered empty if ALL of these are true:**
- No question text (both `texte de la question` AND `texte du cas` are empty)
- No options (all options A-E are empty)
- No answer (réponse is empty)

**A row is kept if ANY of these have content:**
- Question text
- Case text
- At least one option
- Answer

---

## Files Modified

1. **`src/app/api/validation/ai-progress/route.ts`**
   - Added comprehensive sheet analysis logging
   - Added per-sheet row count logging
   - Added sheet mapping logging
   - Added row type breakdown logging
   - Added MCQ/QROC filtering logs with counts
   - Added processing summary log

---

## Testing Checklist

When testing with a new file, verify:

- [ ] All sheets are listed in the workbook analysis
- [ ] Each sheet shows total row count
- [ ] Each sheet shows correct mapping (qcm/qroc/cas_qcm/cas_qroc)
- [ ] Recognized sheets show "Added X rows"
- [ ] Unrecognized sheets show "Not recognized - skipped"
- [ ] Total rows match sum of all recognized sheets
- [ ] Row type breakdown matches your sheets
- [ ] Empty row filtering shows reasonable numbers
- [ ] Final processing summary shows correct total
- [ ] UI shows same counts as console logs

---

## Support

If the logs don't make sense or show unexpected behavior:

1. **Copy the full log sequence** from the console
2. **Check each sheet name** in your Excel file
3. **Look for the "NOT RECOGNIZED" messages** - these sheets are being ignored
4. **Compare final counts** - the last "Processing Summary" is the truth
5. **Check for empty rows** - if many are removed, your Excel has formatting issues

The logging is comprehensive and should pinpoint exactly where the issue is!
