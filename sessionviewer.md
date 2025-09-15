# Session Viewer - Comprehensive Documentation

## Overview
The Session Viewer is a sophisticated PDF viewer and correction system located at `/session/[id]/[sessionId]/viewer/page.tsx`. It provides a dual-pane interface for viewing exam PDFs and managing corrections with role-based functionality.

## File Structure
```
src/app/session/[id]/[sessionId]/viewer/page.tsx  (Main viewer component)
src/components/session/CorrectionZone.tsx        (Correction management)
```

## URL Structure
- **Route**: `/session/[id]/[sessionId]/viewer`
- **Parameters**:
  - `id`: Specialty ID (specialtyId)
  - `sessionId`: Session ID
- **Query Parameters**:
  - `type`: Optional, can be 'correction' to auto-open correction PDF view

## Main Components

### 1. SessionViewerPage (Main Component)

#### Core State Management
```typescript
// Session data
const [session, setSession] = useState<Session | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// PDF viewer state (main exam)
const [loadingPdf, setLoadingPdf] = useState(true);
const [numPages, setNumPages] = useState<number | null>(null);
const [scale, setScale] = useState(1.2);
const [rotation, setRotation] = useState(0);
const [pdfError, setPdfError] = useState<string | null>(null);

// UI layout state
const [isFullscreen, setIsFullscreen] = useState(false);
const [panelCollapsed, setPanelCollapsed] = useState(false);
const [showCorrectionPdf, setShowCorrectionPdf] = useState(false);

// Correction PDF state (separate from main exam)
const [correctionNumPages, setCorrectionNumPages] = useState<number | null>(null);
const [correctionScale, setCorrectionScale] = useState(1.0);
const [correctionRotation, setCorrectionRotation] = useState(0);
const [correctionLoading, setCorrectionLoading] = useState(true);
const [correctionError, setCorrectionError] = useState<string | null>(null);
```

#### PDF URL Processing
The system handles Google Drive URLs and regular PDFs:

```typescript
function getValidPdfLink(dbLink?: string | null): string | undefined {
  if (!dbLink) return undefined;
  
  // Direct PDF links
  if (/\.pdf($|[?#])/i.test(dbLink)) return dbLink;
  
  // Google Drive conversion
  const driveRegex = /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i;
  const match = dbLink.match(driveRegex);
  if (match) {
    const id = match[1];
    return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  
  return dbLink; // fallback unchanged
}
```

URLs are proxied through `/api/proxy-pdf` for Google Drive links to avoid CORS issues.

#### Role-Based Access Control
```typescript
const canViewCorrection = !!user; // All authenticated users can view corrections
const mode: 'admin' | 'maintainer' | 'student' = 
  user?.role === 'admin' ? 'admin' : 
  user?.role === 'maintainer' ? 'maintainer' : 
  'student';
```

### 2. Layout Structure

#### Responsive Grid System
```typescript
// Adaptive layout based on panel state
<div className={`min-w-0 space-y-4 transition-all duration-300 xl:col-span-12
  ${!panelCollapsed ? 'xl:col-span-6 2xl:col-span-7' : 'xl:col-span-12'}
`}>
```

- **Collapsed**: Single column, full width (exam only)
- **Expanded**: Two columns on XL screens (exam + correction)
- **Mobile**: Stacked layout on smaller screens

#### PDF Viewer Features

##### Auto-Fit Functionality
```typescript
const fitExamPage = useCallback(() => {
  const el = examViewerRef.current;
  if (!el) return;
  const baseW = (rotation % 180 === 90) ? 842 : 595; // A4 dimensions
  const availW = el.clientWidth - 32; // padding allowance
  if (availW <= 0) return;
  const scaleW = availW / baseW;
  const newScale = Math.max(0.4, Math.min(3, scaleW));
  setScale(newScale);
}, [rotation]);
```

##### PDF Controls
- **Zoom**: ±20% increments, range 50%-300%
- **Rotation**: 90° increments
- **Auto-fit**: Calculates optimal scale based on container width
- **Fullscreen**: Native browser fullscreen API

### 3. CorrectionZone Component

#### Dual Mode System
The correction zone operates in two distinct modes:

1. **Editor Mode** (Admin/Maintainer):
   - Can create/edit correction templates
   - Auto-save functionality (1.5s debounce)
   - Test mode simulation
   - Reference answers always visible

2. **Student Mode**:
   - Answer input only
   - Optional reference viewing
   - Answer persistence without scoring

#### Data Structure

##### SessionCorrectionData
```typescript
{
  tables: {
    id: string;
    title?: string;
    headers: string[];
    rows: string[][];
    compareMode?: 'exact' | 'case-insensitive' | 'set';
  }[];
  texts: {
    id: string;
    title?: string;
    reference: string;
    keywords?: string[];
    scoring?: { full: number; partial?: number };
  }[];
}
```

##### SessionCorrectionSubmission
```typescript
{
  answers: {
    tables: { id: string; rows: string[][] }[];
    texts: { id: string; answer: string }[];
  };
}
```

#### Table Management

