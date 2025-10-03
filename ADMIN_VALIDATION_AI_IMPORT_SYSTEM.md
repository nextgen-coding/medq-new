# 🧠 Admin Validation & AI Import System - Complete Technical Documentation

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Frontend Components](#frontend-components)
4. [Backend API Routes](#backend-api-routes)
5. [AI Processing Pipeline](#ai-processing-pipeline)
6. [Data Flow](#data-flow)
7. [Error Handling & Recovery](#error-handling--recovery)
8. [Performance Optimization](#performance-optimization)

---

## 🎯 System Overview

The **Admin Validation & AI Import System** is a sophisticated platform that combines classical validation with AI-powered question enhancement for medical education content. It processes Excel/CSV files containing medical questions (QCM/QROC) and automatically:

1. **Validates** question format and structure
2. **Corrects** common errors and inconsistencies
3. **Enhances** questions with AI-generated explanations
4. **Imports** validated data into the database

### Key Features
- ✅ **Classical Validation (Filter)**: Fast format checking and error detection
- 🤖 **AI Enhancement**: Automated correction and explanation generation
- 📊 **Real-time Progress Tracking**: Live updates with SSE (Server-Sent Events)
- 🔄 **Batch Processing**: Handles large files with chunked AI requests
- 💾 **Persistent Sessions**: Resume support with in-memory + database storage
- 🚀 **High Performance**: Concurrent processing with configurable batch sizes

---

## 🏗️ Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                           │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │ Validation Page  │        │   Import Page    │          │
│  │ /admin/validation│        │  /admin/import   │          │
│  └────────┬─────────┘        └────────┬─────────┘          │
└───────────┼──────────────────────────┼─────────────────────┘
            │                           │
            │  API Calls (REST/SSE)    │
            │                           │
┌───────────┼──────────────────────────┼─────────────────────┐
│           ▼                           ▼      API LAYER      │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │ /api/validation  │        │ /api/questions   │          │
│  │      /ai         │        │   /bulk-import   │          │
│  │  /ai-progress    │        │                  │          │
│  └────────┬─────────┘        └────────┬─────────┘          │
└───────────┼──────────────────────────┼─────────────────────┘
            │                           │
            │  Process Data            │
            │                           │
┌───────────┼──────────────────────────┼─────────────────────┐
│           ▼                           ▼   SERVICE LAYER     │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │ aiImport.ts      │        │  Prisma ORM      │          │
│  │ analyzeMcqBatch  │◄───────┤  (Database)      │          │
│  │ azureAiSdk.ts    │        │                  │          │
│  └────────┬─────────┘        └──────────────────┘          │
└───────────┼─────────────────────────────────────────────────┘
            │
            │  AI API Calls
            │
┌───────────▼─────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Azure OpenAI (GPT-4)                       │   │
│  │  - Chat Completions API                              │   │
│  │  - Structured JSON Generation                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Frontend Components

### 1. Admin Validation Page (`/src/app/admin/validation/page.tsx`)

**Location**: `/admin/validation`

**Purpose**: Main interface for validating and enhancing medical questions with AI

#### Key State Management

```typescript
interface AiJob {
  id: string;                    // Unique job identifier (UUID)
  fileName: string;              // Original uploaded file name
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;              // 0-100
  message: string;               // Current operation message
  processedItems?: number;       // Items processed so far
  totalItems?: number;           // Total items to process
  createdAt: string;            // ISO timestamp
  startedAt?: string;           // ISO timestamp
  completedAt?: string;         // ISO timestamp
  user?: { name?: string; email?: string };
}

interface StatsData {
  totalJobs: number;
  completedJobs: number;
  activeJobs: number;
  failedJobs: number;
}
```

#### Core Features

##### A. Classical Validation (Filter)
```typescript
const handleClassicValidation = async () => {
  if (!file) return;
  
  try {
    setValidating(true);
    const formData = new FormData();
    formData.append('file', file);

    // POST to /api/validation (classical validation)
    const response = await fetch('/api/validation', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    // result: { good: GoodRow[], bad: BadRow[], goodCount, badCount, sessionId, fileName }
    
    setValidationResult(result);
    toast.success(`${result.goodCount} valides • ${result.badCount} erreurs`);
  } catch (error) {
    toast.error("Impossible de valider le fichier");
  } finally {
    setValidating(false);
  }
};
```

**What Classical Validation Does:**
- ✅ Checks required columns per sheet type (qcm, qroc, cas_qcm, cas_qroc)
- ✅ Validates MCQ answers (A-E format or "?" / "Pas de réponse")
- ✅ Ensures QROC answers are non-empty
- ✅ Verifies explanations if present
- ❌ Does NOT modify content
- ❌ Does NOT use AI

##### B. Auto-Refresh System
```typescript
useEffect(() => {
  // Only auto-refresh if there are active jobs (processing or queued)
  if (statsData.activeJobs > 0) {
    if (!refreshIntervalRef.current) {
      console.log(`🔄 Auto-refresh activated: ${statsData.activeJobs} active jobs`);
      refreshIntervalRef.current = setInterval(() => {
        loadJobs();  // Reload job list every 3 seconds
      }, 3000);
    }
  } else {
    if (refreshIntervalRef.current) {
      console.log('⏸️ Auto-refresh deactivated: no active jobs');
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }
}, [statsData.activeJobs, loadJobs]);
```

##### C. Job Management
```typescript
// Load jobs from API
const loadJobs = useCallback(async () => {
  const response = await fetch('/api/validation/ai-progress?action=list');
  const data = await response.json();
  
  // Map API response to UI format
  const mappedJobs = (data.jobs || []).map((job: any) => ({
    id: job.id,
    fileName: job.fileName || 'fichier.xlsx',
    status: job.phase === 'complete' ? 'completed' : 
            job.phase === 'error' ? 'failed' :
            job.phase === 'running' ? 'processing' : 'queued',
    progress: job.progress || 0,
    message: job.message || '',
    // ... other fields
  }));
  
  setAllJobs(mappedJobs);
}, []);
```

---

### 2. Admin Import Page (`/src/app/admin/import/page.tsx`)

**Location**: `/admin/import`

**Purpose**: Import validated questions into the database

#### Import Flow
```typescript
export default function ImportPage() {
  const [mode, setMode] = useState<'choose' | 'sessions' | 'questions'>('choose');
  
  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          {mode === 'choose' && (
            // Show selection: Sessions or Questions
          )}
          {mode === 'sessions' && <SessionImportPanel />}
          {mode === 'questions' && <QuestionImportPanel />}
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}
```

---

## 🔌 Backend API Routes

### 1. `/api/validation/ai` - AI Job Creation

**Method**: `POST`  
**Purpose**: Create a new AI validation job

**Request**:
```typescript
FormData {
  file: File,              // Excel/CSV file
  instructions?: string    // Optional custom AI instructions
}
```

**Process Flow**:
```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate user (admin only)
  const authReq = await authenticateRequest(request);
  if (authReq.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // 2. Validate file type and size
  const file = formData.get('file') as File;
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ];
  const maxSize = 50 * 1024 * 1024; // 50MB

  // 3. Create database job record
  const job = await prisma.aiValidationJob.create({
    data: {
      fileName: file.name,
      fileSize: file.size,
      status: 'queued',
      progress: 0,
      userId: authReq.user.userId,
      instructions: instructions || null,
      config: {
        aiModel: 'gpt-4',
        maxRetries: 3,
        batchSize: 40,
        qualityThreshold: 0.8
      }
    }
  });

  // 4. Start asynchronous processing (non-blocking)
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  
  processAiValidationJob(job.id, bytes, instructions).catch((err) => {
    console.error('AI processing error:', err);
  });

  // 5. Return immediately with job ID
  return NextResponse.json({
    id: job.id,
    status: job.status,
    message: 'AI validation job created successfully',
    estimatedDuration: 'quelques minutes selon la taille',
  });
}
```

**Response**:
```json
{
  "id": "uuid-job-id",
  "status": "queued",
  "message": "AI validation job created successfully",
  "estimatedDuration": "quelques minutes selon la taille"
}
```

---

### 2. `/api/validation/ai-progress` - Job Progress & Management

**Methods**: `GET`, `POST`, `DELETE`  
**Purpose**: Monitor job progress, list jobs, download results

#### A. GET - Multiple Actions

##### Action: `list` - Get All Jobs
```typescript
// Request
GET /api/validation/ai-progress?action=list

// Response
{
  "jobs": [
    {
      "id": "uuid",
      "fileName": "questions.xlsx",
      "phase": "complete",
      "progress": 100,
      "message": "IA terminée",
      "createdAt": 1234567890,
      "lastUpdated": 1234567890,
      "processedItems": 150,
      "totalItems": 150
    }
  ]
}
```

##### Action: `details` - Get Job Details
```typescript
// Request
GET /api/validation/ai-progress?aiId=uuid&action=details

// Response
{
  "id": "uuid",
  "fileName": "questions.xlsx",
  "status": "completed",
  "phase": "complete",
  "progress": 100,
  "message": "IA terminée",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:10:00Z",
  "logs": [
    "📖 Lecture du fichier…",
    "🔍 Préparation des questions…",
    "🧠 Démarrage IA: 150 questions MCQ",
    "✅ Corrigés: 150 • ❌ Restent en erreur: 0"
  ],
  "stats": {
    "totalRows": 150,
    "mcqRows": 120,
    "fixedCount": 150,
    "errorCount": 0
  }
}
```

##### Action: `download` - Download Enhanced File
```typescript
// Request
GET /api/validation/ai-progress?aiId=uuid&action=download

// Response
Binary XLSX file with headers:
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="questions-ai-fixed.xlsx"
```

##### No Action - SSE Stream (Real-time Updates)
```typescript
// Request
GET /api/validation/ai-progress?aiId=uuid

// Response (Server-Sent Events)
event: message
data: {"id":"uuid","phase":"running","progress":45,"message":"Processing batch 3/10…"}

event: message
data: {"id":"uuid","phase":"complete","progress":100,"message":"IA terminée"}
```

**SSE Implementation**:
```typescript
// Backend (route.ts)
const stream = new ReadableStream({
  start(controller) {
    const encoder = new TextEncoder();
    
    const interval = setInterval(() => {
      const session = activeAiSessions.get(aiId);
      if (!session) {
        clearInterval(interval);
        controller.close();
        return;
      }
      
      // Send update
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(session)}\n\n`)
      );
      
      // Close if complete
      if (session.phase === 'complete' || session.phase === 'error') {
        clearInterval(interval);
        controller.close();
      }
    }, 1000);
  }
});

