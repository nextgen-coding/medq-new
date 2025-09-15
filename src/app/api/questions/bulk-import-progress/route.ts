import { NextResponse } from 'next/server';
import { read, utils } from 'xlsx';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import type { Prisma } from '@prisma/client';
import { rehostImageIfConfigured } from '@/lib/services/media';

// Store active imports with their progress
type ImportStats = {
  total: number;
  imported: number;
  failed: number;
  createdSpecialties: number;
  createdLectures: number;
  questionsWithImages: number;
  createdCases: number;
  errors?: string[];
};

type Phase = 'validating' | 'importing' | 'complete';

type ImportSession = {
  progress: number;
  phase: Phase;
  message: string;
  logs: string[];
  stats?: ImportStats;
  lastUpdated: number;
  createdAt: number;
  cancelled?: boolean;
};

const activeImports = new Map<string, ImportSession>();

// Periodic cleanup (keep sessions for 30 minutes after completion)
const SESSION_TTL_MS = 30 * 60 * 1000;
const CLEAN_INTERVAL_MS = 5 * 60 * 1000;
if (!(global as any).__bulkImportCleanerStarted) {
  (global as any).__bulkImportCleanerStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, sess] of activeImports.entries()) {
      const isComplete = sess.phase === 'complete' || sess.cancelled;
      if (isComplete && now - sess.lastUpdated > SESSION_TTL_MS) {
        activeImports.delete(id);
      }
    }
  }, CLEAN_INTERVAL_MS).unref?.();
}

// --- Header normalization helpers ---
const normalizeHeader = (h: string): string =>
  String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^\w\s]/g, ' ') // punctuation to spaces
    .replace(/\s+/g, ' ') // collapse
    .trim();

const headerAliases: Record<string, string> = {
  // canonical keys
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
  // optional columns
  'explication': 'explication',
  'explication de la reponse': 'explication',
  'explication de la réponse': 'explication',
  'explication reponse': 'explication',
  'explanation': 'explication',
  'correction': 'explication',
  // per-option explanations (map directly, we'll inspect later)
  'explication a': 'explication a',
  'explication b': 'explication b',
  'explication c': 'explication c',
  'explication d': 'explication d',
  'explication e': 'explication e',
  // sometimes with option letter capitalized
  'explication A': 'explication a',
  'explication B': 'explication b',
  'explication C': 'explication c',
  'explication D': 'explication d',
  'explication E': 'explication e',
  'niveau': 'niveau',
  'level': 'niveau',
  'semestre': 'semestre',
  'semester': 'semestre',
  // course reminder (rappel) columns
  'rappel': 'rappel',
  'rappel du cours': 'rappel',
  'rappel cours': 'rappel',
  'course reminder': 'rappel',
  'rappel_cours': 'rappel',
  // explicit media/image columns
  'image': 'image',
  'image url': 'image',
  'image_url': 'image',
  'media': 'image',
  'media url': 'image',
  'media_url': 'image',
  'illustration': 'image',
  'illustration url': 'image'
};

const canonicalizeHeader = (h: string): string => {
  const n = normalizeHeader(h);
  return headerAliases[n] ?? n;
};

// Function to extract image URLs from text and clean the text
function extractImageUrlAndCleanText(text: string): { cleanedText: string; mediaUrl: string | null; mediaType: string | null } {
  // Regular expression to match URLs and allow trailing punctuation/paren
  const imageUrlRegex = /(https?:\/\/[^\s)]+?\.(?:jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico))(?:[)\s.,;:!?]|$)/i;
  
  let cleanedText = text;
  let mediaUrl: string | null = null;
  let mediaType: string | null = null;
  const match = text.match(imageUrlRegex);
  if (match) {
    mediaUrl = match[1];
    cleanedText = text.replace(match[0], ' ').trim();
    
    // Determine media type based on file extension
    const extension = mediaUrl.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        mediaType = 'image/jpeg';
        break;
      case 'png':
        mediaType = 'image/png';
        break;
      case 'gif':
        mediaType = 'image/gif';
        break;
      case 'webp':
        mediaType = 'image/webp';
        break;
      case 'svg':
        mediaType = 'image/svg+xml';
        break;
      case 'bmp':
        mediaType = 'image/bmp';
        break;
      case 'tiff':
        mediaType = 'image/tiff';
        break;
      case 'ico':
        mediaType = 'image/x-icon';
        break;
      default:
        mediaType = 'image';
    }
  }
  
  return { cleanedText, mediaUrl, mediaType };
}

