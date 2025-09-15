# AI Assistant Documentation: Explanation Generation System

## 🤖 Overview

The AI Assistant in the Medical Question Platform is a sophisticated system that automatically generates detailed explanations for medical questions (QCM and QROC) through a background job processing architecture. It uses Azure OpenAI GPT-4 to analyze medical questions and provide expert-level explanations for each answer option.

## 🏗️ System Architecture

### Complete Workflow Process

```
1. File Upload → 2. Job Creation → 3. Background Processing → 4. AI Analysis → 5. Results Generation
      ↓                ↓                   ↓                    ↓                  ↓
 User uploads    Job queued in     Background processor    AI generates     Enhanced file
 Excel file      database with     picks up job and       explanations     available for
 via web UI      status 'queued'   marks as 'processing'  for each option  download
```

## 📋 Detailed Component Breakdown

### 1. Frontend Upload Interface (`/admin/validation`)

**File**: `/src/app/admin/validation/page.tsx`

**Purpose**: Provides the user interface for uploading Excel files and monitoring AI validation jobs.

**Key Features**:
- File drag-and-drop upload interface
- Real-time job progress monitoring
- Paginated job management table (4 jobs per page)
- Auto-refresh every 3 seconds when jobs are active
- Detailed progress preview dialog

**Upload Process**:
```typescript
const handleFileValidation = async () => {
  if (!file) return;

  setLoading(true);
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    // Optional: Add custom instructions for AI
    if (customInstructions) {
      formData.append('instructions', customInstructions);
    }

    const response = await fetch('/api/validation/ai', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`AI validation job created: ${result.jobId}`);
      await fetchAllJobs(); // Refresh jobs list
    }
  } catch (error) {
    console.error('Validation error:', error);
  } finally {
    setLoading(false);
  }
};
```

### 2. API Validation Endpoint (`/api/validation/ai`)

**File**: `/src/app/api/validation/ai/route.ts`

**Purpose**: Processes uploaded Excel files and creates AI validation jobs for background processing.

**Supported File Formats**:
- Excel files (.xlsx, .xls)
- Multi-sheet workbooks with sheets: `qcm`, `qroc`, `cas_qcm`, `cas_qroc`
- Error export files with a single `Erreurs` sheet

**Processing Logic**:

#### Step 1: File Parsing
```typescript
// Parse Excel workbook
const buffer = await file.arrayBuffer();
const workbook = read(buffer);
const sheetNames = Object.keys(workbook.Sheets);

// Normalize sheet names (accent-insensitive, case-insensitive)
const mapSheetName = (s: string): SheetName | null => {
  const n = normalizeSheet(s);
  if (n === 'qcm' || n === 'questions qcm') return 'qcm';
  if (n === 'qroc' || n === 'croq') return 'qroc';
  if (n === 'cas qcm' || n === 'cas-qcm' || n === 'cas_qcm') return 'cas_qcm';
  if (n === 'cas qroc' || n === 'cas-qroc' || n === 'cas_qroc') return 'cas_qroc';
  return null;
};
```

#### Step 2: Data Extraction
```typescript
// Extract rows from each sheet
for (const sheetName of sheetNames) {
  const ws = workbook.Sheets[sheetName];
  const data = utils.sheet_to_json(ws, { header: 1 });
  
  const headerRaw = (data[0] as string[]).map(h => String(h ?? ''));
  const header = headerRaw.map(canonicalizeHeader);
  
  // Process each data row
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as any[];
    const record: Record<string, any> = {};
    header.forEach((h, idx) => { 
      record[h] = String((row as any[])[idx] ?? '').trim(); 
    });
    
    rows.push({ sheet: canonicalName, row: i + 1, original: record });
  }
}
```