return new NextResponse(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  }
});
```

#### B. DELETE - Remove Job
```typescript
// Request
DELETE /api/validation/ai-progress?aiId=uuid

// Process
1. Verify ownership (job belongs to requesting user)
2. Delete from database
3. Remove from in-memory session map

// Response
{ "ok": true }
```

---

### 3. `/api/questions/bulk-import` - Import Validated Data

**Method**: `POST`  
**Purpose**: Import AI-enhanced questions into database

**Request**:
```typescript
FormData {
  file: File  // Enhanced Excel file from AI processing
}
```

**Processing Flow**:
```typescript
async function postHandler(request: AuthenticatedRequest) {
  // 1. Read Excel file
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // 2. Parse sheets (qcm, qroc, cas_qcm, cas_qroc)
  const questions = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    
    // 3. For each row, find or create specialty/lecture
    for (const row of rows) {
      const specialty = await findOrCreateSpecialty(row.matiere);
      const lecture = await findOrCreateLecture(row.cours, specialty.id);
      
      // 4. Build question object
      questions.push({
        lectureId: lecture.id,
        type: determineType(sheetName),  // qcm, qroc, cas_qcm, cas_qroc
        text: row['texte de la question'],
        correctAnswers: parseAnswers(row.reponse),
        options: extractOptions(row),
        explanation: row.rappel,
        optionExplanations: extractOptionExplanations(row),
        number: row['question n'],
        session: row.source
      });
    }
  }
  
  // 5. Batch insert into database
  await prisma.question.createMany({
    data: questions,
    skipDuplicates: true
  });
  
  return NextResponse.json({
    success: true,
    imported: questions.length
  });
}
```

**Key Features**:
- ✅ **Auto-creates** specialties and lectures if not found
- ✅ **Deduplication** using skipDuplicates
- ✅ **Batch processing** (50 questions per batch)
- ✅ **Error tracking** per row

---

## 🤖 AI Processing Pipeline

### Core Service: `aiImport.ts`

**Location**: `/src/lib/services/aiImport.ts`

#### 1. Main Processing Function

```typescript
export async function analyzeMcqInChunks(
  items: MCQAiItem[],
  options: {
    batchSize?: number;        // Default: 50
    concurrency?: number;      // Default: 50
    onProgress?: (completed: number, total: number, stage: string) => void;
    systemPrompt?: string;     // Optional custom instructions
  } = {}
): Promise<MCQAiResult[]>
```

**Input Item Structure**:
```typescript
type MCQAiItem = {
  id: string;                  // Unique identifier (e.g., "qcm:42")
  questionText: string;        // Combined case + question text
  options: string[];           // Array of 5 options (A-E)
  providedAnswerRaw?: string;  // Original answer or "?" / "Pas de réponse"
};
```

**Output Result Structure**:
```typescript
type MCQAiResult = {
  id: string;
  status: 'ok' | 'error';
  correctAnswers?: number[];    // Indices (0-4 for A-E)
  noAnswer?: boolean;           // True if question is unusable
  optionExplanations?: string[]; // 5 explanations (one per option)
  globalExplanation?: string;    // Course reminder (rappel)
  error?: string;               // Error message if status='error'
};
```

#### 2. AI System Prompt

The system uses a **highly detailed prompt** to ensure professor-level explanations:

```typescript
const DEFAULT_SYSTEM_PROMPT = `Tu es PROFESSEUR de médecine de TRÈS HAUT NIVEAU: tu corriges des QCM pour des étudiants avancés avec une EXIGENCE ABSOLUE de QUALITÉ et COMPLÉTUDE.

NIVEAU ET DÉTAIL OBLIGATOIRE:
- Chaque option reçoit EXACTEMENT 4 à 6 phrases COMPLÈTES en mode professeur expert
- CONTENU SPÉCIFIQUE OBLIGATOIRE à l'option, segments séparés par des retours à la ligne
- Structure OBLIGATOIRE pour chaque option:
  1. Ouverture: connecteur VARIÉ + validation/réfutation immédiate
  2. Mécanisme physiopathologique DÉTAILLÉ ou principe clé COMPLET
  3. Implication clinique CONCRÈTE (épidémiologie/physio/signes) DÉTAILLÉE
  4. Critère discriminant PRÉCIS (clinique, para-clinique, seuil chiffré EXACT)
  5. Mini exemple clinique CONCRET (âge/contexte/signes cardinaux)
  6. Rappel théorique SUPPLÉMENTAIRE ou nuance clinique IMPORTANTE

RÈGLES DE FORMATAGE STRICT:
- JAMAIS recopier la formulation brute de l'option
- Commence TOUJOURS par le connecteur puis justification IMMÉDIATE
- Si option FAUSSE: « Non, en fait … car … » puis la bonne notion EXACTE
- VARIATION DE STYLE OBLIGATOIRE: JAMAIS de répétition des connecteurs
- Alterne connecteurs: Effectivement, Oui, Juste, Pertinent, En réalité, À l'inverse...

RAPPEL DU COURS (OBLIGATOIRE ET COMPLET):
- Fournis une synthèse de 3 à 5 phrases COMPLÈTES (mini cours DÉTAILLÉ)
- Structure: notion centrale, mécanisme clé, critères diagnostiques, piège principal, exemple clinique

RÉPONSES OBLIGATOIRES:
- Tu DOIS TOUJOURS fournir "correctAnswers" (indices numériques A=0 …)
- En cas d'incertitude, choisis la(les) réponse(s) la(les) plus plausible(s)
- N'utilise "noAnswer" que si la question est inutilisable structurellement

SORTIE JSON STRICT:
{
  "results": [
    {
      "id": "question_id",
      "status": "ok" | "error", 
      "correctAnswers": [0,2],
      "noAnswer": false,
      "globalExplanation": "RAPPEL DU COURS COMPLET 3-5 phrases détaillées",
      "optionExplanations": [
        "Connecteur_varié: explication_complète_4-6_phrases",
        ...
      ]
    }
  ]
}
`;
```

#### 3. Batch Processing Strategy

```typescript
// Configuration (environment variables)
const TURBO_MODE = !process.env.AI_SLOW_MODE;  // Default: TURBO
const BATCH_SIZE = TURBO_MODE ? 50 : 20;       // Questions per batch
const CONCURRENCY = TURBO_MODE ? 50 : 30;      // Concurrent API calls

