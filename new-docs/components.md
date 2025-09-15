# Components Documentation

## 🧩 Overview

This document provides comprehensive documentation for all React components used in the Medical Question Platform's admin validation and import systems. Each component is documented with props, usage examples, and implementation details.

## 🔍 Admin Validation Components

### AdminValidationPage

**Location**: `/src/app/admin/validation/page.tsx`

**Purpose**: Main page component for AI validation system with real-time progress tracking and job management.

**Features**:
- Real-time auto-refresh for active jobs
- Paginated job management table
- File upload and validation
- Statistics dashboard
- Progress monitoring

**Props**: None (Page component)

**State Management**:
```tsx
interface State {
  file: File | null;
  good: any[];
  bad: any[];
  loading: boolean;
  allJobs: AiJob[];
  jobsLoading: boolean;
  previewJob: AiJob | null;
  statsData: {
    totalJobs: number;
    completedJobs: number;
    activeJobs: number;
    failedJobs: number;
  };
  lastUpdated: Date | null;
  currentPage: number;
  itemsPerPage: number; // Fixed at 4
}
```

**Key Functions**:
```tsx
// Auto-refresh jobs when active jobs are present
const fetchAllJobs = async (silent = false) => {
  // Implementation for fetching all jobs with optional silent mode
};

// Handle file validation
const handleFileValidation = async () => {
  // Implementation for starting AI validation job
};

// Delete job with confirmation
const deleteJob = async (jobId: string) => {
  // Implementation for job deletion
};

// Download validated file
const downloadResult = async (jobId: string, fileName: string) => {
  // Implementation for file download
};
```

**Usage Example**:
```tsx
// Protected route with admin access
<ProtectedRoute requireAdmin>
  <AdminRoute>
    <AdminLayout>
      <AdminValidationPage />
    </AdminLayout>
  </AdminRoute>
</ProtectedRoute>
```

---

### FilePreviewDialog

**Location**: `/src/components/validation/FilePreviewDialog.tsx`

**Purpose**: Modal dialog displaying detailed job progress, validation results, and real-time updates.

**Props**:
```tsx
interface FilePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  fileName: string;
  status: string;
}
```

**Features**:
- Real-time progress updates with auto-refresh
- Detailed batch processing information
- AI statistics and performance metrics
- Error and warning displays
- Download functionality for completed jobs

**State Management**:
```tsx
interface State {
  preview: PreviewData | null;
  loading: boolean;
  autoRefresh: boolean;
}

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
    elapsedSeconds: number;
    estimatedSecondsRemaining: number;
    processingSpeed: number;
    aiStats: {
      fixedCount: number;
      ragAppliedCount: number;
      successfulAnalyses: number;
      failedAnalyses: number;
      retryAttempts: number;
    };
    isCompleted: boolean;
    isProcessing: boolean;
    isFailed: boolean;
    errorMessage: string | null;
  };
}
```

**Auto-Refresh Logic**:
```tsx
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
```

**Usage Example**:
```tsx
<FilePreviewDialog
  isOpen={!!previewJob}
  onClose={() => setPreviewJob(null)}
  jobId={previewJob?.id || ''}
  fileName={previewJob?.fileName || ''}
  status={previewJob?.status || ''}
/>
```

---

### PersistentAiJob

**Location**: `/src/components/validation/PersistentAiJob.tsx`

**Purpose**: Compact job status component for displaying individual job information in the management table.

**Props**:
```tsx
interface PersistentAiJobProps {
  job: AiJob;
  onPreview: (job: AiJob) => void;
  onDownload: (jobId: string, fileName: string) => void;
  onDelete: (jobId: string) => void;
}
```

**Features**:
- Status badge with color coding
- Action buttons for preview, download, delete
- Responsive design for table display
- Hover effects and animations

**Usage Example**:
```tsx
<PersistentAiJob
  job={job}
  onPreview={setPreviewJob}
  onDownload={downloadResult}
  onDelete={deleteJob}
/>
```

## 📥 Admin Import Components

### ImportPage

**Location**: `/src/app/admin/import/page.tsx`

**Purpose**: Main import page with mode selection and routing between session and question imports.

**Props**: None (Page component)

**State Management**:
```tsx
interface State {
  mode: 'choose' | 'sessions' | 'questions';
  initialImportId: string | null;
}
```

**Features**:
- Mode selection interface
- URL parameter handling for direct navigation
- Responsive card-based layout
- Navigation breadcrumbs

**Usage Example**:
```tsx
<ProtectedRoute requireAdmin>
  <AdminRoute>
    <AdminLayout>
      <ImportPage />
    </AdminLayout>
  </AdminRoute>
</ProtectedRoute>
```

