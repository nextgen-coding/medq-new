import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { read, utils, write } from 'xlsx';
import { storeValidationFiles } from '@/lib/validation-file-store';

export async function POST(request: NextRequest) {
  try {
    const authReq = await authenticateRequest(request);
    if (!authReq?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permission
    if (authReq.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type) && 
        !file.name.toLowerCase().endsWith('.xlsx') && 
        !file.name.toLowerCase().endsWith('.xls') && 
        !file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.' 
      }, { status: 400 });
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 50MB.' 
      }, { status: 400 });
    }

    // Process the file for classic validation
    const fileBuffer = await file.arrayBuffer();
  const validationResult = await processClassicValidation(Buffer.from(fileBuffer), file.name);

    // Return JSON with file analysis and download info
    return NextResponse.json({
      message: 'Validation completed successfully',
      results: {
        goodRecords: validationResult.goodCount,
        errorRecords: validationResult.errorCount,
        totalRecords: validationResult.totalCount,
        sessionId: validationResult.sessionId
      },
      files: {
        original: file.name,
        goodFile: `good_records_${file.name}`,
        errorFile: `error_records_${file.name}`,
        reportFile: `validation_report_${file.name.replace(/\.[^/.]+$/, '')}.txt`
      }
    });

  } catch (error) {
    console.error('Classic validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error during validation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authReq = await authenticateRequest(request);
    if (!authReq?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permission
    if (authReq.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    return NextResponse.json({
      message: 'Classic validation endpoint',
      supportedFormats: ['xlsx', 'xls', 'csv'],
      maxFileSize: '50MB',
      features: [
        'Data validation',
        'Format correction',
        'Duplicate detection',
        'Structure validation'
      ]
    });

  } catch (error) {
    console.error('Error in validation info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processClassicValidation(fileBuffer: Buffer, fileName: string): Promise<{ 
  goodCount: number; 
  errorCount: number; 
  totalCount: number; 
  sessionId: string;
  goodFileBuffer: Buffer;
  errorFileBuffer: Buffer;
  reportBuffer: Buffer;
}> {
  // Parse the incoming file (supports xlsx/xls/csv)
  const workbook = read(fileBuffer, { type: 'buffer' });

  // Merge all sheets rows into a single array of objects for validation
  const allRows: Array<Record<string, any>> = [];
  const sheetSummaries: Array<{ sheet: string; total: number; good: number; error: number }> = [];

  const requiredColumns = ['matiere', 'cours', 'texte de la question'];
  const seenKeysPerSheet = new Map<string, Map<string, number>>(); // for duplicate detection within same sheet

  let goodRows: Array<Record<string, any>> = [];
  let errorRows: Array<Record<string, any>> = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    // Extract JSON with header mapping via xlsx utils
    const rows = utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
    if (rows.length === 0) continue;

    // Canonicalize headers similar to import logic
    const canonicalize = (h: string) =>
      String(h || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const headerMap = new Map<string, string>();
    Object.keys(rows[0] || {}).forEach((h) => headerMap.set(h, canonicalize(h)));

    // Per-sheet duplicate tracker
    const firstSeen = new Map<string, number>();
    seenKeysPerSheet.set(sheetName, firstSeen);

    let sheetGood = 0;
    let sheetErr = 0;

    rows.forEach((rawRow, idx) => {
      // Remap keys to canonical headers
      const row: Record<string, any> = {};
      for (const [original, canon] of headerMap.entries()) {
        row[canon] = rawRow[original];
      }

      // Basic required fields validation
      const missing = requiredColumns.filter((c) => !String(row[c] || '').trim());

      // Generate duplicate key across all present columns for this sheet
      const keys = Object.keys(row).sort();
      const key = keys.map((k) => `${k}=${String(row[k] ?? '').trim()}`).join('|');
      const prev = firstSeen.get(key);

      if (missing.length > 0) {
        errorRows.push({ ...row, __error__: `Missing required: ${missing.join(', ')}`, __sheet__: sheetName, __row__: idx + 2 });
        sheetErr++;
      } else if (prev !== undefined) {
        errorRows.push({ ...row, __error__: `Duplicate in file: matches row ${prev}`, __sheet__: sheetName, __row__: idx + 2 });
        sheetErr++;
      } else {
        firstSeen.set(key, idx + 2);
        goodRows.push({ ...row, __sheet__: sheetName, __row__: idx + 2 });
        sheetGood++;
      }
    });

    sheetSummaries.push({ sheet: sheetName, total: rows.length, good: sheetGood, error: sheetErr });
    allRows.push(...rows);
  }

  const totalCount = goodRows.length + errorRows.length;
  const goodCount = goodRows.length;
  const errorCount = errorRows.length;

  // Build workbooks for good and error rows
  const buildSheetFromRows = (rows: Array<Record<string, any>>) => {
    if (rows.length === 0) return utils.aoa_to_sheet([['No rows']]);
    // Restore headers from union of keys except internal markers
    const headersSet = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => { if (!k.startsWith('__')) headersSet.add(k); }));
    const headers = Array.from(headersSet);
    const aoa = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
    return utils.aoa_to_sheet(aoa);
  };

  const goodWb = utils.book_new();
  utils.book_append_sheet(goodWb, buildSheetFromRows(goodRows), 'good');
  const errorWb = utils.book_new();
  utils.book_append_sheet(errorWb, buildSheetFromRows(errorRows), 'errors');

  const goodFileBuffer = Buffer.from(write(goodWb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
  const errorFileBuffer = Buffer.from(write(errorWb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);

  // Build textual validation report
  const reportLines: string[] = [];
  reportLines.push(`Classic Validation Report for ${fileName}`);
  reportLines.push('========================================');
  reportLines.push('');
  reportLines.push(`Total records processed: ${totalCount}`);
  reportLines.push(`Valid records: ${goodCount}`);
  reportLines.push(`Invalid records: ${errorCount}`);
  reportLines.push('');
  if (sheetSummaries.length > 0) {
    reportLines.push('Per-sheet summary:');
    sheetSummaries.forEach((s) => reportLines.push(`- ${s.sheet}: total=${s.total}, good=${s.good}, error=${s.error}`));
    reportLines.push('');
  }
  reportLines.push('Notes:');
  reportLines.push('- Required columns: matiere, cours, texte de la question');
  reportLines.push('- Duplicate detection: identical rows within the same sheet are flagged');

  const reportBuffer = Buffer.from(reportLines.join('\n'));

  // Allocate a session and store files in shared store for later download
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  storeValidationFiles(sessionId, {
    goodFileBuffer,
    errorFileBuffer,
    reportBuffer,
    fileName,
  });

  return { 
    goodCount, 
    errorCount, 
    totalCount, 
    sessionId,
    goodFileBuffer,
    errorFileBuffer,
    reportBuffer,
  };
}