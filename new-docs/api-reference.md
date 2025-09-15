# API Reference Documentation

## 🌐 Overview

This document provides comprehensive API documentation for the Medical Question Platform's admin features, covering all endpoints for validation, import, and job management.

## 🔐 Authentication

All admin API endpoints require authentication with admin privileges.

### Headers
```typescript
Authorization: Bearer <token>
Content-Type: application/json | multipart/form-data
```

### Authentication Middleware
```typescript
// All admin routes are protected
import { requireMaintainerOrAdmin } from '@/lib/auth-middleware';

export const POST = requireMaintainerOrAdmin(async (request) => {
  // Protected endpoint logic
});
```

## 🔍 AI Jobs Management API

### Base URL: `/api/ai-jobs`

#### 1. Get All Jobs
**Endpoint**: `GET /api/ai-jobs`

**Query Parameters**:
- `admin` (boolean): Include admin view data
- `limit` (number): Maximum number of jobs to return (default: 10)
- `status` (string): Filter by status ('active', 'completed', 'failed')

**Request Example**:
```typescript
GET /api/ai-jobs?admin=true&limit=50&status=active
```

**Response**:
```typescript
{
  jobs: Array<{
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    fileName: string;
    fileSize: number;
    totalItems: number;
    processedItems: number;
    progress: number;
    message: string;
    outputUrl?: string;
    errorMessage?: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    user?: {
      name?: string;
      email?: string;
    };
  }>;
  total: number;
}
```

---

#### 2. Get Job Details
**Endpoint**: `GET /api/ai-jobs/[jobId]`

**Path Parameters**:
- `jobId` (string): Unique job identifier

**Response**:
```typescript
{
  id: string;
  status: string;
  fileName: string;
  fileSize: number;
  totalItems: number;
  processedItems: number;
  progress: number;
  message: string;
  outputUrl?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  userId: string;
}
```

---

#### 3. Get Job Preview with Progress
**Endpoint**: `GET /api/ai-jobs/[jobId]/preview`

**Path Parameters**:
- `jobId` (string): Unique job identifier

**Response**:
```typescript
{
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
  jobInfo: {
    fileName: string;
    completedAt: string | null;
    completedBy: string | null;
    status: string;
  };
  progressInfo?: {
    // Basic progress
    progress: number;
    message: string;

    // Items progress
    processedItems: number;
    totalItems: number;

    // Batch information
    currentBatch: number;
    totalBatches: number;

    // Timing information
    startedAt: string | null;
    completedAt?: string | null;
    elapsedSeconds: number;
    estimatedSecondsRemaining: number;

    // Processing stats
    processingSpeed: number; // items per second

    // Detailed stats from AI processor
    aiStats: {
      fixedCount: number;
      ragAppliedCount: number;
      successfulAnalyses: number;
      failedAnalyses: number;
      retryAttempts: number;
    };

    // File information
    fileSize: number;

    // Configuration
    config: any;

    // Status information
    isCompleted: boolean;
    isProcessing: boolean;
    isFailed: boolean;
    errorMessage: string | null;
  };
}
```

---

#### 4. Download Job Result
**Endpoint**: `GET /api/ai-jobs/[jobId]/download`

**Path Parameters**:
- `jobId` (string): Unique job identifier

**Response**: 
- **Content-Type**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Content-Disposition**: `attachment; filename="validated_[original_filename]"`
- **Body**: Excel file stream

---

#### 5. Delete Job
**Endpoint**: `DELETE /api/ai-jobs/[jobId]`

**Path Parameters**:
- `jobId` (string): Unique job identifier

**Response**:
```typescript
{
  message: string;
}
```

**Error Responses**:
```typescript
// 404 Not Found
{
  error: "Job not found"
}

// 403 Forbidden
{
  error: "Not authorized to delete this job"
}
```

---

#### 6. Create Validation Job
**Endpoint**: `POST /api/ai-jobs/create`

**Request Body** (multipart/form-data):
- `file` (File): Excel file to validate
- `instructions` (string, optional): Custom validation instructions

**Response**:
```typescript
{
  message: string;
  jobId: string;
}
```

**Example**:
```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('instructions', 'Focus on medical accuracy');

const response = await fetch('/api/ai-jobs/create', {
  method: 'POST',
  body: formData,
});
```

## ✅ Validation API

### Base URL: `/api/validation`

#### 1. AI Validation
**Endpoint**: `POST /api/validation/ai`

**Request Body** (multipart/form-data):
- `file` (File): Excel file with medical questions
- `instructions` (string, optional): Custom validation instructions

**Supported File Formats**:
- Excel (.xlsx, .xls)
- Multi-sheet workbooks
- Sheets: `qcm`, `qroc`, `cas_qcm`, `cas_qroc`, `Erreurs`

