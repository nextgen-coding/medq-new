import { NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import type { Specialty, Lecture } from '@prisma/client';
import * as XLSX from 'xlsx';

async function postHandler(request: AuthenticatedRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' }, { status: 400 });
    }

    // Read and parse XLSX file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return NextResponse.json({ error: 'Excel file must have at least a header and one data row' }, { status: 400 });
    }

    // Parse header (first row)
    const headerRow = jsonData[0] as string[];
    const header = headerRow.map(h => h?.toString().trim().toLowerCase() || '');
    const expectedHeaders = ['matiere', 'cours', 'question n', 'source', 'texte de la question', 'reponse'];
    
    const missingHeaders = expectedHeaders.filter(h => !header.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json({ error: `Missing required headers: ${missingHeaders.join(', ')}` }, { status: 400 });
    }

    // Fetch all lectures and specialties for matching
    const [lectures, specialties] = await Promise.all([
      prisma.lecture.findMany({ include: { specialty: true } }),
      prisma.specialty.findMany()
    ]);

    const questions = [];
    const errors = [];
    const totalRows = jsonData.length - 1;
    const importStats = {
      total: totalRows,
      imported: 0,
      failed: 0,
      matchedLectures: 0,
      unmatchedLectures: 0,
      createdSpecialties: 0,
      createdLectures: 0
    };

    // Track what we've already created during this import session
  // Track created entities using Prisma model types to ensure parity with schema (includes semesterId)
  const createdSpecialties = new Map<string, Specialty>(); // specialty name -> specialty object
  const createdLectures = new Map<string, Lecture>(); // "specialtyName:lectureTitle" -> lecture object

    // Process each data row
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length === 0) continue;

      try {
        const values = row.map(cell => cell?.toString().trim() || '');
        if (values.length < expectedHeaders.length) {
          const errorMsg = `Row ${i + 1}: Insufficient data (expected ${expectedHeaders.length} columns, got ${values.length})`;
          console.error(errorMsg);
          errors.push(errorMsg);
          importStats.failed++;
          continue;
        }

        const rowData: Record<string, string> = {};
        header.forEach((h, index) => {
          rowData[h] = values[index] || '';
        });

        // Validate required fields
        if (!rowData['matiere'] || !rowData['cours'] || !rowData['texte de la question'] || !rowData['reponse']) {
          const errorMsg = `Row ${i + 1}: Missing required fields (matiere, cours, texte de la question, or reponse)`;
          console.error(errorMsg);
          errors.push(errorMsg);
          importStats.failed++;
          continue;
        }

        // Find or create matching lecture
        let matchedLecture = findMatchingLecture(
          rowData['matiere'], // matiere = specialty name
          rowData['cours'],   // cours = lecture title
          lectures, 
          specialties
        );

        if (!matchedLecture) {
          // Check if we've already created this specialty/lecture combination in this session
          const specialtyName = rowData['matiere'];
          const lectureTitle = rowData['cours'];
          const lectureKey = `${specialtyName}:${lectureTitle}`;
          
          // Check if we've already created this lecture in this session
          if (createdLectures.has(lectureKey)) {
            matchedLecture = createdLectures.get(lectureKey);
            console.log(`Row ${i + 1}: Using previously created lecture "${lectureTitle}" for specialty "${specialtyName}"`);
            importStats.matchedLectures++;
            continue;
          }

          // Try to create the specialty and lecture
          try {
            console.log(`Row ${i + 1}: Creating specialty "${specialtyName}" and lecture "${lectureTitle}"`);
            
            // Create specialty if it doesn't exist
            let specialty = specialties.find(s => 
              s.name.toLowerCase().includes(specialtyName.toLowerCase()) ||
              specialtyName.toLowerCase().includes(s.name.toLowerCase())
            );

            // Check if we've already created this specialty in this session
            if (!specialty && createdSpecialties.has(specialtyName)) {
              specialty = createdSpecialties.get(specialtyName);
              console.log(`Row ${i + 1}: Using previously created specialty "${specialtyName}"`);
            }

            if (!specialty) {
              specialty = await prisma.specialty.create({
                data: {
                  name: specialtyName,
                  description: `Specialty created during import: ${specialtyName}`
                }
              });
              console.log(`✓ Created specialty: ${specialty.name} (ID: ${specialty.id})`);
              specialties.push(specialty as never); // Add to local cache
              createdSpecialties.set(specialtyName, specialty as Specialty); // Track created specialty
              importStats.createdSpecialties++;
            }

            // Create lecture if it doesn't exist
            matchedLecture = await prisma.lecture.create({
              data: {
                title: lectureTitle,
                specialtyId: specialty.id
              }
            });
            console.log(`✓ Created lecture: ${(matchedLecture as { title: string; id: string }).title} (ID: ${(matchedLecture as { title: string; id: string }).id})`);
            lectures.push(matchedLecture as never); // Add to local cache
            createdLectures.set(lectureKey, matchedLecture as Lecture); // Track created lecture
            
            importStats.matchedLectures++;
            importStats.createdLectures++;
            
          } catch (error) {
            const errorMsg = `Row ${i + 1}: Failed to create specialty/lecture for "${specialtyName}" - "${lectureTitle}": ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            importStats.failed++;
            importStats.unmatchedLectures++;
            continue;
          }
        }

        const questionData = {
          lectureId: (matchedLecture as { id: string }).id,
          type: 'qroc',
          text: rowData['texte de la question'],
          correctAnswers: [rowData['reponse']],
          courseReminder: null, // Don't use cours for courseReminder
          number: parseInt(rowData['question n']) || null,
          session: rowData['source'] // source maps to session
        };
        questions.push(questionData);
        importStats.matchedLectures++;
        
      } catch (error) {
        const errorMsg = `Row ${i + 1}: Error processing row: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        importStats.failed++;
      }
    }

    // Insert questions in batches
    const importErrors = [];
    const batchSize = 50;
    
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      
      try {
        await prisma.question.createMany({
          data: batch,
          skipDuplicates: true
        });
        importStats.imported += batch.length;
        console.log(`✓ Imported batch ${Math.floor(i / batchSize) + 1}: ${batch.length} questions`);
      } catch (error) {
        console.error(`Error importing batch ${Math.floor(i / batchSize) + 1}:`, error);
        importErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        importStats.failed += batch.length;
      }
    }

    const allErrors = [...errors, ...importErrors];
    return NextResponse.json({ success: true, ...importStats, errors: allErrors.length > 0 ? allErrors : undefined });
  } catch (error) {
    console.error('Error in bulk import:', error);
    return NextResponse.json({ 
      error: 'Failed to process import', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

function findMatchingLecture(matiere: string, cours: string, lectures: unknown[], specialties: unknown[]): unknown {
  // First, find the specialty
  const specialty = specialties.find(s => 
    (s as { name: string }).name.toLowerCase().includes(matiere.toLowerCase()) ||
    matiere.toLowerCase().includes((s as { name: string }).name.toLowerCase())
  ) as { id: string; name: string } | undefined;

  if (!specialty) {
    return null;
  }

  // Then find the lecture within that specialty
  return lectures.find(l => 
    (l as { specialtyId: string }).specialtyId === specialty.id && 
    ((l as { title: string }).title.toLowerCase().includes(cours.toLowerCase()) ||
     cours.toLowerCase().includes((l as { title: string }).title.toLowerCase()))
  );
}

export const POST = requireAdmin(postHandler); 