#### Step 3: Job Creation
```typescript
// Create AI validation job in database
const job = await prisma.aiValidationJob.create({
  data: {
    fileName: file.name,
    originalFileName: file.name,
    fileSize: file.size,
    status: 'queued',
    userId: request.user.userId,
    instructions: customInstructions,
    totalItems: mcqRows.length,
    config: {
      batchSize: 50,
      concurrency: 4,
      systemPrompt: customInstructions
    },
    // Store file data for background processing
    resultData: {
      fileData: buffer.toString('base64'),
      originalRows: rows
    }
  }
});

return NextResponse.json({ 
  message: 'AI validation job created successfully',
  jobId: job.id 
});
```

### 3. Background Job Processor

**File**: `/src/lib/services/aiJobProcessor.ts`

**Purpose**: Runs continuously in the background to process queued AI validation jobs.

**Architecture**:
- Singleton pattern to ensure only one processor instance
- Automatic startup when the application initializes
- Error recovery and retry mechanisms
- Progress tracking and status updates

#### Job Processing Loop
```typescript
export class AiJobProcessor {
  private isProcessing = false;
  private currentJobId: string | null = null;

  async startProcessing() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    console.log('[AI Job Processor] Starting background processing...');

    // Process jobs in a loop with error recovery
    while (this.isProcessing) {
      try {
        await this.processNextJob();
        await this.sleep(2000); // Check for new jobs every 2 seconds
      } catch (error) {
        console.error('[AI Job Processor] Error in main loop:', error);
        await this.sleep(5000); // Wait 5 seconds on error
      }
    }
  }

  private async processNextJob(): Promise<void> {
    // Find the next queued job
    const job = await prisma.aiValidationJob.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      include: { user: true }
    });

    if (!job) return; // No jobs to process

    this.currentJobId = job.id;

    try {
      console.log(`[AI Job Processor] Starting job ${job.id}`);

      // Mark job as processing
      await this.updateJobStatus(job.id, 'processing', 'Starting AI validation...');

      // Execute the job
      await this.executeJob(job);

    } catch (error: any) {
      console.error(`[AI Job Processor] Job ${job.id} failed:`, error);
      await this.updateJobStatus(job.id, 'failed', `Error: ${error.message}`);
    } finally {
      this.currentJobId = null;
    }
  }
}
```

#### Job Execution Process
```typescript
private async executeJob(job: any): Promise<void> {
  const stats: AiJobStats = {
    processedBatches: 0,
    totalBatches: 0,
    fixedCount: 0,
    ragAppliedCount: 0,
    errorCount: 0,
    startTime: Date.now()
  };

  // 1. Parse Excel file from stored data
  const fileData = job.resultData?.fileData;
  const buffer = Buffer.from(fileData, 'base64');
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // 2. Extract and process rows
  const rows = this.parseWorkbookRows(workbook);
  const mcqRows = rows.filter(r => r.sheet === 'qcm' || r.sheet === 'cas_qcm');

  await this.updateJobProgress(job.id, 10, `Analyzing ${mcqRows.length} MCQ items...`);

  // 3. Prepare items for AI analysis
  const aiItems = mcqRows.map((r, idx) => ({
    id: `${r.sheet}:${r.row}`,
    questionText: r.questionText,
    options: r.options,
    providedAnswerRaw: r.providedAnswerRaw
  }));

  // 4. Run AI analysis with progress tracking
  const resultMap = await analyzeMcqInChunks(aiItems, {
    batchSize: config.batchSize || 50,
    concurrency: config.concurrency || 4,
    systemPrompt: config.systemPrompt,
    onBatch: (info) => {
      const progress = Math.floor(50 + (info.index / info.total) * 40);
      this.updateJobProgress(job.id, progress, 
        `Processing batch ${info.index}/${info.total}...`);
    }
  });

  // 5. Generate enhanced Excel file
  const enhancedWorkbook = this.createEnhancedWorkbook(rows, resultMap);
  
  // 6. Save results and mark job complete
  await this.finalizeJob(job.id, enhancedWorkbook, stats);
}
```

### 4. AI Analysis Engine

**File**: `/src/lib/services/aiImport.ts`

**Purpose**: Core AI processing logic using Azure OpenAI GPT-4 to generate medical explanations.

