import { NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function postHandler(request: AuthenticatedRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const lectureId = formData.get('lectureId') as string;

    if (!file || !lectureId) {
      return NextResponse.json(
        { error: 'File and lectureId are required' },
        { status: 400 }
      );
    }

    // Verify lecture exists
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId }
    });

    if (!lecture) {
      return NextResponse.json(
        { error: 'Lecture not found' },
        { status: 404 }
      );
    }

    // Read and parse CSV file
    const csvText = await file.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    console.log(`CSV Import: File contains ${lines.length} lines (including header)`);
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must have at least a header and one data row' },
        { status: 400 }
      );
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const expectedHeaders = ['matiere', 'cours', 'question n', 'source', 'texte de la question', 'reponse'];
    
    console.log('CSV Import: Parsed headers:', header);
    console.log('CSV Import: Expected headers:', expectedHeaders);
    
    // Check if all required headers are present
    const missingHeaders = expectedHeaders.filter(h => !header.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Missing required headers: ${missingHeaders.join(', ')}` },
        { status: 400 }
      );
    }

    const questions = [] as Array<{
      lectureId: string;
      type: 'qroc';
      text: string;
      correctAnswers: string[];
      courseReminder: null;
      number: number | null;
      session: string | null;
    }>;
    const errors = [];
    const totalRows = lines.length - 1; // Exclude header

    // Strict duplicate detection within the uploaded file: mark as duplicate only if the FULL row is identical
    const strictRowKey = (vals: string[]) => vals.map(v => String(v ?? '').trim()).join('||');
    const seenInFile = new Map<string, number>(); // key -> first row index (1-based data row)

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Parse CSV line (handle commas within quotes)
        const values = parseCSVLine(line);
        
        console.log(`Row ${i + 1}: Parsed ${values.length} columns:`, values);
        
        if (values.length < expectedHeaders.length) {
          const errorMsg = `Row ${i + 1}: Insufficient data (expected ${expectedHeaders.length} columns, got ${values.length})`;
          console.error(errorMsg, { values, expectedHeaders, originalLine: line });
          errors.push(errorMsg);
          continue;
        }

        const rowData: Record<string, string> = {};
        header.forEach((h, index) => {
          rowData[h] = values[index]?.trim() || '';
        });

        // File-level duplicate check (full-row identity using canonical header order)
        const ordered = expectedHeaders.map(h => rowData[h] || '');
        const fileKey = strictRowKey(ordered);
        const firstIdx = seenInFile.get(fileKey);
        if (typeof firstIdx === 'number') {
          const errorMsg = `Row ${i + 1}: Duplicate in file — identical to row ${firstIdx + 1}`;
          console.warn(errorMsg);
          errors.push(errorMsg);
          continue;
        }
        seenInFile.set(fileKey, i);

        // Validate required fields with detailed error messages
        if (!rowData['texte de la question']) {
          const errorMsg = `Row ${i + 1}: Missing question text`;
          console.error(errorMsg, { rowData });
          errors.push(errorMsg);
          continue;
        }

        if (!rowData['reponse']) {
          const errorMsg = `Row ${i + 1}: Missing answer`;
          console.error(errorMsg, { rowData });
          errors.push(errorMsg);
          continue;
        }

        // Validate question text length
        if (rowData['texte de la question'].length > 1000) {
          const errorMsg = `Row ${i + 1}: Question text too long (${rowData['texte de la question'].length} characters, max 1000)`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        // Validate answer length
        if (rowData['reponse'].length > 500) {
          const errorMsg = `Row ${i + 1}: Answer too long (${rowData['reponse'].length} characters, max 500)`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        // Create question data
        const questionData: {
          lectureId: string;
          type: 'qroc';
          text: string;
          correctAnswers: string[];
          courseReminder: null;
          number: number | null;
          session: string | null;
        } = {
          lectureId,
          type: 'qroc',
          text: rowData['texte de la question'],
          correctAnswers: [rowData['reponse']],
          courseReminder: null, // Don't use cours for courseReminder
          number: parseInt(rowData['question n']) || null,
          session: rowData['source'] || null // source maps to session
        };

        questions.push(questionData);
      } catch (error) {
        const errorMsg = `Row ${i + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`;
        console.error(errorMsg, { line, error });
        errors.push(errorMsg);
      }
    }

    // Insert questions into database with progress tracking
    const createdQuestions = [] as any[];
    const importErrors = [];
    
    console.log(`Starting database insertion for ${questions.length} questions...`);
    
    for (let i = 0; i < questions.length; i++) {
      const questionData = questions[i];
      try {
        // DB-level duplicate check: consider duplicate ONLY if all relevant fields are identical
        const candidates = await prisma.question.findMany({
          where: {
            lectureId: questionData.lectureId,
            type: questionData.type,
            text: questionData.text
          },
          select: {
            id: true,
            lectureId: true,
            type: true,
            text: true,
            correctAnswers: true,
            courseReminder: true,
            number: true,
            session: true
          }
        });

        const identical = candidates.find(q => {
          const arrEq = (a?: any[] | null, b?: any[] | null) => {
            const aa = Array.isArray(a) ? a.map(x => String(x)) : [];
            const bb = Array.isArray(b) ? b.map(x => String(x)) : [];
            if (aa.length !== bb.length) return false;
            for (let k = 0; k < aa.length; k++) if (aa[k] !== bb[k]) return false;
            return true;
          };
          const s = (x?: string | null) => String(x ?? '').trim();
          return (
            q.lectureId === questionData.lectureId &&
            q.type === questionData.type &&
            s(q.text) === s(questionData.text) &&
            arrEq(q.correctAnswers as any, questionData.correctAnswers) &&
            ((q.number ?? null) === (questionData.number ?? null)) &&
            s(q.session) === s(questionData.session) &&
            s(q.courseReminder) === s(questionData.courseReminder)
          );
        });

        if (identical) {
          importErrors.push(`Row ${i + 1}: Duplicate in database — identical question already exists`);
          continue;
        }

        const question = await prisma.question.create({
          data: questionData,
          include: {
            lecture: {
              select: {
                id: true,
                title: true,
                specialty: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        });
        createdQuestions.push(question);
        console.log(`✓ Question ${i + 1}/${questions.length} created successfully`);
      } catch (error) {
        console.error(`✗ Error creating question ${i + 1}/${questions.length}:`, {
          error: error instanceof Error ? error.message : error,
          questionData: {
            text: questionData.text.substring(0, 100) + '...',
            type: questionData.type,
            lectureId: questionData.lectureId,
            number: questionData.number
          }
        });
        
        let errorMessage = `Row ${i + 1}: Database error`;
        if (error instanceof Error) {
          if (error.message.includes('Unique constraint')) {
            errorMessage = `Row ${i + 1}: Question number ${questionData.number} already exists`;
          } else if (error.message.includes('Foreign key constraint')) {
            errorMessage = `Row ${i + 1}: Invalid lecture ID`;
          } else if (error.message.includes('Check constraint')) {
            errorMessage = `Row ${i + 1}: Invalid question type`;
          } else {
            errorMessage = `Row ${i + 1}: ${error.message}`;
          }
        }
        importErrors.push(errorMessage);
      }
    }

    // Combine validation errors and import errors
    const allErrors = [...errors, ...importErrors];

    return NextResponse.json({
      success: true,
      total: totalRows,
      imported: createdQuestions.length,
      failed: allErrors.length,
      errors: allErrors.length > 0 ? allErrors : undefined
    });

  } catch (error) {
    console.error('Error importing questions:', error);
    return NextResponse.json(
      { error: 'Failed to import questions' },
      { status: 500 }
    );
  }
}

// Helper function to parse CSV line with proper quote handling
function parseCSVLine(line: string): string[] {
  // Check if the entire line is wrapped in quotes
  if (line.startsWith('"') && line.endsWith('"')) {
    // Remove the outer quotes and parse normally
    line = line.slice(1, -1);
  }
  
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values.map(v => v.replace(/^"|"$/g, '')); // Remove surrounding quotes
}

export const POST = requireAdmin(postHandler); 