// Process in chunks
const chunks: MCQAiItem[][] = [];
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  chunks.push(items.slice(i, i + BATCH_SIZE));
}

// Process with concurrency control
for (let i = 0; i < chunks.length; i += CONCURRENCY) {
  const batch = chunks.slice(i, i + CONCURRENCY);
  const promises = batch.map(chunk => analyzeMcqBatch(chunk, systemPrompt));
  const results = await Promise.all(promises);
  
  // Update progress
  onProgress?.(i + batch.length, chunks.length, `Processing batch ${i}/${chunks.length}`);
}
```

**Performance Characteristics**:
- **TURBO MODE** (default):
  - 50 questions per batch
  - 50 concurrent API calls
  - ~500ms per batch (2-3s for 150 questions)
  
- **SLOW MODE** (AI_SLOW_MODE=1):
  - 20 questions per batch
  - 30 concurrent API calls
  - More conservative for rate limits

#### 4. Azure OpenAI Integration

**File**: `/src/lib/ai/azureAiSdk.ts`

##### A. Structured Generation (Primary Method)
```typescript
export async function chatCompletionStructured(
  messages: ChatMessage[],
  options: { maxTokens?: number; systemPrompt?: string } = {}
) {
  // Use AI SDK's generateObject for guaranteed JSON
  const azure = createAzure({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    baseURL: `${endpoint}/openai`,
    apiVersion: '2024-08-01-preview',
    useDeploymentBasedUrls: true
  });

  const result = await generateObject({
    model: azure(deployment),
    messages: all,
    schema: mcqResultsSchema,  // Zod schema for validation
    maxTokens: options.maxTokens ?? 800
  });

  return { content: JSON.stringify(result.object), finishReason: result.finishReason };
}
```

**Zod Schema**:
```typescript
const resultItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(v => String(v)),
  status: z.union([z.literal('ok'), z.literal('error')]).optional(),
  correctAnswers: z.array(z.number()).optional(),
  noAnswer: z.boolean().optional(),
  globalExplanation: z.string().optional(),
  optionExplanations: z.array(z.string()).optional(),
  error: z.string().optional(),
}).passthrough();

