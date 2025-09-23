# Admin Validation System Documentation

## 🎯 Overview

The Admin Validation System (`/admin/validation`) is a comprehensive AI-powered platform for validating and correcting medical questions. It provides real-time progress tracking, batch processing, and detailed analytics.

## 🏗️ System Architecture

### Frontend Components
```
/admin/validation
├── AdminValidationPage (main page)
├── FilePreviewDialog (progress tracking)
├── PersistentAiJob (job status)
└── Pagination controls
```

### Backend Services
```
API Routes:
├── /api/ai-jobs/* (job management)
├── /api/validation/* (validation processing)
└── Background job processor
```

## 📱 User Interface

### Main Dashboard
The validation page displays three main sections:

1. **📊 Statistiques Générales** - System statistics
2. **🔄 Validation Instantanée** - Single file validation
3. **🗂️ Gestion des Jobs IA** - Job management table

### Key Features
- **Real-time Auto-refresh**: Updates every 3 seconds when jobs are active
- **Pagination**: 4 jobs per page maximum with navigation controls
- **Progress Tracking**: Detailed progress information with ETA calculations
- **File Download**: Download validated files after completion

## 🛠️ Implementation

### 1. Page Structure (`/src/app/admin/validation/page.tsx`)

```tsx
"use client";

import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
// ... other imports

interface AiJob {
  id: string;
  fileName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  processedItems?: number;
  totalItems?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  user?: {
    name?: string;
    email?: string;
  };
}

export default function AdminValidationPage() {
  // State management
  const [file, setFile] = useState<File | null>(null);
  const [allJobs, setAllJobs] = useState<AiJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [previewJob, setPreviewJob] = useState<AiJob | null>(null);
  const [statsData, setStatsData] = useState({
    totalJobs: 0,
    completedJobs: 0,
    activeJobs: 0,
    failedJobs: 0
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // ... component implementation
}
```

### 2. Auto-refresh System

```tsx
// Auto-refresh when there are active jobs
useEffect(() => {
  let interval: NodeJS.Timeout | null = null;

  // Only auto-refresh if there are active jobs (processing or queued)
  if (statsData.activeJobs > 0) {
    console.log(`🔄 Auto-refresh activated: ${statsData.activeJobs} active jobs`);
    interval = setInterval(() => {
      console.log('🔄 Auto-refreshing jobs...');
      fetchAllJobs(true); // Silent refresh
    }, 3000); // Refresh every 3 seconds when there are active jobs
  } else {
    console.log('⏸️ Auto-refresh paused: no active jobs');
  }

  return () => {
    if (interval) {
      clearInterval(interval);
      console.log('🛑 Auto-refresh stopped');
    }
  };
}, [statsData.activeJobs]); // Re-run when active jobs count changes
```

### 3. Job Management Table

```tsx
{/* Enhanced Table Headers */}
<div className="bg-gradient-to-r from-gray-100 via-blue-100 to-gray-100 border rounded-t-lg">
  <div className="grid grid-cols-12 gap-4 p-4 text-sm font-bold text-gray-800">
    <div className="col-span-2">📄 Fichier</div>
    <div className="col-span-1">🎯 Statut</div>
    <div className="col-span-2">👤 Utilisateur</div>
    <div className="col-span-2">📅 Créé le</div>
    <div className="col-span-2">⏰ Terminé le</div>
    <div className="col-span-1">📊 Progrès</div>
    <div className="col-span-2">⚡ Actions</div>
  </div>
</div>

{/* Paginated Jobs List */}
{(() => {
  const totalPages = Math.ceil(allJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = allJobs.slice(startIndex, endIndex);

  return (
    <>
      {paginatedJobs.map((job, index) => (
        <div key={job.id} className="grid grid-cols-12 gap-4 p-4 border-b">
          {/* Job details */}
        </div>
      ))}
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3 w-3" />
              Précédent
            </Button>
            
            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <Button
                key={page}
                size="sm"
                variant={currentPage === page ? "default" : "outline"}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Suivant
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="text-sm text-gray-600">
            Page {currentPage} sur {totalPages} • {allJobs.length} jobs au total
          </div>
        </div>
      )}
    </>
  );
})()}
```

### 4. File Upload and Validation

```tsx
const handleFileValidation = async () => {
  if (!file) return;

  setLoading(true);
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/validation/ai', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      // Handle success
      await fetchAllJobs(); // Refresh jobs list
    } else {
      // Handle error
    }
  } catch (error) {
    console.error('Validation error:', error);
  } finally {
    setLoading(false);
  }
};
```

## 🔧 API Integration

### Key API Endpoints

#### 1. Get All Jobs
```typescript
GET /api/ai-jobs?admin=true&limit=50

Response:
{
  jobs: AiJob[],
  total: number
}
```