// Function to parse MCQ options from canonicalized Excel row
function parseMCQOptions(rowData: Record<string, unknown>): { options: string[], correctAnswers: string[] } {
  const options: string[] = [];
  const correctAnswers: string[] = [];
  
  // Check for options a through e (canonical lower-case)
  for (let i = 0; i < 5; i++) {
    const optionKey = `option ${String.fromCharCode(97 + i)}`; // a, b, c, d, e
    const optionValue = rowData[optionKey];
    if (optionValue && typeof optionValue === 'string' && optionValue.trim()) {
      options.push(optionValue.trim());
    } else if (optionValue && typeof optionValue !== 'string') {
      // Convert non-string values to string
      const stringValue = String(optionValue).trim();
      if (stringValue) {
        options.push(stringValue);
      }
    }
  }
  
  // Parse correct answer (e.g., "A, C, E" or "A" or "A,C,E")
  if (rowData['reponse']) {
    const answerStr = String(rowData['reponse']).toUpperCase();
    const answers = answerStr.split(/[;,\s]+/).filter((a: string) => a.trim());
    
    answers.forEach((answer: string) => {
      const index = answer.charCodeAt(0) - 65; // Convert A=0, B=1, etc.
      if (index >= 0 && index < options.length) {
        correctAnswers.push(index.toString());
      }
    });
  }
  
  return { options, correctAnswers };
}

// Build combined explanation merging global and per-option explanation columns
function buildCombinedExplanation(rowData: Record<string, string>): string | undefined {
  const base = rowData['explication'] ? String(rowData['explication']).trim() : '';
  const perOption: string[] = [];
  const letters = ['a','b','c','d','e'];
  letters.forEach((l, idx) => {
    const key = `explication ${l}`; // already canonicalised
    const val = rowData[key];
    if (val) {
      const clean = String(val).trim();
      if (clean) perOption.push(`(${l.toUpperCase()}) ${clean}`);
    }
  });
  if (!base && perOption.length === 0) return undefined;
  if (perOption.length === 0) return base || undefined;
  let combined = base ? base + '\n\n' : '';
  combined += 'Explications:\n' + perOption.join('\n');
  return combined;
}

// Function to update progress for an import session
function updateProgress(importId: string, progress: number, message: string, log?: string, phase?: Phase) {
  const current = activeImports.get(importId);
  if (!current) return; // session might have been cleaned/cancelled
  activeImports.set(importId, {
    ...current,
    progress,
    message,
    phase: phase ?? current.phase,
    logs: log ? [...current.logs, log] : current.logs,
    lastUpdated: Date.now()
  });
}