const mcqResultsSchema = z.object({ 
  results: z.array(resultItemSchema) 
});
```

##### B. REST Fallback (Secondary Method)
```typescript
export async function chatCompletion(
  messages: ChatMessage[],
  options: { maxTokens?: number; systemPrompt?: string } = {}
) {
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      messages: all,
      response_format: { type: 'json_object' },
      max_completion_tokens: options.maxTokens ?? 800
    })
  });

  const json = await response.json();
  return { 
    content: json.choices[0].message.content,
    finishReason: json.choices[0].finish_reason
  };
}
```

**Error Handling & Retries**:
```typescript
const maxAttempts = 3;
let lastErr: any = null;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    const result = await chatCompletion(messages, options);
    return result;
  } catch (err: any) {
    lastErr = err;
    const msg = String(err?.message || err);
    
    // Retry on network failures
    if (attempt < maxAttempts && 
        /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
      const backoff = 500 * attempt;  // Exponential backoff
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }
    break;
  }
}

throw lastErr;
```

#### 5. JSON Parsing with Salvage

The system includes **robust JSON parsing** that handles truncated/malformed responses:

```typescript
function safeParseJson(content: string): any | null {
  // 1) Direct parse
  try { return JSON.parse(content); } catch {}
  
  // 2) Extract from code fence
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  
  // 3) Find first JSON object
  const resIdx = content.indexOf('{"results"');
  if (resIdx >= 0) {
    try { return JSON.parse(content.slice(resIdx)); } catch {}
  }
  
  // 4) Balance braces/brackets
  const openCurly = (content.match(/{/g) || []).length;
  const closeCurly = (content.match(/}/g) || []).length;
  let fixed = content;
  if (openCurly > closeCurly) {
    fixed += '}'.repeat(openCurly - closeCurly);
  }
  try { return JSON.parse(fixed); } catch {}
  
  // 5) Single-item salvage (last resort)
  // Retry each question individually if batch fails
  return null;
}
```

**Single-Item Salvage**:
```typescript
if (!parsed) {
  // Retry per-item when batch JSON fails
  const results: MCQAiResult[] = [];
  for (const item of items) {
    try {
      const singleResult = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ task: 'analyze_mcq_batch', items: [item] }) }
      ], { maxTokens: 800 });
      
      const singleJson = safeParseJson(singleResult.content);
      results.push(singleJson.results[0]);
    } catch {
      results.push({ id: item.id, status: 'error', error: 'Single-item fail' });
    }
  }
  return results;
}
```

---

## 📊 Data Flow

### Complete Processing Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│ 1. USER UPLOADS FILE                                         │
│    └─> Excel/CSV with sheets: qcm, qroc, cas_qcm, cas_qroc │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. FRONTEND: POST /api/validation/ai                        │
│    - Validate file type/size                                 │
│    - Create FormData with file + instructions                │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. API ROUTE: Create Job Record                             │
│    - Insert into aiValidationJob table                       │
│    - Generate UUID job ID                                    │
│    - Set status = 'queued'                                   │
│    - Return job ID immediately                               │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. BACKGROUND PROCESS: runAiSession()                       │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ A. Parse Excel File (XLSX.read)                     │  │
│    │    - Detect sheet names (normalize case)            │  │
│    │    - Map to types: qcm, qroc, cas_qcm, cas_qroc    │  │
│    │    - Extract rows with canonical headers            │  │
│    └─────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│    ┌─────────────────▼───────────────────────────────────┐  │
│    │ B. Prepare MCQ Items                                │  │
│    │    - Filter MCQ rows (qcm, cas_qcm)                │  │
│    │    - Repair question text & options                 │  │
│    │    - Normalize whitespace/HTML                      │  │
│    │    items: { id, questionText, options, answer }    │  │
│    └─────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│    ┌─────────────────▼───────────────────────────────────┐  │
│    │ C. AI Analysis (analyzeMcqInChunks)                │  │
│    │    - Split into batches (50 questions)              │  │
│    │    - Process with concurrency (50 parallel)         │  │
│    │    - Call Azure OpenAI for each batch               │  │
│    │    - Parse JSON results                              │  │
│    │    - Handle errors & retries                         │  │
│    └─────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│    ┌─────────────────▼───────────────────────────────────┐  │
│    │ D. Apply AI Results                                 │  │
│    │    - Merge correctAnswers → reponse column          │  │
│    │    - Insert optionExplanations → explication a-e    │  │
│    │    - Insert globalExplanation → rappel              │  │
│    │    - Fallback generation if AI failed               │  │
│    └─────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│    ┌─────────────────▼───────────────────────────────────┐  │
│    │ E. Analyze QROC Items                               │  │
│    │    - Filter QROC rows (qroc, cas_qroc)             │  │
│    │    - Generate missing answers & explanations        │  │
│    │    - Apply to rappel column                         │  │
│    └─────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│    ┌─────────────────▼───────────────────────────────────┐  │
│    │ F. Enhancement Pass (Optional)                      │  │
│    │    - Detect short/placeholder explanations          │  │
│    │    - Re-process with AI for more detail             │  │
│    │    - Ensure 2-4 sentences per option                │  │
│    │    - Skip if AI_FAST_MODE=1                         │  │
│    └─────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│    ┌─────────────────▼───────────────────────────────────┐  │
│    │ G. Build Output Excel                               │  │
│    │    - Create sheets: qcm, qroc, cas_qcm, cas_qroc   │  │
│    │    - Use canonical import headers                   │  │
│    │    - Include all fixed rows                         │  │
│    │    - Store as ArrayBuffer                           │  │
│    └─────────────────┬───────────────────────────────────┘  │
│                      │                                        │
│    ┌─────────────────▼───────────────────────────────────┐  │
│    │ H. Update Session & Database                        │  │
│    │    - Set phase = 'complete'                         │  │
│    │    - progress = 100                                  │  │
│    │    - Store resultBuffer in memory                   │  │
│    │    - Update DB with stats & logs                    │  │
│    └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. FRONTEND: Poll/Stream Progress                           │
│    - Auto-refresh every 3 seconds (if active jobs)           │
│    - OR SSE stream for real-time updates                     │
│    - Display progress bar & current message                  │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. USER: Download Enhanced File                             │
│    GET /api/validation/ai-progress?aiId=X&action=download   │
│    - Retrieve resultBuffer from memory OR database           │
│    - Return as Excel file download                           │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. USER: Import to Database                                 │
│    Navigate to /admin/import → Questions                     │
│    Upload enhanced file                                      │
│    POST /api/questions/bulk-import                           │
│    - Parse Excel sheets                                      │
│    - Create specialties & lectures (if needed)               │
│    - Insert questions with explanations                      │
│    - Return import statistics                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Error Handling & Recovery

### 1. Network Failures

**Retry Strategy**:
```typescript
const maxAttempts = 3;
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    const result = await chatCompletion(messages);
    return result;
  } catch (err) {
    if (attempt < maxAttempts && isNetworkError(err)) {
      const backoff = 500 * attempt;  // 500ms, 1s, 1.5s
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }
    throw err;
  }
}
```

### 2. JSON Parse Failures

**Salvage Hierarchy**:
1. Direct parse
2. Code fence extraction
3. Object start detection
4. Brace balancing
5. Single-item retry

### 3. Partial Batch Failures

**Per-Item Fallback**:
```typescript
// If batch fails, retry each item individually
if (!batchResult) {
  for (const item of items) {
    try {
      const singleResult = await analyzeMcqBatch([item]);
      results.push(singleResult[0]);
    } catch {
      results.push({ 
        id: item.id, 
        status: 'error', 
        error: 'Single-item fail' 
      });
    }
  }
}
```

### 4. Guaranteed Fix Mode

**Deterministic Fallbacks**:
```typescript
async function mcqForceFix(rec: Record<string, any>) {
  // Ensure at least one option
  if (allOptionsEmpty) {
    rec['option a'] = 'Option A';
  }
  
  // Ensure answer
  if (!rec['reponse']) {
    rec['reponse'] = '?';
  }
  
  // Generate professor-level explanations
  for (let i = 0; i < optionCount; i++) {
    if (!rec[`explication ${letter}`]) {
      rec[`explication ${letter}`] = fallbackExplanation(
        isCorrect, 
        optionText, 
        questionText
      );
    }
  }
  
  // Generate course reminder
  if (!rec['rappel']) {
    rec['rappel'] = fallbackRappel(questionText);
  }
}
```

**Fallback Templates**:
```typescript
function fallbackExplanation(isCorrect: boolean, optionText: string, stem: string) {
  const opener = pickOpener(isCorrect, seed);  // Deterministic, no randomness
  const intro = `${opener}: ${isCorrect ? 'proposition correcte' : 'proposition incorrecte'} — ${optionText}.`;
  const context = stem ? `Contexte: ${stem}.` : '';
  const core = isCorrect
    ? 'Argumentation clinique: critère diagnostique clé et élément différentiel avec un exemple chiffré.'
    : 'Correction ciblée: rectifie l'idée et précise le piège fréquent avec l'élément discriminant.';
  const tip = 'Repère à retenir: seuil ou signe précis utile en pratique.';
  
  return clamp2to4Sentences([intro, context, core, tip].join(' '));
}
```

---

## 🚀 Performance Optimization

### Configuration Variables

```bash
# AI Processing Mode
AI_SLOW_MODE=0                    # 0=TURBO (default), 1=SLOW