#### AI Configuration
```typescript
// Azure OpenAI setup
function createAzureClient() {
  const config = getAzureConfig();
  return createAzure({
    resourceName: config.resourceName,
    apiKey: config.apiKey,
    apiVersion: '2024-08-01-preview',
    useDeploymentBasedUrls: true
  });
}

// Medical expert prompt system
const MEDICAL_EXPERT_PROMPT = `Tu aides des étudiants en médecine en corrigeant des QCMs.
Ta réponse doit être rédigée comme un excellent étudiant de dernière année qui explique à ses camarades.

🎯 Ce que tu reçois: L'énoncé du QCM avec ses propositions (A, B, C, D, E).

📝 Règles d'explication:

1. Style: Court, naturel, direct, comme une explication rapide entre étudiants.
2. Structure par option: Commence par un connecteur varié (Oui…/Exact…/Au contraire…/Non…)
3. Contenu: Explique les mécanismes, causes, conséquences, chiffres quand pertinent

✅ Exigences:
- CHAQUE option DOIT avoir une explication détaillée et complète
- Si vraie: expliquer POURQUOI elle est vraie  
- Si fausse: expliquer POURQUOI elle est fausse ET donner la correction
- Ajouter des détails cliniques, épidémiologiques, physiopathologiques
- Style étudiant mais expertise médicale rigoureuse et TRÈS détaillée`;
```

#### Batch Processing System
```typescript
export async function analyzeMcqInChunks(
  items: MCQAiItem[],
  options: {
    batchSize?: number;
    concurrency?: number;
    systemPrompt?: string;
    onBatch?: (info: { index: number; total: number }) => void;
  } = {}
): Promise<Map<string, MCQAiResult>> {
  
  const { batchSize = 50, concurrency = 4, systemPrompt, onBatch } = options;
  
  // Split items into batches
  const batches: MCQAiItem[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const results = new Map<string, MCQAiResult>();
  
  // Process batches with controlled concurrency
  for (let i = 0; i < batches.length; i += concurrency) {
    const batchPromises = batches
      .slice(i, i + concurrency)
      .map((batch, batchIndex) => 
        processBatch(batch, systemPrompt, i + batchIndex + 1, batches.length)
      );

    const batchResults = await Promise.allSettled(batchPromises);
    
    // Merge results and handle errors
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        result.value.forEach((item, id) => results.set(id, item));
      } else {
        console.error('[AI] Batch processing failed:', result.reason);
      }
    });

    // Progress callback
    onBatch?.({ index: Math.min(i + concurrency, batches.length), total: batches.length });
  }

  return results;
}
```

#### Individual Batch Processing
```typescript
async function processBatch(
  batch: MCQAiItem[],
  systemPrompt?: string,
  batchNumber?: number,
  totalBatches?: number
): Promise<Map<string, MCQAiResult>> {
  
  const azureClient = createAzureClient();
  
  // Prepare prompt with medical questions
  const questionsText = batch.map((item, index) => 
    `Question ${index + 1} (ID: ${item.id}):
${item.questionText}

Options:
${item.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}
`
  ).join('\n---\n');

  const fullPrompt = `${MEDICAL_EXPERT_PROMPT}

${systemPrompt ? `Instructions supplémentaires: ${systemPrompt}\n\n` : ''}

Questions à analyser:
${questionsText}`;

  // AI Generation with structured output
  const result = await retryWithBackoff(async () => {
    return await generateObject({
      model: azureClient('gpt-4'),
      schema: MCQAnalysisSchema,
      prompt: fullPrompt,
      temperature: 0.1, // Low temperature for consistency
    });
  });

  // Process and validate results
  const resultMap = new Map<string, MCQAiResult>();
  
  for (const aiResult of result.object.results) {
    if (validateAIResponse(aiResult, batch.length)) {
      resultMap.set(aiResult.id, {
        id: aiResult.id,
        status: 'ok',
        correctAnswers: aiResult.correctAnswers,
        noAnswer: aiResult.noAnswer,
        optionExplanations: aiResult.optionExplanations
      });
    }
  }

  return resultMap;
}
```