---

### QuestionImportPanel

**Location**: `/src/components/admin/import/QuestionImportPanel.tsx`

**Purpose**: Comprehensive question import interface with file upload, progress tracking, and error handling.

**Props**:
```tsx
interface QuestionImportPanelProps {
  initialImportId?: string;
}
```

**Features**:
- Drag-and-drop file upload
- Real-time import progress tracking
- Error and warning display
- Multi-sheet Excel processing
- Import statistics

**State Management**:
```tsx
interface State {
  file: File | null;
  importing: boolean;
  progress: ImportProgress | null;
}

interface ImportProgress {
  id: string;
  status: 'parsing' | 'importing' | 'completed' | 'failed';
  progress: number;
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

**File Upload Handler**:
```tsx
const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
  const selectedFile = event.target.files?.[0];
  if (selectedFile) {
    // Validate file type and size
    validateExcelFile(selectedFile);
    setFile(selectedFile);
    setProgress(null);
  }
};
```

**Import Process**:
```tsx
const startImport = async () => {
  if (!file) return;

  setImporting(true);
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/questions/bulk-import', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      setProgress({
        id: result.importId,
        status: 'parsing',
        progress: 0,
        total: 0,
        processed: 0,
        errors: [],
        warnings: []
      });
      
      // Start polling for progress
      pollProgress(result.importId);
    }
  } catch (error) {
    console.error('Import error:', error);
    setImporting(false);
  }
};
```

**Progress Polling**:
```tsx
const pollProgress = async (importId: string) => {
  const interval = setInterval(async () => {
    try {
      const response = await fetch(`/api/questions/bulk-import-progress?id=${importId}`);
      if (response.ok) {
        const progressData = await response.json();
        setProgress(progressData);

        if (progressData.status === 'completed' || progressData.status === 'failed') {
          clearInterval(interval);
          setImporting(false);
        }
      }
    } catch (error) {
      console.error('Progress polling error:', error);
      clearInterval(interval);
      setImporting(false);
    }
  }, 1000); // Poll every second

  return () => clearInterval(interval);
};
```

**Usage Example**:
```tsx
<QuestionImportPanel initialImportId={initialImportId} />
```

---

### SessionImportPanel

**Location**: `/src/components/admin/import/SessionImportPanel.tsx`

**Purpose**: Interface for importing exam sessions from CSV/Excel files.

**Props**: None

**Features**:
- CSV/Excel file upload
- Session data validation
- Batch processing
- Error handling and reporting

**Required CSV Format**:
```typescript
interface SessionData {
  name: string;
  pdfUrl: string;
  correctionUrl: string;
  niveau: string;
  semestre: string;
  specialty: string;
}
```

**Usage Example**:
```tsx
<SessionImportPanel />
```

## 🎨 UI Components

### Progress Components

#### Progress Bar
```tsx
interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  className = '',
  showPercentage = true,
  variant = 'default'
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {showPercentage && (
        <div className="flex justify-between text-sm mb-1">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getVariantClasses()}`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
};
```

#### Status Badge
```tsx
interface StatusBadgeProps {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  size?: 'sm' | 'md' | 'lg';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getStatusClasses = () => {
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

  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'px-2 py-1 text-xs';
      case 'lg': return 'px-4 py-2 text-base';
      default: return 'px-3 py-1 text-sm';
    }
  };

  return (
    <Badge className={`${getStatusClasses()} ${getSizeClasses()}`}>
      {status}
    </Badge>
  );
};
```

### File Upload Components

#### DragDropUpload
```tsx
interface DragDropUploadProps {
  onFileSelect: (file: File) => void;
  acceptedTypes: string[];
  maxSize: number; // in bytes
  disabled?: boolean;
}

const DragDropUpload: React.FC<DragDropUploadProps> = ({
  onFileSelect,
  acceptedTypes,
  maxSize,
  disabled = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  };

  const validateAndSelectFile = (file: File) => {
    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      throw new Error(`File type not supported. Accepted types: ${acceptedTypes.join(', ')}`);
    }

    // Validate file size
    if (file.size > maxSize) {
      throw new Error(`File too large. Maximum size: ${formatFileSize(maxSize)}`);
    }

    onFileSelect(file);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragOver
          ? 'border-blue-400 bg-blue-50'
          : disabled
          ? 'border-gray-200 bg-gray-50'
          : 'border-gray-300 hover:border-gray-400'
      } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />
      
      <Upload className={`h-12 w-12 mx-auto mb-4 ${disabled ? 'text-gray-300' : 'text-gray-400'}`} />
      <p className={`text-lg font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
        {isDragOver ? 'Drop file here' : 'Drag & drop your file here'}
      </p>
      <p className={`text-sm mt-2 ${disabled ? 'text-gray-300' : 'text-gray-500'}`}>
        or click to select • Max size: {formatFileSize(maxSize)}
      </p>
      <p className={`text-xs mt-1 ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>
        Supported formats: {acceptedTypes.map(type => type.split('/')[1]).join(', ')}
      </p>
    </div>
  );
};
```

### Statistics Components

#### StatCard
```tsx
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  color = 'blue'
}) => {
  const getColorClasses = () => {
    switch (color) {
      case 'green': return 'bg-green-50 text-green-600 border-green-200';
      case 'yellow': return 'bg-yellow-50 text-yellow-600 border-yellow-200';
      case 'red': return 'bg-red-50 text-red-600 border-red-200';
      case 'gray': return 'bg-gray-50 text-gray-600 border-gray-200';
      default: return 'bg-blue-50 text-blue-600 border-blue-200';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {trend && (
              <p className={`text-sm flex items-center mt-1 ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend.isPositive ? '↗️' : '↘️'} {Math.abs(trend.value)}%
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${getColorClasses()}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

## 🔧 Utility Components

### Loading States

#### LoadingSpinner
```tsx
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  className = ''
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'h-4 w-4';
      case 'lg': return 'h-8 w-8';
      default: return 'h-6 w-6';
    }
  };

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <RefreshCcw className={`animate-spin ${getSizeClasses()}`} />
      {text && <span className="text-sm text-gray-600">{text}</span>}
    </div>
  );
};
```

#### LoadingOverlay
```tsx
interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  children: React.ReactNode;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  text = 'Loading...',
  children
}) => {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <LoadingSpinner size="lg" text={text} />
        </div>
      )}
    </div>
  );
};
```

### Error Handling

#### ErrorBoundary
```tsx
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error }> },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="flex items-center justify-center min-h-screen">
    <Card className="max-w-md">
      <CardContent className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <Button onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </CardContent>
    </Card>
  </div>
);
```

## 🔌 Custom Hooks

### usePolling
```tsx
interface UsePollingOptions {
  interval: number;
  immediate?: boolean;
  condition?: () => boolean;
}

const usePolling = (
  callback: () => Promise<void>,
  options: UsePollingOptions
) => {
  const { interval, immediate = true, condition } = options;
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startPolling = useCallback(() => {
    if (condition && !condition()) return;
    
    setIsPolling(true);
    intervalRef.current = setInterval(async () => {
      if (condition && !condition()) {
        stopPolling();
        return;
      }
      await callback();
    }, interval);
  }, [callback, interval, condition]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (immediate) {
      startPolling();
    }
    return stopPolling;
  }, [startPolling, stopPolling, immediate]);

  return { isPolling, startPolling, stopPolling };
};
```

### useFileUpload
```tsx
interface UseFileUploadOptions {
  accept: string[];
  maxSize: number;
  onSuccess?: (file: File) => void;
  onError?: (error: string) => void;
}

const useFileUpload = (options: UseFileUploadOptions) => {
  const { accept, maxSize, onSuccess, onError } = options;
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const validateFile = (file: File): boolean => {
    if (!accept.includes(file.type)) {
      onError?.(`File type not supported. Accepted: ${accept.join(', ')}`);
      return false;
    }

    if (file.size > maxSize) {
      onError?.(`File too large. Max size: ${formatFileSize(maxSize)}`);
      return false;
    }

    return true;
  };

  const selectFile = (selectedFile: File) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
      onSuccess?.(selectedFile);
    }
  };

  const uploadFile = async (url: string, additionalData?: Record<string, any>) => {
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      setProgress(100);
      return result;
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Upload failed');
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setUploading(false);
    setProgress(0);
  };

  return {
    file,
    uploading,
    progress,
    selectFile,
    uploadFile,
    reset
  };
};
```

## 📱 Responsive Design

### Breakpoint Utilities
```tsx
// Tailwind breakpoints
const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
};

// Responsive container
const ResponsiveContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="container mx-auto px-4 sm:px-6 lg:px-8">
    {children}
  </div>
);

// Responsive grid
const ResponsiveGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
    {children}
  </div>
);
```

This comprehensive component documentation provides detailed information for implementing and customizing all UI components in the Medical Question Platform's admin system, with proper TypeScript types, responsive design considerations, and reusable patterns.