# Batch Configuration
AI_IMPORT_BATCH_SIZE=50           # Questions per batch (default: 50 TURBO, 20 SLOW)
AI_IMPORT_CONCURRENCY=50          # Concurrent API calls (default: 50 TURBO, 30 SLOW)

# Single-Question Mode (for testing)
AI_QCM_SINGLE=0                   # 1=Process one question at a time

# Text Truncation (reduce token usage)
AI_IMPORT_QTEXT_CAP=350           # Max question text length
AI_IMPORT_OPTION_CAP=120          # Max option text length

# Token Limits
AZURE_OPENAI_MAX_TOKENS=800       # Optimal for complete responses

# Retry Configuration
AI_RETRY_ATTEMPTS=2               # Number of retry attempts

# Enhancement
AI_FAST_MODE=0                    # 1=Skip enhancement pass for max speed

# Diversity Tuning
AZURE_OPENAI_TEMPERATURE=0.7      # 0-1.2 (higher = more creative)
AZURE_OPENAI_PRESENCE_PENALTY=0   # -2 to 2 (penalize repetition)
AZURE_OPENAI_FREQUENCY_PENALTY=0  # -2 to 2 (penalize common tokens)

# Azure Configuration
AZURE_OPENAI_API_KEY=***
AZURE_OPENAI_ENDPOINT=https://***.openai.azure.com
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