### 5. Results Integration & File Generation

#### Explanation Merging Process
```typescript
// Merge AI explanations back into original questions
const enhancedRows = rows.map(r => {
  if (r.sheet === 'qcm' || r.sheet === 'cas_qcm') {
    const aiResult = resultMap.get(`${r.sheet}:${r.row}`);
    const record = { ...r.original };
    
    if (aiResult && aiResult.status === 'ok') {
      // Update correct answer if AI found better one
      if (aiResult.correctAnswers.length) {
        const letters = aiResult.correctAnswers.map(n => 
          String.fromCharCode(65 + n));
        record['reponse'] = letters.join(', ');
      }
      
      // Add comprehensive explanations
      if (aiResult.optionExplanations?.length) {
        const merged = 'Explications (IA):\n' + 
          aiResult.optionExplanations.map((e, j) => 
            `(${String.fromCharCode(65 + j)}) ${e}`
          ).join('\n');
          
        const base = String(record['explication'] || '').trim();
        record['explication'] = base ? base + '\n\n' + merged : merged;
        
        // Fill per-option explanation columns
        const letters = ['a', 'b', 'c', 'd', 'e'] as const;
        for (let j = 0; j < Math.min(letters.length, aiResult.optionExplanations.length); j++) {
          record[`explication ${letters[j]}`] = 
            String(aiResult.optionExplanations[j] || '').trim();
        }
      }
    }
    
    return { ...r, enhanced: record };
  }
  
  return { ...r, enhanced: r.original };
});
```

#### Enhanced Excel Generation
```typescript
// Create enhanced workbook with AI explanations
private createEnhancedWorkbook(rows: any[], aiResults: Map<string, MCQAiResult>) {
  const bySheet: Record<SheetName, any[]> = { 
    qcm: [], qroc: [], cas_qcm: [], cas_qroc: [] 
  };
  
  // Group enhanced rows by sheet
  for (const row of rows) {
    const enhanced = this.mergeAIExplanations(row, aiResults);
    bySheet[row.sheet].push(enhanced);
  }
  
  // Create workbook with enhanced data
  const workbook = utils.book_new();
  const headers = [
    'matiere', 'cours', 'question n', 'texte de la question', 
    'reponse', 'option a', 'option b', 'option c', 'option d', 'option e',
    'explication', 'explication a', 'explication b', 'explication c', 
    'explication d', 'explication e'
  ];
  
  (['qcm', 'qroc', 'cas_qcm', 'cas_qroc'] as SheetName[]).forEach(sheetName => {
    const data = bySheet[sheetName];
    if (data && data.length) {
      const ws = utils.json_to_sheet(data, { header: headers });
      utils.book_append_sheet(workbook, ws, sheetName);
    }
  });
  
  return workbook;
}
```

### 6. Progress Tracking & Real-time Updates

#### Progress Update System
```typescript
// Update job progress in database
private async updateJobProgress(
  jobId: string, 
  progress: number, 
  message: string, 
  stats?: AiJobStats
) {
  await prisma.aiValidationJob.update({
    where: { id: jobId },
    data: {
      progress: Math.min(100, Math.max(0, progress)),
      message,
      processedItems: stats?.processedBatches,
      totalItems: stats?.totalBatches,
      ragAppliedCount: stats?.ragAppliedCount,
      fixedCount: stats?.fixedCount,
      updatedAt: new Date()
    }
  });
}
```

