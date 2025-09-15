# Complete Admin System Architecture Documentation

## 🏗️ System Overview

This documentation covers the complete admin system architecture for the Medical Question Platform, including all validation and import functionalities with their interconnected components.

## 📁 Main Admin Pages

### 1. Admin Validation Page (`/admin/validation`)

**File**: `src/app/admin/validation/page.tsx`

**Core Features**:
- **Dual Validation System**: Classic validation + AI-powered validation
- **Real-time Job Management**: Live progress tracking with auto-refresh
- **Pagination System**: 4 jobs per page with navigation controls
- **Statistics Dashboard**: Total, completed, active, and failed jobs counters
- **Auto-refresh Logic**: Activates when active jobs detected (3-second intervals)

**Key Components Used**:
- `FilePreviewDialog`: Real-time progress preview with detailed job information
- `PersistentAiJob`: AI job creation and management interface
- Various UI components: Cards, Badges, Buttons, Progress bars

**Authentication & Authorization**:
```tsx
<ProtectedRoute requireAdmin>
  <AdminRoute>
    <AdminLayout>
```

### 2. Admin Import Page (`/admin/import`)

**File**: `src/app/admin/import/page.tsx`

**Import Modes**:
- **Session Import**: Bulk import of examination sessions from Excel/CSV
- **Question Import**: Multi-sheet question import (qcm, qroc, cas_qcm, cas_qroc)

**Key Components**:
- `SessionImportPanel`: Handles session data with specialty and niveau validation
- `QuestionImportPanel`: Complex multi-sheet question processing with progress tracking

## 🔗 API Architecture

### Validation APIs

#### 1. Classic Validation API
**Endpoint**: `/api/validation`
- **Method**: POST (file upload), GET (download results)
- **Purpose**: Traditional validation without AI assistance
- **Returns**: Separated good/bad records for download

#### 2. AI Validation API
**Endpoint**: `/api/validation/ai`
- **Method**: POST
- **Purpose**: Creates AI validation jobs for background processing
- **Process**: File upload → Job creation → Background processing → AI analysis

### AI Job Management APIs

#### 1. Job Listing API
**Endpoint**: `/api/ai-jobs`
- **Query Parameters**: 
  - `admin=true`: Admin view with all jobs
  - `status=active`: Filter by job status
  - `limit=50`: Pagination limit
- **Returns**: Job list with user information and statistics

#### 2. Job Details API
**Endpoint**: `/api/ai-jobs/[jobId]`
- **Methods**: GET (details), DELETE (remove job)
- **Purpose**: Individual job management

#### 3. Job Preview API
**Endpoint**: `/api/ai-jobs/[jobId]/preview`
- **Purpose**: Real-time progress and detailed job information
- **Returns**: Explanations preview, summary, progress info

#### 4. Job Download API
**Endpoint**: `/api/ai-jobs/[jobId]/download`
- **Purpose**: Download enhanced Excel files with AI explanations
- **Format**: Excel workbook with original data + AI-generated explanations

#### 5. Job Creation API
**Endpoint**: `/api/ai-jobs/create`
- **Purpose**: Programmatic job creation (alternative to validation/ai)

### Import APIs

#### 1. Session Import API
**Endpoint**: `/api/sessions` (bulk operations)
- **Purpose**: Import examination sessions from Excel/CSV
- **Validation**: Google Drive URL normalization, specialty/niveau matching

#### 2. Question Bulk Import APIs
**Endpoint**: `/api/questions/bulk-import`
- **Method**: POST
- **Purpose**: Multi-sheet question import with background processing

**Progress Tracking**: `/api/questions/bulk-import-progress`
- **Methods**: GET (status), POST (initiate), DELETE (cancel)
- **Features**: Real-time progress updates, import session management

## 🧩 Core Components

### Validation Components

#### 1. PersistentAiJob Component
**File**: `src/components/validation/PersistentAiJob.tsx`

**Features**:
- **File Upload Interface**: Drag-and-drop with MIME type validation
- **Custom Instructions**: Optional AI prompt customization
- **Real-time Polling**: Auto-updates for active jobs
- **Job Management**: View active, recent, and completed jobs
- **Download Integration**: Direct result file downloads