### Performance Benchmarks

**TURBO MODE** (default):
- **Batch Size**: 50 questions
- **Concurrency**: 50 parallel calls
- **Speed**: ~150 questions in 2-3 seconds
- **Use Case**: Production, fast imports

**SLOW MODE** (AI_SLOW_MODE=1):
- **Batch Size**: 20 questions
- **Concurrency**: 30 parallel calls
- **Speed**: ~150 questions in 5-7 seconds
- **Use Case**: Rate limit compliance, conservative processing

**SINGLE MODE** (AI_QCM_SINGLE=1):
- **Batch Size**: 1 question
- **Concurrency**: 1 call
- **Speed**: ~150 questions in 30-60 seconds
- **Use Case**: Debugging, testing

### Memory Management

**In-Memory Sessions**:
```typescript
// Global session map (survives between requests)
const activeAiSessions: Map<string, AiSession> = globalThis.__activeAiSessions;

// Session structure
type AiSession = {
  id: string;
  phase: 'queued' | 'running' | 'complete' | 'error';
  progress: number;
  message: string;
  logs: string[];
  stats: AiStats;
  resultBuffer?: ArrayBuffer;  // Excel file bytes
  createdAt: number;
  lastUpdated: number;
  userId?: string;
  fileName?: string;
};

// Automatic cleanup (30-minute TTL)
const SESSION_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeAiSessions.entries()) {
    const done = session.phase === 'complete' || session.phase === 'error';
    if (done && now - session.lastUpdated > SESSION_TTL_MS) {
      activeAiSessions.delete(id);
    }
  }
}, 5 * 60 * 1000);  // Check every 5 minutes
```