#### Frontend Progress Monitoring
```typescript
// FilePreviewDialog auto-refresh for progress updates
useEffect(() => {
  if (!isOpen || !preview?.progressInfo?.isProcessing) {
    setAutoRefresh(false);
    return;
  }

  setAutoRefresh(true);
  const interval = setInterval(loadPreview, 2000); // Refresh every 2 seconds

  return () => {
    clearInterval(interval);
    setAutoRefresh(false);
  };
}, [isOpen, preview?.progressInfo?.isProcessing]);

// Load preview data with progress information
const loadPreview = async () => {
  if (!isOpen) return;

  setLoading(true);
  try {
    const response = await fetch(`/api/ai-jobs/${jobId}/preview`);
    if (response.ok) {
      const data = await response.json();
      setPreview(data);

      // Enable auto-refresh if job is processing
      if (data.progressInfo?.isProcessing) {
        setAutoRefresh(true);
      }
    }
  } catch (error) {
    console.error('Failed to load preview:', error);
  } finally {
    setLoading(false);
  }
};
```

## 📊 AI Analysis Output Format

### Structured Response Schema
```typescript
interface AIAnalysisResult {
  results: Array<{
    id: string;                    // Question identifier
    status: 'ok';                  // Processing status
    correctAnswers: number[];      // Array of correct option indices (0-4)
    noAnswer: boolean;             // True if no correct answer found
    optionExplanations: string[];  // Detailed explanation for each option
  }>;
}
```

### Example AI Response
```json
{
  "results": [
    {
      "id": "qcm:15",
      "status": "ok",
      "correctAnswers": [0, 2],
      "noAnswer": false,
      "optionExplanations": [
        "Exact, l'hypertension artérielle est effectivement un facteur de risque majeur d'AVC ischémique. Elle fragilise la paroi vasculaire et favorise l'athérosclérose carotidienne.",
        "Faux, l'hypotension ne constitue pas un facteur de risque d'AVC ischémique. Au contraire, une tension basse est généralement protectrice.",
        "Correct, le diabète multiplie par 2 à 3 le risque d'AVC via l'accélération de l'athérosclérose et les modifications de la coagulation.",
        "Inexact, l'activité physique régulière est un facteur protecteur qui diminue le risque d'AVC de 25 à 30% selon les études épidémiologiques.",
        "Non, l'âge jeune (< 45 ans) n'est pas un facteur de risque. Le risque d'AVC augmente exponentiellement après 55 ans, doublant tous les 10 ans."
      ]
    }
  ]
}
```

## 🔧 Configuration & Customization

### Environment Variables
```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY="your-api-key"
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4"
AZURE_OPENAI_API_VERSION="2024-08-01-preview"

# Job Processing Configuration
AI_BATCH_SIZE=50              # Questions per AI batch
AI_CONCURRENCY=4              # Concurrent AI requests
AI_RETRY_ATTEMPTS=3           # Retry failed requests
AI_TIMEOUT=300000             # 5 minutes timeout

# Quality Control
MIN_EXPLANATION_LENGTH=20     # Minimum explanation length
MAX_BATCH_RETRIES=3          # Maximum batch retry attempts
EXPLANATION_QUALITY_THRESHOLD=0.9  # Quality validation threshold
```

### Custom Instructions
Users can provide custom instructions when uploading files:

```typescript
// Example custom instructions
const customInstructions = `
Focus on cardiology questions. 
Emphasize ECG interpretation and arrhythmia mechanisms.
Include specific drug dosages and contraindications.
Mention latest ESC guidelines when relevant.
`;
```

## 📈 Performance & Scalability

### Optimization Features
- **Batch Processing**: Groups questions for efficient AI processing
- **Concurrent Requests**: Multiple AI requests run in parallel
- **Retry Mechanisms**: Automatic retry with exponential backoff
- **Progress Caching**: Real-time progress updates without blocking
- **Quality Validation**: Ensures explanation quality before acceptance

### Monitoring & Analytics
- Processing speed tracking (questions per minute)
- Success/failure rates for AI analysis
- Average explanation quality scores
- User satisfaction metrics
- System resource utilization

### Error Handling
- Graceful degradation when AI is unavailable
- Automatic retry for transient failures
- Detailed error logging and reporting
- User-friendly error messages
- Manual job restart capabilities

This comprehensive AI assistant system provides medical students with expert-level explanations for their practice questions, enhancing their learning experience through automated, intelligent content generation.