#### 2. Job Details with Progress
```typescript
GET /api/ai-jobs/[jobId]/preview

Response:
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
  progressInfo: {
    progress: number;
    message: string;
    processedItems: number;
    totalItems: number;
    currentBatch: number;
    totalBatches: number;
    startedAt: string | null;
    elapsedSeconds: number;
    estimatedSecondsRemaining: number;
    processingSpeed: number;
    aiStats: {
      fixedCount: number;
      successfulAnalyses: number;
      failedAnalyses: number;
      retryAttempts: number;
    };
  };
}
```

#### 3. Start Validation Job
```typescript
POST /api/validation/ai

Body: FormData with 'file' and optional 'instructions'

Response:
{
  message: string;
  jobId: string;
}
```

#### 4. Download Validated File
```typescript
GET /api/ai-jobs/[jobId]/download

Response: File download stream
```

#### 5. Delete Job
```typescript
DELETE /api/ai-jobs/[jobId]

Response:
{
  message: string;
}
```

## 📊 Progress Tracking Component

### FilePreviewDialog (`/src/components/validation/FilePreviewDialog.tsx`)

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
    startedAt: string | null;
    completedAt?: string | null;
    elapsedSeconds: number;
    estimatedSecondsRemaining: number;
    processingSpeed: number;
    aiStats: {
      fixedCount: number;
      successfulAnalyses: number;
      failedAnalyses: number;
      retryAttempts: number;
    };
    fileSize: number;
    isCompleted: boolean;
    isProcessing: boolean;
    isFailed: boolean;
    errorMessage: string | null;
  };
}

export default function FilePreviewDialog({
  isOpen,
  onClose,
  jobId,
  fileName,
  status
}: FilePreviewDialogProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto-refresh logic for active jobs
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

  // ... component implementation
}
```

## 🎨 UI Components

### Status Badge Colors
```tsx
const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'processing':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'queued':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};
```

### Progress Bar Component
```tsx
{progressInfo && progressInfo.isProcessing && (
  <div className="space-y-3">
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">Progression générale</span>
      <span className="text-blue-600 font-bold">{progressInfo.progress}%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className="bg-gradient-to-r from-blue-500 to-green-500 h-2.5 rounded-full transition-all duration-300"
        style={{ width: `${progressInfo.progress}%` }}
      />
    </div>
    <div className="text-xs text-gray-600">
      {progressInfo.message}
    </div>
  </div>
)}
```

## 🔒 Security & Permissions

### Authentication Requirements
```tsx
<ProtectedRoute requireAdmin>
  <AdminRoute>
    <AdminLayout>
      {/* Admin validation content */}
    </AdminLayout>
  </AdminRoute>
</ProtectedRoute>
```

### API Security
- All endpoints require admin authentication
- File validation checks for proper Excel/CSV format
- Input sanitization on all user data
- Rate limiting on validation requests

## 📈 Performance Considerations

### Optimization Features
- **Pagination**: Limits displayed jobs to 4 per page
- **Silent Refresh**: Background updates without UI blocking
- **Conditional Auto-refresh**: Only active when jobs are processing
- **Batch Processing**: AI validation in configurable batch sizes
- **Progress Caching**: Stores progress data to avoid repeated calculations

### Monitoring
- Real-time progress tracking
- Processing speed calculations
- ETA estimations
- Error rate monitoring
- Batch completion statistics

## 🚀 Deployment Notes

### Environment Variables
```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

# Database
DATABASE_URL=postgresql://...

# File Storage
STORAGE_PATH=/path/to/storage
```

### Background Job Processing
The system uses a background job manager that:
- Processes validation jobs in queue order
- Handles batch processing for large files
- Provides real-time progress updates
- Manages error recovery and retries
- Stores processing results and metadata

This comprehensive validation system provides a robust, user-friendly interface for managing AI-powered medical question validation with real-time progress tracking and efficient job management.

## 📥 Export compatible avec l'import

Depuis cette mise à jour, quand vous téléchargez le fichier des « Valides » dans la page Admin → Validation, le fichier Excel généré est directement prêt pour l'import:

- 4 onglets canoniques: `qcm`, `qroc`, `cas_qcm`, `cas_qroc`
- En-têtes strictement identiques à ceux attendus par l'import:
  - `matiere`, `cours`, `question n`, `cas n`, `texte du cas`, `texte de la question`,
  - `reponse`, `option a`, `option b`, `option c`, `option d`, `option e`,
  - `rappel`, `explication`, `explication a`, `explication b`, `explication c`, `explication d`, `explication e`,
  - `image`, `niveau`, `semestre`
- Les onglets vides ne sont pas créés (l'import les accepte absents)

Le fichier « Erreurs » reste en un seul onglet `Erreurs` à visée diagnostique et n'est pas destiné à l'import direct.