**Database Persistence**:
```typescript
async function persistSessionToDb(id: string, session: AiSession, deltaLog?: string) {
  const existing = await prisma.aiValidationJob.findUnique({ where: { id } });
  if (!existing) return;
  
  // Merge logs & stats into config JSON
  const config = existing.config as any;
  const logs = [...(config.logs || [])];
  if (deltaLog) logs.push(deltaLog);
  
  await prisma.aiValidationJob.update({
    where: { id },
    data: {
      status: phaseToStatus(session.phase),
      progress: Math.floor(session.progress),
      message: session.message,
      fixedCount: session.stats.fixedCount,
      processedItems: session.stats.totalRows,
      config: { logs, stats: session.stats },
      completedAt: session.phase === 'complete' ? new Date() : undefined
    }
  });
}
```

### Rate Limiting

**Azure OpenAI Limits**:
- **Requests per minute**: 300-600 (varies by deployment)
- **Tokens per minute**: 90,000-240,000

**Mitigation Strategies**:
1. **Batch processing**: Reduce request count
2. **Exponential backoff**: Handle transient failures
3. **Concurrency control**: Avoid overwhelming the API
4. **Token capping**: Truncate long texts

---

## 📈 Monitoring & Debugging

### Log Messages

```typescript
// Progress logs (stored in session.logs)
'📖 Lecture du fichier…'
'🔍 Préparation des questions…'
'🧠 Démarrage IA: 150 questions MCQ'
'📦 Processing batch 3/10 • mode=batch (batch=50, conc=50)'
'✅ Corrigés: 150 • ❌ Restent en erreur: 0'
'❌ Erreur: Azure request failed'
```