async function processFile(file: File, importId: string) {
  try {
  updateProgress(importId, 5, 'Reading Excel file...', undefined, 'validating');
    
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer);
    
    const importStats = {
      total: 0,
      imported: 0,
      failed: 0,
      createdSpecialties: 0,
      createdLectures: 0,
      questionsWithImages: 0,
      createdCases: 0,
      errors: [] as string[]
    };

    const createdSpecialties = new Map<string, any>();
    const createdLectures = new Map<string, any>();
    const createdCases = new Map<string, any>(); // Track cases by lectureId + caseNumber

    // Preload and cache niveaux and semesters
    const niveauxCache = new Map<string, { id: string; name: string }>();
    const semestersCache = new Map<string, { id: string; name: string; order: number; niveauId: string }>();
    const allNiveaux = await prisma.niveau.findMany();
    for (const n of allNiveaux) {
      niveauxCache.set(n.name.toLowerCase(), { id: n.id, name: n.name });
      niveauxCache.set(n.name.replace(/\s+/g, '').toLowerCase(), { id: n.id, name: n.name });
    }
    const allSemesters = await prisma.semester.findMany();
    for (const s of allSemesters) {
      const keyByName = `${s.niveauId}:${s.name.toLowerCase()}`;
      const keyByOrder = `${s.niveauId}:order:${s.order}`;
      semestersCache.set(keyByName, { id: s.id, name: s.name, order: s.order, niveauId: s.niveauId });
      semestersCache.set(keyByOrder, { id: s.id, name: s.name, order: s.order, niveauId: s.niveauId });
    }

    const normalizeNiveauName = (raw?: string | null) => {
      if (!raw) return '';
      const s = String(raw).trim();
      if (!s) return '';
      const compact = s.replace(/\s+/g, '').toUpperCase();
      const m = compact.match(/^(PCEM|DCEM)(\d)$/i);
      if (m) return `${m[1].toUpperCase()}${m[2]}`;
      return s.toUpperCase();
    };

    const parseSemesterOrder = (raw?: string | null): number | null => {
      if (!raw) return null;
      const s = String(raw).toUpperCase();
      if (/(^|\W)S?1(\W|$)/.test(s)) return 1;
      if (/(^|\W)S?2(\W|$)/.test(s)) return 2;
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    };

    // Process each sheet
    const sheets = ['qcm', 'qroc', 'cas_qcm', 'cas_qroc'] as const;

    // Build a map of canonical sheet names to actual sheet names present in the workbook,
    // accepting common variants like hyphens, spaces, or clinic phrasing
    const normalizeSheet = (name: string) =>
      String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const sheetAliases: Record<(typeof sheets)[number], string[]> = {
      qcm: ['qcm', 'questions qcm'],
      qroc: ['qroc', 'croq', 'questions qroc', 'questions croq'],
      cas_qcm: ['cas qcm', 'cas-qcm', 'cas_qcm', 'cas clinique qcm', 'cas clinic qcm'],
      cas_qroc: ['cas qroc', 'cas-qroc', 'cas_qroc', 'cas clinique qroc', 'cas clinic qroc', 'cas croq', 'cas clinic croq']
    };

    const presentMap = new Map<string, string>(); // normalized -> actual
    for (const actual of Object.keys(workbook.Sheets)) {
      presentMap.set(normalizeSheet(actual), actual);
    }

    const canonicalToActual = new Map<string, string>();
    for (const key of sheets) {
      const variants = sheetAliases[key];
      for (const v of variants) {
        const norm = normalizeSheet(v);
        const actual = presentMap.get(norm);
        if (actual) {
          canonicalToActual.set(key, actual);
          break;
        }
      }
    }
    
    for (const sheetName of sheets) {
      const session = activeImports.get(importId);
      if (!session || session.cancelled) break; // cancellation check
      const actualName = canonicalToActual.get(sheetName);
      if (!actualName || !workbook.Sheets[actualName]) {
        updateProgress(importId, 10, `Sheet '${sheetName}' not found, skipping...`);
        continue;
      }

      updateProgress(importId, 15, `Processing sheet: ${sheetName}...`, undefined, 'importing');
      
  const sheet = workbook.Sheets[actualName];
  const jsonData = utils.sheet_to_json(sheet, { header: 1 });
      
      if (jsonData.length < 2) {
        updateProgress(importId, 20, `Sheet '${sheetName}' is empty, skipping...`);
        continue;
      }

  // Canonicalize headers
  const rawHeader = (jsonData[0] as string[]).map(h => String(h ?? ''));
  const header = rawHeader.map(canonicalizeHeader);

  // Skip header row
  const dataRows = jsonData.slice(1);
      importStats.total += dataRows.length;

  updateProgress(importId, 25, `Found ${dataRows.length} rows in ${sheetName}...`);

      // Process each row
      for (let i = 0; i < dataRows.length; i++) {
        const sessionLoop = activeImports.get(importId);
        if (!sessionLoop || sessionLoop.cancelled) break; // cancellation check
        const row = dataRows[i];
  const progress = 25 + (i / dataRows.length) * 60;
        updateProgress(importId, progress, `Processing row ${i + 1} in ${sheetName}...`);

        try {
          // Build rowData with canonical headers
          const rowData: Record<string, string> = {};
          header.forEach((h, idx) => {
            rowData[h] = String((row as unknown[])[idx] ?? '').trim();
          });

          // Build basic fields
          const specialtyName = rowData['matiere'];
          const lectureTitle = rowData['cours'];

          // Determine question text and extract image URL
          // Note: headers are canonicalized, and 'texte de question' maps to 'texte de la question'
          const questionText = rowData['texte de la question'] || '';
          const { cleanedText, mediaUrl, mediaType } = extractImageUrlAndCleanText(questionText);

          if (!specialtyName || !lectureTitle) {
            throw new Error('Missing specialty or lecture information');
          }
          if (!cleanedText || cleanedText.trim().length === 0) {
            throw new Error('Missing question text');
          }

          // Resolve optional niveau/semestre
          const niveauRaw = rowData['niveau'] || '';
          const semestreRaw = rowData['semestre'] || '';
          let niveauId: string | null = null;
          let semesterId: string | null = null;
          if (niveauRaw) {
            const normalized = normalizeNiveauName(niveauRaw);
            const found = Array.from(niveauxCache.values()).find(n => n.name.toUpperCase() === normalized);
            if (found) {
              niveauId = found.id;
            } else {
              const created = await prisma.niveau.create({ data: { name: normalized, order: Math.max(1, allNiveaux.length + 1) } });
              niveauxCache.set(created.name.toLowerCase(), { id: created.id, name: created.name });
              niveauxCache.set(created.name.replace(/\s+/g, '').toLowerCase(), { id: created.id, name: created.name });
              niveauId = created.id;
              updateProgress(importId, 25, `Created niveau: ${created.name}`, `✅ Created niveau: ${created.name}`);
            }
          }

          if (niveauId && semestreRaw) {
            const order = parseSemesterOrder(semestreRaw);
            if (order) {
              const keyByOrder = `${niveauId}:order:${order}`;
              let sem = semestersCache.get(keyByOrder);
              if (!sem) {
                const niveauName = Array.from(niveauxCache.values()).find(n => n.id === niveauId)?.name || 'NIVEAU';
                const name = `${niveauName} - S${order}`;
                const created = await prisma.semester.create({ data: { name, order, niveauId } });
                sem = { id: created.id, name: created.name, order: created.order, niveauId };
                semestersCache.set(`${niveauId}:order:${order}`, sem);
                semestersCache.set(`${niveauId}:${created.name.toLowerCase()}`, sem);
                updateProgress(importId, 25, `Created semester: ${name}`, `✅ Created semester: ${name}`);
              }
              semesterId = sem.id;
            }
          }

          // Find or create specialty
          let specialty = createdSpecialties.get(specialtyName);
          if (!specialty) {
            specialty = await prisma.specialty.findFirst({
              where: { name: specialtyName }
            });
            
            if (!specialty) {
              specialty = await prisma.specialty.create({
                data: { 
                  name: specialtyName,
                  ...(niveauId ? { niveauId } : {}),
                  ...(semesterId ? { semesterId } : {})
                }
              });
              importStats.createdSpecialties++;
              updateProgress(importId, progress, `Created specialty: ${specialtyName}`, `✅ Created specialty: ${specialtyName}`);
            }
            // Update existing specialty if it lacks niveau/semester
            else {
              const updates: Prisma.SpecialtyUpdateInput = {};
              if (niveauId && !specialty.niveauId) {
                (updates as any).niveau = { connect: { id: niveauId } };
              }
              if (semesterId && !specialty.semesterId) {
                (updates as any).semester = { connect: { id: semesterId } };
              }
              if (Object.keys(updates).length > 0) {
                specialty = await prisma.specialty.update({ where: { id: specialty.id }, data: updates });
                updateProgress(importId, progress, `Updated specialty`, `ℹ️ Linked specialty to niveau/semester`);
              }
            }
            createdSpecialties.set(specialtyName, specialty);
          }

          // Find or create lecture
          const lectureKey = `${specialty.id}_${lectureTitle}`;
          let lecture = createdLectures.get(lectureKey);
          if (!lecture) {
            lecture = await prisma.lecture.findFirst({
              where: { 
                specialtyId: specialty.id,
                title: lectureTitle
              }
            });
            
            if (!lecture) {
              lecture = await prisma.lecture.create({
                data: {
                  specialtyId: specialty.id,
                  title: lectureTitle
                }
              });
              importStats.createdLectures++;
              updateProgress(importId, progress, `Created lecture: ${lectureTitle}`, `✅ Created lecture: ${lectureTitle}`);
            }
            createdLectures.set(lectureKey, lecture);
          }

          // Handle clinical cases
          let caseNumber = null;
          let caseText = null;
          let caseQuestionNumber = null;

          if (sheetName === 'cas_qcm' || sheetName === 'cas_qroc') {
            caseNumber = parseInt(rowData['cas n']) || null;
            caseText = rowData['texte du cas'] || null;
            caseQuestionNumber = parseInt(rowData['question n']) || null;

            if (caseNumber && caseText) {
              // Check if this case already exists in our tracking
              const caseKey = `${lecture.id}_${caseNumber}`;
              if (!createdCases.has(caseKey)) {
                createdCases.set(caseKey, { caseNumber, caseText });
                importStats.createdCases++;
                updateProgress(importId, progress, `Created case ${caseNumber}`, `✅ Created clinical case ${caseNumber}: ${caseText.substring(0, 50)}...`);
              }
            }
          }

          let hostedUrl: string | null = mediaUrl;
          let hostedType: string | null = mediaType;
          if (mediaUrl) {
            // Rehost if configured (currently no-op returning same url)
            const hosted = await rehostImageIfConfigured(mediaUrl);
            hostedUrl = hosted.url;
            hostedType = hosted.type;
            importStats.questionsWithImages++;
            updateProgress(importId, progress, `Extracted image from question`, `🖼️ Extracted image: ${hostedUrl}`);
          }

          // Prepare question data based on sheet type
          type MutableQuestionData = {
            lectureId: string;
            text: string;
            courseReminder: string | null;
            number: number | null;
            session?: string | null;
            mediaUrl?: string | null;
            mediaType?: string | null;
            type?: string;
            options?: string[] | null;
            correctAnswers?: string[];
            caseNumber?: number | null;
            caseText?: string | null;
            caseQuestionNumber?: number | null;
          };

          let questionData: MutableQuestionData = {
            lectureId: lecture.id,
            text: cleanedText,
            courseReminder: null,
            number: Number.isFinite(parseInt(rowData['question n'])) ? parseInt(rowData['question n']) : null,
            session: rowData['source'] || null,
            mediaUrl: hostedUrl,
            mediaType: hostedType
          };

          // Inject course reminder (rappel) if provided
          if (rowData['rappel']) {
            const rappelVal = String(rowData['rappel']).trim();
            if (rappelVal) {
              questionData.courseReminder = rappelVal;
            }
          }

          // If no media extracted from text and an explicit image column exists, use it
          if (!questionData.mediaUrl && rowData['image']) {
            const rawImg = String(rowData['image']).trim();
            if (rawImg) {
              questionData.mediaUrl = rawImg;
              const isImage = /\.(png|jpe?g|gif|webp|svg|bmp|tiff|ico)(\?.*)?$/i.test(rawImg) || rawImg.startsWith('http') || rawImg.startsWith('data:image/');
              questionData.mediaType = isImage ? 'image' : (questionData.mediaType || null);
              hostedUrl = questionData.mediaUrl; // keep for stats increment below
              hostedType = questionData.mediaType || null;
              importStats.questionsWithImages++;
              updateProgress(importId, progress, 'Attached image column to question', `🖼️ Image column used: ${rawImg.substring(0,80)}`);
            }
          }

          // Set question type and specific fields
          switch (sheetName) {
            case 'qcm': {
              const { options, correctAnswers } = parseMCQOptions(rowData);
              questionData.type = 'mcq';
              questionData.options = options;
              questionData.correctAnswers = correctAnswers;
              if (!options || options.length === 0) throw new Error('MCQ missing options');
              if (!correctAnswers || correctAnswers.length === 0) throw new Error('MCQ missing correct answers');
              break;
            }

            case 'qroc': {
              questionData.type = 'qroc';
              {
                const ans = String(rowData['reponse'] || '').trim();
                if (!ans) throw new Error('QROC missing answer');
                questionData.correctAnswers = [ans];
              }
              break;
            }

            case 'cas_qcm': {
              const casQcmOptions = parseMCQOptions(rowData);
              questionData.type = 'clinic_mcq';
              questionData.options = casQcmOptions.options;
              questionData.correctAnswers = casQcmOptions.correctAnswers;
              questionData.caseNumber = caseNumber;
              questionData.caseText = caseText;
              questionData.caseQuestionNumber = caseQuestionNumber;
              if (!casQcmOptions.options || casQcmOptions.options.length === 0) throw new Error('Clinical MCQ missing options');
              if (!casQcmOptions.correctAnswers || casQcmOptions.correctAnswers.length === 0) throw new Error('Clinical MCQ missing correct answers');
              break;
            }

            case 'cas_qroc': {
              questionData.type = 'clinic_croq';
              {
                const ans = String(rowData['reponse'] || '').trim();
                if (!ans) throw new Error('Clinical QROC missing answer');
                questionData.correctAnswers = [ans];
              }
              questionData.caseNumber = caseNumber;
              questionData.caseText = caseText;
              questionData.caseQuestionNumber = caseQuestionNumber;
              break;
            }
          }

          if (!questionData.type || !questionData.correctAnswers || questionData.correctAnswers.length === 0) {
            throw new Error('Invalid question data: missing type or correct answers');
          }

          const data: Prisma.QuestionUncheckedCreateInput = {
            lectureId: questionData.lectureId,
            text: questionData.text,
            type: questionData.type,
            options: questionData.options ?? undefined,
            correctAnswers: questionData.correctAnswers,
            explanation: buildCombinedExplanation(rowData),
            courseReminder: questionData.courseReminder,
            number: questionData.number,
            session: questionData.session ?? undefined,
            mediaUrl: questionData.mediaUrl ?? undefined,
            mediaType: questionData.mediaType ?? undefined,
            caseNumber: questionData.caseNumber ?? undefined,
            caseText: questionData.caseText ?? undefined,
            caseQuestionNumber: questionData.caseQuestionNumber ?? undefined
          };

          // Create the question
          await prisma.question.create({
            data
          });

          importStats.imported++;
          updateProgress(importId, progress, `Imported question ${i + 1}`, `✅ Imported ${sheetName} question: ${cleanedText.substring(0, 50)}...`);

        } catch (error) {
          importStats.failed++;
          const errorMsg = `Row ${i + 1} in ${sheetName}: ${(error as Error).message}`;
          updateProgress(importId, progress, `Error in row ${i + 1}`, `❌ ${errorMsg}`);
          importStats.errors.push(errorMsg);
          console.error(`Error processing row ${i + 1} in ${sheetName}:`, error);
        }

        // Yield every 25 rows to avoid blocking event loop (helpful on serverless and prevents watchdog timeouts)
        if (i > 0 && i % 25 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }
    }

    // Update final stats (preserve latest progress/message/logs)
  const currentSession = activeImports.get(importId) || { progress: 0, phase: 'importing', message: '', logs: [], lastUpdated: Date.now(), createdAt: Date.now() } as ImportSession;
    const finalSession = activeImports.get(importId);
    if (finalSession && !finalSession.cancelled) {
      activeImports.set(importId, {
        ...finalSession,
        progress: 100,
        phase: 'complete',
        stats: importStats,
        message: 'Import completed',
        lastUpdated: Date.now()
      });
    }

    updateProgress(importId, 100, 'Import completed!', `🎉 Import completed! Total: ${importStats.total}, Imported: ${importStats.imported}, Failed: ${importStats.failed}, Created: ${importStats.createdSpecialties} specialties, ${importStats.createdLectures} lectures, ${importStats.createdCases} cases, ${importStats.questionsWithImages} questions with images`, 'complete');

  } catch (error) {
    console.error('File processing error:', error);
    updateProgress(importId, 0, 'Import failed', `❌ Import failed: ${(error as Error).message}`);
  }
}