**Response**:
```typescript
{
  message: string;
  jobId: string;
  estimatedDuration?: number;
}
```

**Error Responses**:
```typescript
// 400 Bad Request
{
  error: "file required" | "No rows found in file" | "AI not configured"
}

// 401 Unauthorized
{
  error: "Authentication required"
}

// 500 Internal Server Error
{
  error: "Validation failed"
}
```

---

#### 2. Validation Progress
**Endpoint**: `GET /api/validation/ai-progress`

**Query Parameters**:
- `jobId` (string): Job identifier to track

**Response**:
```typescript
{
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  processedItems: number;
  totalItems: number;
  estimatedTimeRemaining?: number; // seconds
  errors?: string[];
}
```

## 📚 Questions Import API

### Base URL: `/api/questions`

#### 1. Bulk Import
**Endpoint**: `POST /api/questions/bulk-import`

**Request Body** (multipart/form-data):
- `file` (File): Excel workbook with questions

**Required Excel Format**:
```typescript
// Sheet names (case-insensitive, accent-insensitive)
'qcm' | 'qroc' | 'cas_qcm' | 'cas_qroc'

// Required columns for QCM sheets:
{
  'texte de la question': string;
  'option 1': string;
  'option 2': string;
  'option 3': string;
  'option 4': string;
  'option 5': string;
  'bonne reponse': 'A' | 'B' | 'C' | 'D' | 'E';
  'explication': string;
  'specialite': string;
  'niveau': string;
  'semestre': string;
  'cours'?: string; // optional
  'cas'?: string; // optional for cas_* sheets
}

// Required columns for QROC sheets:
{
  'texte de la question': string;
  'reponse': string;
  'explication': string;
  'specialite': string;
  'niveau': string;
  'semestre': string;
  'cours'?: string; // optional
  'cas'?: string; // optional for cas_* sheets
}
```

**Response**:
```typescript
{
  message: string;
  importId: string;
}
```

---

#### 2. Import Progress
**Endpoint**: `GET /api/questions/bulk-import-progress`

**Query Parameters**:
- `id` (string): Import identifier

**Response**:
```typescript
{
  id: string;
  status: 'parsing' | 'importing' | 'completed' | 'failed';
  progress: number; // 0-100
  total: number;
  processed: number;
  errors: string[];
  warnings: string[];
  currentSheet?: string;
  currentRow?: number;
  statistics?: {
    questionsCreated: number;
    specialtiesCreated: number;
    coursesCreated: number;
    casesCreated: number;
  };
}
```

---

#### 3. Single Question Import
**Endpoint**: `POST /api/questions/import`

**Request Body**:
```typescript
{
  sheet: 'qcm' | 'qroc' | 'cas_qcm' | 'cas_qroc';
  questionData: {
    texteQuestion: string;
    // For QCM questions
    option1?: string;
    option2?: string;
    option3?: string;
    option4?: string;
    option5?: string;
    bonneReponse?: 'A' | 'B' | 'C' | 'D' | 'E';
    // For QROC questions
    reponse?: string;
    // Common fields
    explication: string;
    specialite: string;
    cours?: string;
    cas?: string;
    niveau: string;
    semestre: string;
  };
}
```

**Response**:
```typescript
{
  success: boolean;
  questionId?: string;
  message: string;
  warnings?: string[];
}
```

---

#### 4. Get Questions
**Endpoint**: `GET /api/questions`

**Query Parameters**:
- `specialty` (string): Filter by specialty
- `level` (string): Filter by academic level
- `semester` (string): Filter by semester
- `type` (string): Filter by question type
- `limit` (number): Maximum results (default: 50)
- `offset` (number): Pagination offset (default: 0)

**Response**:
```typescript
{
  questions: Array<{
    id: string;
    type: 'qcm' | 'qroc' | 'cas_qcm' | 'cas_qroc';
    questionText: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    optionE?: string;
    correctAnswer?: string;
    answer?: string;
    explanation: string;
    specialty: {
      id: string;
      name: string;
    };
    course?: {
      id: string;
      name: string;
    };
    clinicalCase?: {
      id: string;
      title: string;
    };
    level: string;
    semester: string;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}
```

---

#### 5. Update Question
**Endpoint**: `PUT /api/questions/[questionId]`

**Path Parameters**:
- `questionId` (string): Question identifier

**Request Body**:
```typescript
{
  questionText?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  optionE?: string;
  correctAnswer?: string;
  answer?: string;
  explanation?: string;
  specialtyId?: string;
  courseId?: string;
  clinicalCaseId?: string;
  level?: string;
  semester?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
  question?: object;
}
```

---

#### 6. Delete Question
**Endpoint**: `DELETE /api/questions/[questionId]`

**Path Parameters**:
- `questionId` (string): Question identifier