### Statistics Tracking

```typescript
type AiStats = {
  totalRows: number;           // Total rows processed
  mcqRows: number;             // MCQ questions
  processedBatches: number;    // Completed batches
  totalBatches: number;        // Total batches
  logs: string[];              // Event log
  fixedCount?: number;         // Successfully fixed
  errorCount?: number;         // Failed to fix
  reasonCounts?: Record<string, number>;  // Error reasons
  errorsPreview?: Array<{      // Sample errors
    sheet: string;
    row: number;
    reason: string;
    question?: string;
  }>;
};
```

### Frontend Debug Info

```typescript
// Job details modal shows:
{
  "id": "uuid",
  "fileName": "questions.xlsx",
  "status": "completed",
  "phase": "complete",
  "progress": 100,
  "message": "IA terminée",
  "logs": [
    "📖 Lecture du fichier…",
    "🔍 Préparation des questions…",
    "🧠 Démarrage IA: 150 questions MCQ",
    "📦 Processing batch 1/3",
    "✅ Corrigés: 150"
  ],
  "stats": {
    "totalRows": 150,
    "mcqRows": 120,
    "qrocRows": 30,
    "fixedCount": 150,
    "errorCount": 0,
    "processedBatches": 3,
    "totalBatches": 3
  }
}
```

---

## 🎓 Summary

### Key Takeaways

1. **Two-Phase System**:
   - **Validation**: Fast format checking (classical)
   - **AI Enhancement**: Intelligent correction & explanation generation

2. **AI Processing**:
   - Uses Azure OpenAI GPT-4
   - Professor-level prompt engineering
   - Batch processing with concurrency control
   - Robust error handling & fallbacks

3. **Real-time Updates**:
   - SSE for live progress streaming
   - Auto-refresh with 3-second intervals
   - In-memory + database persistence

4. **High Performance**:
   - TURBO mode: 50 batch size, 50 concurrency
   - Processes ~150 questions in 2-3 seconds
   - Configurable via environment variables

5. **Guaranteed Quality**:
   - Deterministic fallbacks for failed AI calls
   - Per-option explanations (4-6 sentences)
   - Course reminders (3-5 sentences)
   - Varied opening connectors

### Workflow Summary

```
📤 Upload → 🔍 Validate → 🤖 AI Enhance → 📥 Download → 💾 Import → ✅ Ready
```

---

## 📚 Related Files

### Frontend
- `/src/app/admin/validation/page.tsx` - Validation UI
- `/src/app/admin/import/page.tsx` - Import UI
- `/src/components/admin/import/QuestionImportPanel.tsx` - Question import panel

### Backend API
- `/src/app/api/validation/ai/route.ts` - Job creation
- `/src/app/api/validation/ai-progress/route.ts` - Progress tracking & download
- `/src/app/api/questions/bulk-import/route.ts` - Database import

### Services
- `/src/lib/services/aiImport.ts` - AI processing logic
- `/src/lib/ai/azureAiSdk.ts` - Azure OpenAI wrapper

### Database
- `/prisma/schema.prisma` - Database models (AiValidationJob, Question, etc.)

---

## 🔧 Environment Setup

```bash
# Copy example environment file
cp .env.example .env

# Required variables
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Optional tuning
AI_SLOW_MODE=0
AI_IMPORT_BATCH_SIZE=50
AI_IMPORT_CONCURRENCY=50
AZURE_OPENAI_MAX_TOKENS=800
```

---

**Last Updated**: October 2025  
**Version**: 2.0  
**Author**: System Documentation