##### Dynamic Table Operations
- **Add/Remove Columns**: Headers and all rows automatically adjusted
- **Add/Remove Rows**: Maintains header count consistency
- **Cell Editing**: Dual-path for reference vs. user answers
- **Question Column Logic**: First column or columns containing "question" are read-only for students

##### Table Rendering Logic
```typescript
// Question columns (read-only for students)
const isQuestionCol = ci === 0 || /question/i.test(headerLabel);

// Show reference or user answer based on mode and visibility
const displayVal = showRef ? cell : userVal;

// Correctness evaluation (students only, when reference visible)
const shouldEvaluate = showRef && !canEdit && !isQuestionCol;
const isCorrect = shouldEvaluate && userVal !== '' && 
                 normalize(userVal) === normalize(cell);
```

#### Text Area Management
- **Reference Editing**: Admin/maintainer can set official answers
- **Student Answers**: Separate text areas for student responses
- **Dual Display**: When reference is visible, both reference and answer shown

### 4. API Integration

#### Session Data Fetching
```typescript
// GET /api/sessions/[sessionId]
const res = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' });
```

#### Correction Management
```typescript
// Load correction with user submission
fetch(`/api/sessions/${sessionId}/correction?withSubmission=1`)

// Save correction template (admin/maintainer)
fetch(`/api/sessions/${sessionId}/correction`, { 
  method: 'POST', 
  body: JSON.stringify({ data }) 
});

// Submit user answers
fetch(`/api/sessions/${sessionId}/correction`, { 
  method: 'PUT', 
  body: JSON.stringify({ answers: userAnswers }) 
});
```

### 5. PDF Rendering System

#### React-PDF Integration
- **Dynamic Imports**: SSR-safe loading to avoid DOMMatrix errors
- **Error Handling**: Specific error types (Missing, Invalid, Network)
- **Performance**: Disabled text and annotation layers for better performance

#### PDF Validation
```typescript
// Pre-validate PDF via HEAD request
const validate = async () => {
  if (!currentPdfUrl.startsWith('/api/proxy-pdf')) {
    let res = await fetch(currentPdfUrl, { method: 'HEAD' });
    if (!res.ok) {
      setPdfError(`Impossible de charger le PDF (HTTP ${res.status}).`);
      return;
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('pdf')) {
      setPdfError('Le lien ne pointe pas vers un PDF.');
      return;
    }
  }
};
```

### 6. User Experience Features

#### Responsive Design
- **Mobile-first**: Touch-friendly controls, collapsed panels by default
- **Desktop**: Dual-pane layout with resizable panels
- **Keyboard**: Standard PDF navigation shortcuts

#### Loading States
- **Session Loading**: Spinner with retry option
- **PDF Loading**: Overlay with progress indication
- **Auto-save**: Visual feedback for save states

#### Error Handling
- **Network Errors**: Retry mechanisms with user feedback
- **PDF Errors**: Specific error messages with suggested actions
- **Validation**: Pre-flight checks before rendering

### 7. Performance Optimizations

#### Auto-Fit Calculations
- **Debounced Resize**: Window resize events handled efficiently
- **A4 Assumptions**: 595x842px at 72dpi for consistent scaling
- **Container Awareness**: Respects sidebar state and responsive breakpoints

#### Memory Management
- **Component Cleanup**: Proper useEffect cleanup for fetch operations
- **PDF Cleanup**: Automatic cleanup of PDF.js resources
- **State Management**: Efficient state updates to prevent unnecessary re-renders

### 8. Accessibility Features

#### Keyboard Navigation
- **Tab Order**: Logical navigation through controls
- **Screen Reader**: Semantic HTML and ARIA labels
- **Focus Management**: Proper focus handling for modals and panels

#### Visual Design
- **High Contrast**: Clear visual hierarchy with proper contrast ratios
- **Responsive Text**: Scalable typography across devices
- **Color Coding**: Semantic colors for success/error states

### 9. Security Considerations

#### Authentication
- **Protected Routes**: Requires valid authentication
- **Role-Based Access**: Different capabilities based on user role
- **Session Validation**: Server-side session verification

#### PDF Security
- **Proxy Handling**: Google Drive URLs proxied to avoid exposure
- **URL Validation**: Server-side URL validation before serving
- **CORS Handling**: Proper cross-origin resource sharing

### 10. Future Enhancement Opportunities

#### Performance Improvements
- **Virtual Scrolling**: For very large PDFs
- **Progressive Loading**: Load pages on demand
- **Caching**: Client-side PDF caching for revisits

#### Feature Additions
- **Annotations**: PDF markup capabilities
- **Search**: Text search within PDFs
- **Export**: Answer export functionality
- **Collaboration**: Real-time collaborative corrections

#### Technical Debt
- **Type Safety**: Stronger TypeScript types for PDF events
- **Error Boundaries**: React error boundaries for PDF failures
- **Testing**: Comprehensive unit and integration tests

## Conclusion

The Session Viewer represents a sophisticated educational tool that balances functionality, performance, and user experience. Its dual-mode operation, responsive design, and comprehensive error handling make it suitable for various educational scenarios while maintaining scalability and maintainability.
