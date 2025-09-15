const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Robust CSV parser (handles quoted fields, commas inside quotes, Windows newlines)
function parseCSV(csvText) {
  const lines = csvText.replace(/\r/g, '').split('\n').filter(l => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const values = splitCsvLine(raw);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Double quote inside quoted field -> escape
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; continue; }
      inQuotes = !inQuotes; continue;
    }
    if (ch === ',' && !inQuotes) { out.push(current); current = ''; continue; }
    current += ch;
  }
  out.push(current);
  return out;
}

// Normalize header / key for flexible matching (lowercase, remove accents, spaces, underscores)
function normalizeKey(k) {
  return (k || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '');
}

function getValue(row, candidates) {
  const map = {};
  Object.keys(row).forEach(k => { map[normalizeKey(k)] = row[k]; });
  for (const c of candidates) {
    const v = map[normalizeKey(c)];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

async function importSpecialties(csvFile) {
  console.log('📊 Importing specialties from CSV...');
  
  const csvText = fs.readFileSync(csvFile, 'utf-8');
  const { headers, rows } = parseCSV(csvText);
  
  console.log('Headers found:', headers);
  console.log(`Rows to import: ${rows.length}`);
  
  // Get first niveau for default
  const defaultNiveau = await prisma.niveau.findFirst();
  
  let imported = 0;
  let errors = 0;
  
  for (const row of rows) {
    try {
      // Find niveau by name if provided
      let niveauId = defaultNiveau?.id;
      if (row.niveau) {
        const niveau = await prisma.niveau.findFirst({
          where: { name: { contains: row.niveau, mode: 'insensitive' } }
        });
        if (niveau) niveauId = niveau.id;
      }
      
      const specialty = await prisma.specialty.create({
        data: {
          name: row.name || row.Name,
          description: row.description || row.Description || '',
          niveauId: niveauId,
          isFree: (row.isFree || row.free || '').toLowerCase() === 'true'
        }
      });
      
      console.log(`✅ ${specialty.name}`);
      imported++;
    } catch (error) {
      console.log(`❌ Error with row:`, row, error.message);
      errors++;
    }
  }
  
  console.log(`\n🎉 Import complete: ${imported} imported, ${errors} errors`);
}

async function importLectures(csvFile) {
  console.log('📚 Importing lectures from CSV...');
  
  const csvText = fs.readFileSync(csvFile, 'utf-8');
  const { headers, rows } = parseCSV(csvText);
  
  console.log('Headers found:', headers);
  console.log(`Rows to import: ${rows.length}`);
  
  let imported = 0;
  let errors = 0;
  
  for (const row of rows) {
    try {
      // Find specialty by name
      let specialtyId = null;
      if (row.specialty || row.Specialty) {
        const specialty = await prisma.specialty.findFirst({
          where: { name: { contains: row.specialty || row.Specialty, mode: 'insensitive' } }
        });
        if (specialty) specialtyId = specialty.id;
      }
      
      if (!specialtyId) {
        console.log(`❌ Specialty not found for: ${row.specialty || row.Specialty}`);
        errors++;
        continue;
      }
      
      const lecture = await prisma.lecture.create({
        data: {
          title: row.title || row.Title,
          description: row.description || row.Description || '',
          specialtyId: specialtyId,
          isFree: (row.isFree || row.free || '').toLowerCase() === 'true'
        }
      });
      
      console.log(`✅ ${lecture.title}`);
      imported++;
    } catch (error) {
      console.log(`❌ Error with row:`, row, error.message);
      errors++;
    }
  }
  
  console.log(`\n🎉 Import complete: ${imported} imported, ${errors} errors`);
}

async function importSessions(csvFile) {
  console.log('🧪 Importing sessions from CSV...');
  const csvText = fs.readFileSync(csvFile, 'utf-8');
  const { headers, rows } = parseCSV(csvText);
  console.log('Headers found:', headers);
  console.log(`Rows to import: ${rows.length}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let createdSpecialties = 0;
  let createdSemesters = 0;

  const accentFold = (s) => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  for (const row of rows) {
    try {
      const name = getValue(row, ['name','nom','session','sessionname']);
      if (!name) { skipped++; continue; }

      const niveauName = getValue(row, ['niveau','level']);
      const semesterStr = getValue(row, ['semestre','semester','sem']);
      const specialtyName = getValue(row, [
        'matiere','matière','specialty','specialite','spécialité','discipline','subject'
      ]);
      const pdfUrl = getValue(row, ['urlexamen','url examen','url_examen','pdf','pdfexamen']);
      const correctionUrl = getValue(row, ['urlcorrection','url correction','url_correction','pdfcorrection','correction']);

      // Niveau
      let niveauId = null; let niveauObj = null;
      if (niveauName) {
        niveauObj = await prisma.niveau.findFirst({ where: { name: { equals: niveauName, mode: 'insensitive' } } });
        if (niveauObj) niveauId = niveauObj.id;
      }

      // Semester (create if needed)
      let semesterId = null;
      if (niveauId && semesterStr) {
        let order = parseInt(semesterStr,10);
        if (isNaN(order)) {
          const matchNum = /([0-9]+)/.exec(semesterStr);
            if (matchNum) order = parseInt(matchNum[1],10);
        }
        let semester = null;
        if (!isNaN(order)) {
          semester = await prisma.semester.findFirst({ where: { niveauId, order } });
          if (!semester) {
            semester = await prisma.semester.create({ data: { niveauId, order, name: `${niveauObj? niveauObj.name : 'Niveau'} - S${order}` } });
            createdSemesters++;
            console.log(`🆕 Created semester order ${order} for niveau ${niveauName}`);
          }
        } else {
          semester = await prisma.semester.findFirst({ where: { niveauId, name: { contains: semesterStr, mode: 'insensitive' } } });
          if (!semester) {
            semester = await prisma.semester.create({ data: { niveauId, order: 99, name: semesterStr } });
            createdSemesters++;
            console.log(`🆕 Created semester '${semesterStr}' for niveau ${niveauName}`);
          }
        }
        semesterId = semester.id;
      }

      // Specialty (create if missing)
      let specialtyId = null; let specialtyObj = null;
      if (specialtyName) {
        specialtyObj = await prisma.specialty.findFirst({
          where: { name: { equals: specialtyName, mode: 'insensitive' } }
        });
        if (!specialtyObj) {
          // try accent-fold contains match
          const allSpecs = await prisma.specialty.findMany({ select: { id:true,name:true } });
          const targetFold = accentFold(specialtyName);
          const found = allSpecs.find(s => accentFold(s.name) === targetFold);
          if (found) specialtyObj = found;
        }
        if (!specialtyObj) {
          specialtyObj = await prisma.specialty.create({
            data: { name: specialtyName, description: '', niveauId: niveauId || undefined, isFree: false }
          });
          createdSpecialties++;
          console.log(`🆕 Created specialty '${specialtyName}'`);
        }
        specialtyId = specialtyObj.id;
      }

      // Existing session check
      const existing = await prisma.session.findFirst({
        where: {
          name: { equals: name },
          ...(specialtyId ? { specialtyId } : {}),
          ...(niveauId ? { niveauId } : {})
        }
      });

      if (existing) {
        const needsUpdate = (
          (pdfUrl && pdfUrl !== existing.pdfUrl) ||
          (correctionUrl && correctionUrl !== existing.correctionUrl) ||
          (semesterId && semesterId !== existing.semesterId) ||
          (!existing.specialtyId && specialtyId) ||
          (!existing.niveauId && niveauId)
        );
        if (needsUpdate) {
          await prisma.session.update({
            where: { id: existing.id },
            data: {
              pdfUrl: pdfUrl || existing.pdfUrl,
              correctionUrl: correctionUrl || existing.correctionUrl,
              semesterId: semesterId || existing.semesterId,
              niveauId: existing.niveauId || niveauId,
              specialtyId: existing.specialtyId || specialtyId
            }
          });
          console.log(`♻️ Updated ${name}`);
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      const createdSession = await prisma.session.create({
        data: {
          name,
          niveauId: niveauId || undefined,
          semesterId: semesterId || undefined,
          specialtyId: specialtyId || undefined,
          pdfUrl: pdfUrl || undefined,
          correctionUrl: correctionUrl || undefined
        }
      });
      console.log(`✅ ${createdSession.name}`);
      created++;
    } catch (err) {
      console.log('❌ Error importing row', row, err.message);
      errors++;
    }
  }

  console.log(`\n🎯 Sessions import summary: created=${created}, updated=${updated}, skipped=${skipped}, errors=${errors}`);
  console.log(`🆕 Created specialties: ${createdSpecialties}, created semesters: ${createdSemesters}`);
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
📋 CSV Import Tool

Usage: node import-csv.js <type> <file.csv>

Types:
  specialties - Import specialties (columns: name, description, niveau, isFree)
  lectures    - Import lectures (columns: title, description, specialty, isFree)
  sessions    - Import sessions (columns: Niveau, Semestre, Matiere, Name, URL examen, URL correction)

Examples:
  node import-csv.js specialties data.csv
  node import-csv.js lectures courses.csv
  node import-csv.js sessions sessions.csv
    `);
    return;
  }
  
  const [type, csvFile] = args;
  
  if (!fs.existsSync(csvFile)) {
    console.log(`❌ File not found: ${csvFile}`);
    return;
  }
  
  try {
    switch (type) {
      case 'specialties':
        await importSpecialties(csvFile);
        break;
      case 'lectures':
        await importLectures(csvFile);
        break;
      case 'sessions':
        await importSessions(csvFile);
        break;
      default:
        console.log(`❌ Unknown type: ${type}`);
    }
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
