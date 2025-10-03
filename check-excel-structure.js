#!/usr/bin/env node
/**
 * Check Excel file structure
 */

const XLSX = require('xlsx');

console.log('\n📖 Analyzing: Copy of DCEM 2.xlsx\n');

const workbook = XLSX.readFile('Copy of DCEM 2.xlsx');

console.log(`📋 Sheets found: ${workbook.SheetNames.join(', ')}\n`);

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`\n📄 Sheet: "${sheetName}"`);
  console.log(`   Rows: ${rows.length}`);
  
  if (rows.length > 0) {
    console.log(`   Columns:`, Object.keys(rows[0]));
    console.log(`\n   Sample row:`);
    console.log(JSON.stringify(rows[0], null, 2));
  }
}