**Key Methods**:
```tsx
const createAiJob = async (file: File, instructions?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  if (instructions) formData.append('instructions', instructions);
  
  const response = await fetch('/api/validation/ai', {
    method: 'POST',
    body: formData,
  });
}
```

#### 2. FilePreviewDialog Component
**File**: `src/components/validation/FilePreviewDialog.tsx`

**Features**:
- **Real-time Progress**: Auto-refresh during job processing
- **Detailed Analytics**: Batch progress, item counts, processing stats
- **Explanation Preview**: Sample AI-generated explanations
- **Job Information**: Complete job metadata and timelines
- **Auto-refresh Logic**: 2-second intervals during processing

**Progress Tracking Interface**:
```tsx
interface PreviewData {
  explanations: Array<{
    id: string;
    sheet: string;
    rowNumber: number;
    questionText: string;
    optionExplanations: string[];
    hasAiAnalysis: boolean;
  }>;
  summary: {
    totalExplanations: number;
    validExplanations: number;
    questionsWithAI: number;
    questionsWithoutAI: number;
    warnings: string[];
  };
  progressInfo?: {
    progress: number;
    message: string;
    processedItems: number;
    totalItems: number;
    currentBatch: number;
    totalBatches: number;
    estimatedTimeRemaining: number;
    isProcessing: boolean;
    startTime: number;
    lastUpdateTime: number;
  };
}
```

### Import Components

#### 1. SessionImportPanel Component
**File**: `src/components/admin/import/SessionImportPanel.tsx`

**Features**:
- **Excel/CSV Processing**: XLSX library integration
- **Google Drive URL Normalization**: Automatic link conversion
- **Data Validation**: Specialty and niveau matching
- **Batch Processing**: Multiple session creation
- **Progress Feedback**: Real-time import status

**Data Structure**:
```tsx
type SessionRow = {
  name: string;
  pdfUrl?: string;
  correctionUrl?: string;
  niveau?: string;
  semestre?: string | number;
  specialty?: string;
};
```

#### 2. QuestionImportPanel Component
**File**: `src/components/admin/import/QuestionImportPanel.tsx`

**Features**:
- **Multi-sheet Processing**: Support for qcm, qroc, cas_qcm, cas_qroc sheets
- **Image URL Extraction**: Automatic media detection and processing
- **Progress Tracking**: Background import session management
- **Automatic Entity Creation**: Specialties, courses, and clinical cases
- **Error Handling**: Comprehensive validation and error reporting

**Sheet Processing**:
```tsx
const SUPPORTED_SHEETS = ['qcm', 'qroc', 'cas_qcm', 'cas_qroc'];
const MAX_FILE_SIZE_MB = 8;
const PREVIEW_LIMIT = 10;
```

## 🗄️ Database Schema

### AiValidationJob Model
```prisma
model AiValidationJob {
  id            String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId        String      @map("user_id") @db.Uuid
  status        AiJobStatus @default(queued)
  fileName      String      @map("file_name")
  fileSize      Int         @map("file_size")
  totalItems    Int         @map("total_items")
  processedItems Int        @default(0) @map("processed_items")
  progress      Float       @default(0) // 0-100
  message       String?     // current status message
  
  // Job configuration
  config        Json?       // batch size, concurrency, etc
  
  // Results and output
  resultData    Json?       @map("result_data") // final processed results
  outputUrl     String?     @map("output_url") // download URL for result file
  errorMessage  String?     @map("error_message")
  
  // Stats and telemetry
  stats         Json?       // detailed processing stats
  ragAppliedCount Int?      @default(0) @map("rag_applied_count")
  
  // Timestamps
  startedAt     DateTime?   @map("started_at") @db.Timestamptz(6)
  completedAt   DateTime?   @map("completed_at") @db.Timestamptz(6)
  createdAt     DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime    @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId], map: "idx_ai_job_user")
  @@index([status], map: "idx_ai_job_status")
  @@index([createdAt], map: "idx_ai_job_created")
  @@map("ai_validation_jobs")
}

enum AiJobStatus {
  queued
  processing
  completed
  failed
  cancelled
}
```

## 🔧 Background Services

### Job Manager Service
**File**: `src/lib/services/jobManager.ts`

**Features**:
- **Singleton Pattern**: Ensures single processor instance
- **Auto-start**: Automatic initialization on application start
- **Job Queue Management**: FIFO processing with priority support