async function postHandler(request: AuthenticatedRequest) {
  try {
    console.log('POST handler called');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    console.log('File received:', file ? { name: file.name, size: file.size } : 'No file');
    
    if (!file) {
      console.log('No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const importId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('Creating import session with ID:', importId);
    
    // Initialize import session
    const now = Date.now();
    const initialSession: ImportSession = {
      progress: 0,
      phase: 'validating',
      message: 'Starting import...',
      logs: [],
      stats: {
        total: 0,
        imported: 0,
        failed: 0,
        createdSpecialties: 0,
        createdLectures: 0,
        questionsWithImages: 0,
        createdCases: 0,
        errors: []
      },
      lastUpdated: now,
      createdAt: now
    };
    
    activeImports.set(importId, initialSession);

    console.log('Import session created. Total active imports:', activeImports.size);
    console.log('Session data:', activeImports.get(importId));

    // Process file in background
    console.log('Starting file processing in background');
  // Kick off async processing (do not await to return quickly).
  // NOTE: On serverless platforms long-running background tasks may be killed;
  // keep rows moderate or refactor to chunked polling if needed.
  processFile(file, importId).catch(e => console.error('Background import error', e));

    console.log('Returning importId:', importId);
    return NextResponse.json({ importId });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}

async function getHandler(request: AuthenticatedRequest) {
  try {
    console.log('GET handler called');
    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('importId');

    console.log('GET request for importId:', importId);
    console.log('Total active imports:', activeImports.size);
    console.log('Available import IDs:', Array.from(activeImports.keys()));

    if (!importId) {
      console.log('No importId provided');
      return NextResponse.json({ error: 'Import ID required' }, { status: 400 });
    }

    const importData = activeImports.get(importId);
    console.log('Import data found:', importData ? 'Yes' : 'No');
    
    if (!importData) {
      console.log('Import session not found for ID:', importId);
      console.log('Current active imports:', Array.from(activeImports.entries()));
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });
    }

    console.log('Found import data for ID:', importId, 'Progress:', importData.progress);
    
    // Check if this is an SSE request (EventSource)
    const acceptHeader = request.headers.get('accept');
    console.log('Accept header:', acceptHeader);
    
    if (acceptHeader && acceptHeader.includes('text/event-stream')) {
      console.log('SSE request detected');
      // Return SSE response
      const stream = new ReadableStream({
        start(controller) {
          const sendEvent = (data: unknown) => {
            const eventData = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(new TextEncoder().encode(eventData));
          };

          // Send initial data
          sendEvent(importData);

          // Set up polling to send updates
          const interval = setInterval(() => {
            const currentData = activeImports.get(importId);
            if (currentData) {
              sendEvent(currentData);
              
              // Close stream if import is complete
              if (currentData.progress >= 100) {
                clearInterval(interval);
                controller.close();
              }
            } else {
              clearInterval(interval);
              controller.close();
            }
          }, 1000);

          // Clean up on close
          return () => {
            clearInterval(interval);
          };
        }
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    console.log('Returning JSON response');
    // Regular JSON response
    return NextResponse.json(importData);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 });
  }
}

export const GET = requireAuth(getHandler);
export const POST = requireAuth(postHandler);

// Allow cancelling an active import
async function deleteHandler(request: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const importId = searchParams.get('importId');
  if (!importId) return NextResponse.json({ error: 'Import ID required' }, { status: 400 });
  const session = activeImports.get(importId);
  if (!session) return NextResponse.json({ error: 'Import not found' }, { status: 404 });
  activeImports.set(importId, { ...session, cancelled: true, message: 'Cancelled by user', phase: 'complete', lastUpdated: Date.now() });
  return NextResponse.json({ ok: true });
}

export const DELETE = requireAuth(deleteHandler);

// Test endpoint to verify route is working
export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}