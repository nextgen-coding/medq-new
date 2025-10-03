/**
 * Test script to analyze Excel file structure
 * This simulates the sheet processing logic from ai-progress/route.ts
 * 
 * Usage: node test-sheet-analysis.js
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ============= SAME LOGIC AS route.ts =============

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^\w\s]/g, ' ') // punctuation to spaces
    .replace(/\s+/g, ' ') // collapse
    .trim();
}

const headerAliases = {
  'matiere': 'matiere',
  'cours': 'cours',
  'question n': 'question n',
  'question no': 'question n',
  'question n°': 'question n',
  'source': 'source',
  'texte de la question': 'texte de la question',
  'texte question': 'texte de la question',
  'texte de question': 'texte de la question',
  'texte du cas': 'texte du cas',
  'texte cas': 'texte du cas',
  'option a': 'option a',
  'option b': 'option b',
  'option c': 'option c',
  'option d': 'option d',
  'option e': 'option e',
  'reponse': 'reponse',
  'reponse(s)': 'reponse',
  'cas n': 'cas n',
  'cas no': 'cas n',
  'cas n°': 'cas n',
  'explication': 'explication',
  'explication de la reponse': 'explication',
  'explication de la réponse': 'explication',
  'explication reponse': 'explication',
  'explanation': 'explication',
  'correction': 'explication',
  'explication a': 'explication a',
  'explication b': 'explication b',
  'explication c': 'explication c',
  'explication d': 'explication d',
  'explication e': 'explication e',
  'explication A': 'explication a',
  'explication B': 'explication b',
  'explication C': 'explication c',
  'explication D': 'explication d',
  'explication E': 'explication e',
  'niveau': 'niveau',
  'level': 'niveau',
  'semestre': 'semestre',
  'semester': 'semestre',
  'rappel': 'rappel',
  'rappel du cours': 'rappel',
  'rappel cours': 'rappel',
  'course reminder': 'rappel',
  'rappel_cours': 'rappel',
  'image': 'image',
  'image url': 'image',
  'image_url': 'image',
  'media': 'image',
  'media url': 'image',
  'media_url': 'image',
  'illustration': 'image',
  'illustration url': 'image'
};

function canonicalizeHeader(h) {
  const n = normalizeHeader(h);
  return headerAliases[n] || n;
}

function normalizeSheetName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mapSheetName(s) {
  const norm = normalizeSheetName(s);
  if (norm.includes('qcm') && norm.includes('cas')) return 'cas_qcm';
  if (norm.includes('qroc') && norm.includes('cas')) return 'cas_qroc';
  if (norm.includes('qcm')) return 'qcm';
  if (norm.includes('qroc')) return 'qroc';
  return null;
}

function isEmptyRow(rec) {
  const emptyOptions = ['option a','option b','option c','option d','option e'].every(k => !String(rec[k] || '').trim());
  const noQuestion = !String(rec['texte de la question'] || '').trim() && !String(rec['texte du cas'] || '').trim();
  const noAnswer = !String(rec['reponse'] || '').trim();
  return noQuestion && emptyOptions && noAnswer;
}

// ============= TEST SCRIPT =============

console.log('='.repeat(80));
console.log('📊 EXCEL FILE ANALYSIS TEST');
console.log('='.repeat(80));
console.log('');

const filePath = path.join(__dirname, 'Copy of DCEM 2.xlsx');

if (!fs.existsSync(filePath)) {
  console.error('❌ ERROR: File not found!');
  console.error(`   Looking for: ${filePath}`);
  console.error('');
  console.error('   Make sure "Copy of DCEM 2.xlsx" is in the project root directory.');
  process.exit(1);
}

console.log(`📁 Reading file: ${path.basename(filePath)}`);
console.log('');

try {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer);
  
  const sheetNames = Object.keys(workbook.Sheets || {});
  
  console.log('─'.repeat(80));
  console.log('1️⃣  WORKBOOK ANALYSIS');
  console.log('─'.repeat(80));
  console.log(`[AI] 📄 Workbook Analysis: Found ${sheetNames.length} sheet(s): ${sheetNames.join(', ')}`);
  console.log('');
  
  // Gather rows
  const rows = [];
  let recognizedSheetCount = 0;
  const sheetStats = [];
  
  console.log('─'.repeat(80));
  console.log('2️⃣  PER-SHEET ANALYSIS');
  console.log('─'.repeat(80));
  
  for (const s of Object.keys(workbook.Sheets)) {
    const ws = workbook.Sheets[s];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    console.log(`\n[AI] 📊 Sheet "${s}": ${data.length} total rows (including header)`);
    
    if (data.length < 2) {
      console.log(`[AI] ⚠️  Sheet "${s}": Skipped (less than 2 rows)`);
      sheetStats.push({ name: s, status: 'skipped-empty', rows: 0, type: null });
      continue;
    }
    
    const headerRaw = (data[0] || []).map(h => String(h ?? ''));
    const header = headerRaw.map(canonicalizeHeader);
    const canonicalName = mapSheetName(s);
    const isErrorExport = !canonicalName && header.includes('sheet');
    
    console.log(`[AI] 🔍 Sheet "${s}": Mapped to "${canonicalName || 'NOT RECOGNIZED'}" (isErrorExport: ${isErrorExport})`);
    
    if (isErrorExport) {
      let errorExportCount = 0;
      for (let i = 1; i < data.length; i++) {
        const row = data[i] || [];
        const record = {};
        header.forEach((h, idx) => {
          record[String(h)] = String((row)[idx] ?? '').trim();
        });
        const target = mapSheetName(String(record['sheet'] || '')) || 'qcm';
        rows.push({ sheet: target, row: i + 1, original: record });
        errorExportCount++;
      }
      console.log(`[AI] ✅ Sheet "${s}": Processed ${errorExportCount} error export rows`);
      sheetStats.push({ name: s, status: 'error-export', rows: errorExportCount, type: 'mixed' });
    } else if (canonicalName) {
      recognizedSheetCount++;
      let sheetRowCount = 0;
      for (let i = 1; i < data.length; i++) {
        const row = data[i] || [];
        const record = {};
        header.forEach((h, idx) => {
          record[String(h)] = String((row)[idx] ?? '').trim();
        });
        rows.push({ sheet: canonicalName, row: i + 1, original: record });
        sheetRowCount++;
      }
      console.log(`[AI] ✅ Sheet "${s}": Added ${sheetRowCount} rows as type "${canonicalName}"`);
      sheetStats.push({ name: s, status: 'recognized', rows: sheetRowCount, type: canonicalName });
    } else {
      console.log(`[AI] ❌ Sheet "${s}": Not recognized - skipped`);
      sheetStats.push({ name: s, status: 'not-recognized', rows: 0, type: null });
    }
  }
  
  console.log('');
  console.log(`[AI] 📋 Total: ${rows.length} rows from ${recognizedSheetCount} recognized sheet(s)`);
  
  // Count by type before filtering
  const qcmCount = rows.filter(r => r.sheet === 'qcm').length;
  const casQcmCount = rows.filter(r => r.sheet === 'cas_qcm').length;
  const qrocCount = rows.filter(r => r.sheet === 'qroc').length;
  const casQrocCount = rows.filter(r => r.sheet === 'cas_qroc').length;
  
  console.log('');
  console.log('─'.repeat(80));
  console.log('3️⃣  ROWS BY TYPE (BEFORE FILTERING)');
  console.log('─'.repeat(80));
  console.log(`[AI] 📊 Rows by type (before filtering): QCM=${qcmCount}, CAS_QCM=${casQcmCount}, QROC=${qrocCount}, CAS_QROC=${casQrocCount}, Total=${rows.length}`);
  
  // Filter MCQ rows
  const mcqRowsBeforeFilter = rows.filter(r => r.sheet === 'qcm' || r.sheet === 'cas_qcm');
  const mcqRows = rows.filter(r => {
    if (r.sheet !== 'qcm' && r.sheet !== 'cas_qcm') return false;
    return !isEmptyRow(r.original);
  });
  const emptyMcqCount = mcqRowsBeforeFilter.length - mcqRows.length;
  
  // Filter QROC rows
  const qrocRowsBeforeFilter = rows.filter(r => r.sheet === 'qroc' || r.sheet === 'cas_qroc');
  const qrocRows = rows.filter(r => {
    if (r.sheet !== 'qroc' && r.sheet !== 'cas_qroc') return false;
    return !isEmptyRow(r.original);
  });
  const emptyQrocCount = qrocRowsBeforeFilter.length - qrocRows.length;
  
  console.log('');
  console.log('─'.repeat(80));
  console.log('4️⃣  EMPTY ROW FILTERING');
  console.log('─'.repeat(80));
  console.log(`[AI] 🔍 MCQ Filtering: ${mcqRows.length} non-empty rows kept, ${emptyMcqCount} empty rows removed (from ${mcqRowsBeforeFilter.length} total MCQ rows)`);
  console.log(`[AI] 🔍 QROC Filtering: ${qrocRows.length} non-empty rows kept, ${emptyQrocCount} empty rows removed (from ${qrocRowsBeforeFilter.length} total QROC rows)`);
  
  console.log('');
  console.log('─'.repeat(80));
  console.log('5️⃣  FINAL PROCESSING SUMMARY');
  console.log('─'.repeat(80));
  console.log(`[AI] 📈 Processing Summary: ${mcqRows.length} MCQ + ${qrocRows.length} QROC = ${mcqRows.length + qrocRows.length} total questions to process`);
  
  // Sample data check
  console.log('');
  console.log('─'.repeat(80));
  console.log('6️⃣  SAMPLE DATA CHECK (First 3 non-empty MCQ rows)');
  console.log('─'.repeat(80));
  
  for (let i = 0; i < Math.min(3, mcqRows.length); i++) {
    const r = mcqRows[i];
    const rec = r.original;
    console.log(`\n📝 Sample MCQ Row ${i + 1}:`);
    console.log(`   Sheet: ${r.sheet}`);
    console.log(`   Question: ${(rec['texte de la question'] || '').slice(0, 80)}${(rec['texte de la question'] || '').length > 80 ? '...' : ''}`);
    console.log(`   Option A: ${(rec['option a'] || '').slice(0, 60)}${(rec['option a'] || '').length > 60 ? '...' : ''}`);
    console.log(`   Option B: ${(rec['option b'] || '').slice(0, 60)}${(rec['option b'] || '').length > 60 ? '...' : ''}`);
    console.log(`   Answer: ${rec['reponse'] || '(empty)'}`);
    console.log(`   Matiere: ${rec['matiere'] || '(empty)'}`);
    console.log(`   Cours: ${rec['cours'] || '(empty)'}`);
  }
  
  if (qrocRows.length > 0) {
    console.log('');
    console.log('─'.repeat(80));
    console.log('7️⃣  SAMPLE DATA CHECK (First 3 non-empty QROC rows)');
    console.log('─'.repeat(80));
    
    for (let i = 0; i < Math.min(3, qrocRows.length); i++) {
      const r = qrocRows[i];
      const rec = r.original;
      console.log(`\n📝 Sample QROC Row ${i + 1}:`);
      console.log(`   Sheet: ${r.sheet}`);
      console.log(`   Question: ${(rec['texte de la question'] || '').slice(0, 80)}${(rec['texte de la question'] || '').length > 80 ? '...' : ''}`);
      console.log(`   Answer: ${(rec['reponse'] || '').slice(0, 60)}${(rec['reponse'] || '').length > 60 ? '...' : ''}`);
      console.log(`   Matiere: ${rec['matiere'] || '(empty)'}`);
      console.log(`   Cours: ${rec['cours'] || '(empty)'}`);
    }
  }
  
  // Summary table
  console.log('');
  console.log('');
  console.log('='.repeat(80));
  console.log('📊 SUMMARY TABLE');
  console.log('='.repeat(80));
  console.log('');
  console.log('Sheet Analysis:');
  console.log('┌─────────────────────────────────────┬──────────────────┬─────────┬──────────┐');
  console.log('│ Sheet Name                          │ Status           │ Rows    │ Type     │');
  console.log('├─────────────────────────────────────┼──────────────────┼─────────┼──────────┤');
  
  sheetStats.forEach(stat => {
    const name = stat.name.padEnd(35).slice(0, 35);
    const status = stat.status.padEnd(16).slice(0, 16);
    const rows = String(stat.rows).padStart(7);
    const type = (stat.type || 'N/A').padEnd(8).slice(0, 8);
    console.log(`│ ${name} │ ${status} │ ${rows} │ ${type} │`);
  });
  
  console.log('└─────────────────────────────────────┴──────────────────┴─────────┴──────────┘');
  console.log('');
  
  console.log('Question Counts:');
  console.log('┌──────────────────────────┬─────────────┬──────────────┬────────────┐');
  console.log('│ Type                     │ Before      │ Empty Rows   │ Final      │');
  console.log('├──────────────────────────┼─────────────┼──────────────┼────────────┤');
  console.log(`│ MCQ (QCM + CAS_QCM)      │ ${String(mcqRowsBeforeFilter.length).padStart(11)} │ ${String(emptyMcqCount).padStart(12)} │ ${String(mcqRows.length).padStart(10)} │`);
  console.log(`│ QROC (QROC + CAS_QROC)   │ ${String(qrocRowsBeforeFilter.length).padStart(11)} │ ${String(emptyQrocCount).padStart(12)} │ ${String(qrocRows.length).padStart(10)} │`);
  console.log('├──────────────────────────┼─────────────┼──────────────┼────────────┤');
  console.log(`│ TOTAL                    │ ${String(rows.length).padStart(11)} │ ${String(emptyMcqCount + emptyQrocCount).padStart(12)} │ ${String(mcqRows.length + qrocRows.length).padStart(10)} │`);
  console.log('└──────────────────────────┴─────────────┴──────────────┴────────────┘');
  console.log('');
  
  // Warnings and recommendations
  console.log('='.repeat(80));
  console.log('⚠️  WARNINGS & RECOMMENDATIONS');
  console.log('='.repeat(80));
  console.log('');
  
  const warnings = [];
  const recommendations = [];
  
  // Check for unrecognized sheets
  const unrecognizedSheets = sheetStats.filter(s => s.status === 'not-recognized');
  if (unrecognizedSheets.length > 0) {
    warnings.push(`${unrecognizedSheets.length} sheet(s) not recognized and will be skipped:`);
    unrecognizedSheets.forEach(s => {
      warnings.push(`   - "${s.name}"`);
    });
    recommendations.push('Rename sheets to include keywords: "qcm", "qroc", "cas qcm", or "cas qroc"');
  }
  
  // Check for many empty rows
  const emptyPercentage = ((emptyMcqCount + emptyQrocCount) / rows.length * 100).toFixed(1);
  if (emptyMcqCount + emptyQrocCount > rows.length * 0.3) {
    warnings.push(`High number of empty rows detected (${emptyPercentage}% of total rows)`);
    recommendations.push('Consider cleaning up Excel file by removing blank rows to improve processing speed');
  }
  
  // Check if no questions found
  if (mcqRows.length === 0 && qrocRows.length === 0) {
    warnings.push('No valid questions found after filtering!');
    recommendations.push('Check if your Excel columns are named correctly (texte de la question, option a-e, reponse, etc.)');
  }
  
  // Check if recognized sheets have no data
  const emptyRecognizedSheets = sheetStats.filter(s => s.status === 'recognized' && s.rows === 0);
  if (emptyRecognizedSheets.length > 0) {
    warnings.push(`${emptyRecognizedSheets.length} recognized sheet(s) are empty:`);
    emptyRecognizedSheets.forEach(s => {
      warnings.push(`   - "${s.name}" (type: ${s.type})`);
    });
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(w => console.log(`   ${w}`));
    console.log('');
  } else {
    console.log('✅ No warnings - file looks good!');
    console.log('');
  }
  
  if (recommendations.length > 0) {
    console.log('💡 Recommendations:');
    recommendations.forEach(r => console.log(`   ${r}`));
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('✅ TEST COMPLETE');
  console.log('='.repeat(80));
  console.log('');
  console.log('📌 NEXT STEPS:');
  console.log('   1. Review the summary table above');
  console.log('   2. Check that sheet names are recognized correctly');
  console.log('   3. Verify the final question counts match your expectations');
  console.log('   4. Review sample data to ensure parsing is correct');
  console.log('   5. If everything looks good, upload the file through the UI');
  console.log('');
  console.log('🔍 The actual AI processing will use these exact counts!');
  console.log('');
  
} catch (error) {
  console.error('');
  console.error('❌ ERROR OCCURRED:');
  console.error('─'.repeat(80));
  console.error(error.message);
  console.error('');
  console.error('Stack trace:');
  console.error(error.stack);
  process.exit(1);
}