**Response**:
```typescript
{
  success: boolean;
  message: string;
}
```

## 📊 Admin Statistics API

### Base URL: `/api/admin`

#### 1. System Statistics
**Endpoint**: `GET /api/admin/stats`

**Response**:
```typescript
{
  jobs: {
    total: number;
    active: number;
    completed: number;
    failed: number;
  };
  questions: {
    total: number;
    byType: {
      qcm: number;
      qroc: number;
      cas_qcm: number;
      cas_qroc: number;
    };
  };
  users: {
    total: number;
    active: number;
    admins: number;
  };
  specialties: {
    total: number;
    withQuestions: number;
  };
  courses: {
    total: number;
    withQuestions: number;
  };
  imports: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}
```

---

#### 2. User Management
**Endpoint**: `GET /api/admin/users`

**Query Parameters**:
- `role` (string): Filter by role ('admin', 'maintainer', 'user')
- `active` (boolean): Filter by active status
- `limit` (number): Maximum results (default: 50)
- `offset` (number): Pagination offset

**Response**:
```typescript
{
  users: Array<{
    id: string;
    email: string;
    name?: string;
    role: 'admin' | 'maintainer' | 'user';
    isActive: boolean;
    lastLoginAt?: string;
    createdAt: string;
    statistics: {
      questionsAnswered: number;
      sessionsCompleted: number;
      averageScore: number;
    };
  }>;
  total: number;
  pagination: object;
}
```

## 🔗 Specialties & Courses API

### Base URL: `/api/specialties`

#### 1. Get Specialties
**Endpoint**: `GET /api/specialties`

**Query Parameters**:
- `withQuestions` (boolean): Include question counts
- `level` (string): Filter by academic level

**Response**:
```typescript
{
  specialties: Array<{
    id: string;
    name: string;
    questionCount?: number;
    courses?: Array<{
      id: string;
      name: string;
      questionCount?: number;
    }>;
  }>;
}
```

---

#### 2. Create Specialty
**Endpoint**: `POST /api/specialties`

**Request Body**:
```typescript
{
  name: string;
  description?: string;
  level?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  specialty?: object;
  message: string;
}
```

## 🚨 Error Handling

### Standard Error Format
```typescript
{
  error: string;
  details?: string;
  code?: string;
  timestamp: string;
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `422` - Unprocessable Entity (business logic errors)
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error

### Common Error Scenarios

#### Authentication Errors
```typescript
// 401 Unauthorized
{
  error: "Authentication required",
  code: "AUTH_REQUIRED"
}

// 403 Forbidden
{
  error: "Admin privileges required",
  code: "INSUFFICIENT_PERMISSIONS"
}
```

#### Validation Errors
```typescript
// 400 Bad Request
{
  error: "Validation failed",
  details: "Field 'questionText' is required",
  code: "VALIDATION_ERROR"
}
```

#### File Processing Errors
```typescript
// 422 Unprocessable Entity
{
  error: "Invalid file format",
  details: "Excel file must contain at least one valid sheet",
  code: "INVALID_FILE_FORMAT"
}
```

#### Rate Limiting
```typescript
// 429 Too Many Requests
{
  error: "Rate limit exceeded",
  details: "Maximum 10 imports per hour",
  code: "RATE_LIMIT_EXCEEDED",
  retryAfter: 3600
}
```

## 📡 WebSocket Events (Optional)

### Connection
```typescript
const ws = new WebSocket('ws://localhost:3000/api/ws');
```

### Events
```typescript
// Job progress updates
{
  type: 'job_progress',
  jobId: string,
  progress: number,
  status: string
}

// Import progress updates
{
  type: 'import_progress',
  importId: string,
  processed: number,
  total: number,
  currentSheet: string
}

// System notifications
{
  type: 'system_notification',
  message: string,
  level: 'info' | 'warning' | 'error'
}
```

## 🧪 Testing Examples

### Authentication Test
```typescript
// Test admin authentication
const response = await fetch('/api/admin/stats', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

expect(response.status).toBe(200);
```

### File Upload Test
```typescript
// Test file validation
const formData = new FormData();
formData.append('file', testFile);

const response = await fetch('/api/validation/ai', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  },
  body: formData
});

expect(response.status).toBe(200);
const result = await response.json();
expect(result.jobId).toBeDefined();
```

### Progress Polling Test
```typescript
// Test progress tracking
const jobId = 'test-job-id';
const response = await fetch(`/api/ai-jobs/${jobId}/preview`);
const data = await response.json();

expect(data.progressInfo).toBeDefined();
expect(data.progressInfo.progress).toBeGreaterThanOrEqual(0);
expect(data.progressInfo.progress).toBeLessThanOrEqual(100);
```

This API documentation provides complete reference for implementing and integrating with the Medical Question Platform's admin features.