### AI Job Processor Service
**File**: `src/lib/services/aiJobProcessor.ts`

**Features**:
- **Continuous Processing**: Background job execution loop
- **Error Recovery**: Automatic retry mechanisms
- **Progress Tracking**: Real-time status updates
- **Batch Processing**: Configurable concurrency and batch sizes

### AI Import Service
**File**: `src/lib/services/aiImport.ts`

**Features**:
- **Azure OpenAI Integration**: GPT-4 model for medical explanations
- **Medical Expert Prompts**: Specialized prompts for medical accuracy
- **Batch Processing**: Efficient API usage with controlled concurrency
- **Quality Validation**: Response validation and error handling

## 🔀 Data Flow Diagrams

### AI Validation Flow
```
User Upload File
     ↓
Frontend (PersistentAiJob)
     ↓
API (/api/validation/ai)
     ↓
Database (AiValidationJob created)
     ↓
Background Processor (aiJobProcessor)
     ↓
AI Service (aiImport + Azure OpenAI)
     ↓
Enhanced Excel Generation
     ↓
Result Storage & Download
```

### Question Import Flow
```
User Upload Multi-sheet Excel
     ↓
Frontend (QuestionImportPanel)
     ↓
API (/api/questions/bulk-import)
     ↓
Background Import Session
     ↓
Sheet Processing (qcm, qroc, cas_qcm, cas_qroc)
     ↓
Entity Creation (Specialties, Lectures, Cases)
     ↓
Progress Updates (/api/questions/bulk-import-progress)
     ↓
Database Storage
```

### Session Import Flow
```
User Upload Session Data
     ↓
Frontend (SessionImportPanel)
     ↓
Excel/CSV Processing (client-side)
     ↓
Data Validation & Normalization
     ↓
API (/api/sessions bulk operations)
     ↓
Database Storage
```

## 🛡️ Security & Permissions

### Authentication Layers
1. **ProtectedRoute**: Ensures user authentication
2. **AdminRoute**: Requires admin or maintainer role
3. **API Middleware**: Server-side permission validation

### File Upload Security
- **MIME Type Validation**: Only Excel files accepted
- **File Size Limits**: 8MB maximum for imports
- **Content Validation**: Excel structure verification

## 📊 Monitoring & Analytics

### Job Statistics
- Total jobs created
- Success/failure rates
- Average processing times
- Resource utilization metrics

### Import Statistics
- Questions imported per session
- Success rates by sheet type
- Processing speed metrics
- Error patterns and frequencies

### Real-time Updates
- WebSocket-like polling for live updates
- Auto-refresh mechanisms
- Progress percentage tracking
- Estimated completion times

## 🔮 Advanced Features

### Custom AI Instructions
Users can provide custom prompts to influence AI explanation generation:
```tsx
const customInstructions = `
Focus on cardiology-specific explanations.
Include ECG interpretation details.
Mention latest ESC guidelines when relevant.
`;
```

### Import Session Management
Background import sessions persist across page refreshes and browser closes:
```tsx
interface ImportSession {
  importId: string;
  progress: number;
  phase: 'importing' | 'processing' | 'complete' | 'error';
  message: string;
  logs: string[];
  lastUpdated: number;
  createdAt: number;
  cancelled?: boolean;
}
```

### Batch Processing Configuration
```tsx
interface JobConfig {
  batchSize: number;        // Default: 50 questions per batch
  concurrency: number;      // Default: 4 concurrent requests
  systemPrompt?: string;    // Custom AI instructions
  timeout: number;          // Request timeout in ms
}
```

## 🚀 Performance Optimizations

### Frontend Optimizations
- Conditional auto-refresh (only when jobs are active)
- Pagination to limit DOM elements
- Efficient state management
- Lazy loading of preview data

### Backend Optimizations
- Database indexing on frequently queried fields
- Batch processing for AI requests
- Connection pooling
- Caching strategies for frequently accessed data

### AI Processing Optimizations
- Concurrent batch processing
- Request retry mechanisms with exponential backoff
- Token usage optimization
- Response caching for similar questions

This comprehensive architecture ensures a robust, scalable, and user-friendly admin system for medical question validation and import operations.