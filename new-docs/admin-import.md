# Admin Import System Documentation

## 🎯 Overview

The Admin Import System (`/admin/import`) provides comprehensive functionality for bulk importing medical questions and exam sessions from Excel/CSV files. It supports multi-sheet workbooks, automatic data validation, and progress tracking.

## 🏗️ System Architecture

### Frontend Components
```
/admin/import
├── ImportPage (main page)
├── SessionImportPanel (session imports)
├── QuestionImportPanel (question imports)
└── Progress tracking components
```

### Backend Services
```
API Routes:
├── /api/questions/import (single question import)
├── /api/questions/bulk-import (bulk question import)
├── /api/questions/bulk-import-progress (progress tracking)
└── /api/sessions (session management)
```

## 📱 User Interface

### Main Import Selection
The import page offers two primary import modes:

1. **📚 Importer des sessions** - Import exam sessions from Excel/CSV
2. **📝 Importer des questions** - Import medical questions with multi-sheet support

### Import Types

#### 1. Session Import
- **Purpose**: Import exam sessions (examinations)
- **Format**: Excel/CSV with specific columns
- **Required Columns**: `name`, `pdfUrl`, `correctionUrl`, `niveau`, `semestre`, `specialty`

#### 2. Question Import  
- **Purpose**: Import medical questions with automatic categorization
- **Format**: Multi-sheet Excel workbooks
- **Supported Sheets**: `qcm`, `qroc`, `cas_qcm`, `cas_qroc`
- **Features**: Automatic specialty/course creation, data validation

## 🛠️ Implementation

### 1. Main Import Page (`/src/app/admin/import/page.tsx`)

```tsx
"use client";

import { useEffect, useState } from 'react';
import { ArrowLeft, Database, Files } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SessionImportPanel } from '@/components/admin/import/SessionImportPanel';
import { QuestionImportPanel } from '@/components/admin/import/QuestionImportPanel';

export default function ImportPage() {
  const [mode, setMode] = useState<'choose' | 'sessions' | 'questions'>('choose');
  const [initialImportId, setInitialImportId] = useState<string | null>(null);

  // Handle URL parameters for direct question import navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('importId');
    if (id) {
      setInitialImportId(id);
      setMode('questions');
    }
  }, []);

  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          {mode === 'choose' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Session Import Card */}
              <Card 
                className="hover:shadow-lg transition cursor-pointer" 
                onClick={() => setMode('sessions')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Importer des sessions
                  </CardTitle>
                  <CardDescription>
                    Importer un fichier Excel/CSV de sessions (examens)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Colonnes: name, pdfUrl, correctionUrl, niveau, semestre, specialty
                  </p>
                </CardContent>
              </Card>

              {/* Question Import Card */}
              <Card 
                className="hover:shadow-lg transition cursor-pointer" 
                onClick={() => setMode('questions')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Files className="h-5 w-5" />
                    Importer des questions
                  </CardTitle>
                  <CardDescription>
                    Import multi-feuilles (qcm, qroc, cas_qcm, cas_qroc)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Création automatique des spécialités, cours et cas.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {mode !== 'choose' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setMode('choose')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <h1 className="text-xl font-bold">
                  {mode === 'sessions' ? 'Import des sessions' : 'Import des questions'}
                </h1>
              </div>
              
              {mode === 'sessions' ? (
                <SessionImportPanel />
              ) : (
                <QuestionImportPanel initialImportId={initialImportId || undefined} />
              )}
            </div>
          )}
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}
```

### 2. Question Import Panel (`/src/components/admin/import/QuestionImportPanel.tsx`)

```tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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
}

export function QuestionImportPanel({ initialImportId }: { initialImportId?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setProgress(null);
    }
  };

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
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      setImporting(false);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Sélectionner un fichier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium">
              Glissez-déposez votre fichier Excel ici
            </p>
            <p className="text-sm text-gray-500 mb-4">
              ou cliquez pour sélectionner
            </p>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
            >
              Choisir un fichier
            </Button>
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                <span className="font-medium">{file.name}</span>
                <Badge variant="secondary">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </Badge>
              </div>
              <Button 
                onClick={startImport}
                disabled={importing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {importing ? 'Import en cours...' : 'Commencer l\'import'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Section */}
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {progress.status === 'completed' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : progress.status === 'failed' ? (
                <XCircle className="h-5 w-5 text-red-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-blue-600" />
              )}
              Progression de l'import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Statut: {getStatusLabel(progress.status)}</span>
                <span>{progress.processed} / {progress.total}</span>
              </div>
              <Progress 
                value={(progress.processed / progress.total) * 100} 
                className="w-full"
              />
            </div>

            {progress.currentSheet && (
              <div className="text-sm text-gray-600">
                Feuille actuelle: <strong>{progress.currentSheet}</strong>
                {progress.currentRow && ` (ligne ${progress.currentRow})`}
              </div>
            )}

            {progress.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Erreurs ({progress.errors.length}):</strong>
                  <ul className="list-disc list-inside mt-1">
                    {progress.errors.slice(0, 5).map((error, index) => (
                      <li key={index} className="text-sm">{error}</li>
                    ))}
                    {progress.errors.length > 5 && (
                      <li className="text-sm">... et {progress.errors.length - 5} autres</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {progress.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Avertissements ({progress.warnings.length}):</strong>
                  <ul className="list-disc list-inside mt-1">
                    {progress.warnings.slice(0, 3).map((warning, index) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                    {progress.warnings.length > 3 && (
                      <li className="text-sm">... et {progress.warnings.length - 3} autres</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'parsing': return 'Analyse du fichier...';
    case 'importing': return 'Import en cours...';
    case 'completed': return 'Terminé avec succès';
    case 'failed': return 'Échec de l\'import';
    default: return 'Inconnu';
  }
}
```

## 🔧 API Integration

### Key API Endpoints

#### 1. Bulk Question Import
```typescript
POST /api/questions/bulk-import

Body: FormData with 'file' (Excel workbook)

Response:
{
  message: string;
  importId: string;
}
```

#### 2. Import Progress Tracking
```typescript
GET /api/questions/bulk-import-progress?id={importId}

Response:
{
  id: string;
  status: 'parsing' | 'importing' | 'completed' | 'failed';
  progress: number;
  total: number;
  processed: number;
  errors: string[];
  warnings: string[];
  currentSheet?: string;
  currentRow?: number;
}
```

#### 3. Single Question Import
```typescript
POST /api/questions/import

Body: {
  sheet: 'qcm' | 'qroc' | 'cas_qcm' | 'cas_qroc';
  questionData: {
    texteQuestion: string;
    option1: string;
    option2: string;
    option3: string;
    option4: string;
    option5: string;
    bonneReponse: string;
    explication: string;
    specialite: string;
    cours?: string;
    cas?: string;
    niveau: string;
    semestre: string;
  };
}

Response:
{
  success: boolean;
  questionId?: string;
  message: string;
}
```

#### 4. Session Import
```typescript
POST /api/sessions

Body: {
  name: string;
  pdfUrl: string;
  correctionUrl: string;
  niveau: string;
  semestre: string;
  specialty: string;
}

Response:
{
  success: boolean;
  sessionId?: string;
  message: string;
}
```

## 📊 File Format Specifications

### Question Import Format

#### Supported Sheets
1. **qcm** - Multiple Choice Questions
2. **qroc** - Short Answer Questions  
3. **cas_qcm** - Clinical Case MCQ
4. **cas_qroc** - Clinical Case Short Answer

#### Required Columns for QCM Sheets
```
- texte de la question (question text)
- option 1 (choice A)
- option 2 (choice B) 
- option 3 (choice C)
- option 4 (choice D)
- option 5 (choice E)
- bonne reponse (correct answer: A, B, C, D, or E)
- explication (explanation)
- specialite (medical specialty)
- cours (course/lecture - optional)
- cas (clinical case - optional for cas_* sheets)
- niveau (academic level: PCEM1, PCEM2, DCEM1, etc.)
- semestre (semester)
```

#### Required Columns for QROC Sheets
```
- texte de la question (question text)
- reponse (answer)
- explication (explanation)
- specialite (medical specialty)
- cours (course/lecture - optional)
- cas (clinical case - optional for cas_* sheets)
- niveau (academic level)
- semestre (semester)
```

### Session Import Format

#### Required Columns
```
- name (session name)
- pdfUrl (PDF file URL)
- correctionUrl (correction PDF URL)
- niveau (academic level)
- semestre (semester)
- specialty (medical specialty)
```

## 🛠️ Backend Processing

### Bulk Import API (`/src/app/api/questions/bulk-import/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireMaintainerOrAdmin } from '@/lib/auth-middleware';
import { read, utils } from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

export const POST = requireMaintainerOrAdmin(async (request) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Generate import ID for tracking
    const importId = uuidv4();
    
    // Parse Excel file
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer);
    
    // Initialize progress tracking
    const progress = {
      id: importId,
      status: 'parsing',
      progress: 0,
      total: 0,
      processed: 0,
      errors: [],
      warnings: []
    };

    // Store progress in cache/database
    await storeProgress(importId, progress);

    // Start background processing
    processImportInBackground(importId, workbook);

    return NextResponse.json({
      message: 'Import started successfully',
      importId
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json({ 
      error: 'Failed to start import' 
    }, { status: 500 });
  }
});

async function processImportInBackground(importId: string, workbook: any) {
  try {
    // Update status to importing
    await updateProgress(importId, { status: 'importing' });

    const sheetNames = Object.keys(workbook.Sheets);
    let totalRows = 0;
    let processedRows = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Count total rows first
    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = utils.sheet_to_json(sheet);
      totalRows += data.length;
    }

    await updateProgress(importId, { total: totalRows });

    // Process each sheet
    for (const sheetName of sheetNames) {
      await updateProgress(importId, { currentSheet: sheetName });
      
      const sheet = workbook.Sheets[sheetName];
      const data = utils.sheet_to_json(sheet);
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        const rowNumber = i + 2; // Excel row number (header is row 1)
        
        try {
          await updateProgress(importId, { currentRow: rowNumber });
          
          // Process individual question
          await processQuestionRow(sheetName, row, rowNumber);
          
          processedRows++;
          await updateProgress(importId, { 
            processed: processedRows,
            progress: Math.round((processedRows / totalRows) * 100)
          });
          
        } catch (error) {
          const errorMsg = `Ligne ${rowNumber}: ${error.message}`;
          errors.push(errorMsg);
          await updateProgress(importId, { errors: [...errors] });
        }
      }
    }

    // Mark as completed
    await updateProgress(importId, { 
      status: 'completed',
      progress: 100,
      processed: processedRows
    });

  } catch (error) {
    console.error('Background processing error:', error);
    await updateProgress(importId, { 
      status: 'failed',
      errors: [`Erreur système: ${error.message}`]
    });
  }
}

async function processQuestionRow(sheetName: string, row: any, rowNumber: number) {
  // Validate required fields
  const requiredFields = ['texte de la question', 'specialite', 'niveau', 'semestre'];
  
  for (const field of requiredFields) {
    if (!row[field] || String(row[field]).trim() === '') {
      throw new Error(`Champ requis manquant: ${field}`);
    }
  }

  // Create/find specialty
  const specialty = await findOrCreateSpecialty(row['specialite']);
  
  // Create/find course if provided
  let course = null;
  if (row['cours']) {
    course = await findOrCreateCourse(row['cours'], specialty.id);
  }

  // Create/find clinical case if provided
  let clinicalCase = null;
  if (row['cas'] && (sheetName.includes('cas_'))) {
    clinicalCase = await findOrCreateClinicalCase(row['cas'], specialty.id);
  }

  // Determine question type
  const questionType = sheetName.startsWith('cas_') 
    ? (sheetName.includes('qcm') ? 'cas_qcm' : 'cas_qroc')
    : (sheetName.includes('qcm') ? 'qcm' : 'qroc');

  // Create question
  const questionData = {
    type: questionType,
    questionText: row['texte de la question'],
    specialtyId: specialty.id,
    courseId: course?.id,
    clinicalCaseId: clinicalCase?.id,
    level: row['niveau'],
    semester: row['semestre'],
    // Add type-specific fields
    ...(questionType.includes('qcm') ? {
      optionA: row['option 1'],
      optionB: row['option 2'], 
      optionC: row['option 3'],
      optionD: row['option 4'],
      optionE: row['option 5'],
      correctAnswer: row['bonne reponse'],
      explanation: row['explication']
    } : {
      answer: row['reponse'],
      explanation: row['explication']
    })
  };

  await createQuestion(questionData);
}
```

## 📈 Progress Tracking System

### Progress Storage
```typescript
// In-memory storage for development (use Redis/Database for production)
const progressStore = new Map<string, any>();

async function storeProgress(importId: string, progress: any) {
  progressStore.set(importId, progress);
}

async function updateProgress(importId: string, updates: Partial<any>) {
  const current = progressStore.get(importId) || {};
  const updated = { ...current, ...updates };
  progressStore.set(importId, updated);
}

async function getProgress(importId: string) {
  return progressStore.get(importId);
}
```

### Real-time Updates
The system provides real-time progress updates through:
- **Polling**: Frontend polls progress endpoint every second
- **WebSocket**: (Optional) Real-time push notifications
- **Server-Sent Events**: (Optional) For live progress streams

## 🔒 Security & Validation

### File Validation
```typescript
function validateExcelFile(file: File): boolean {
  // Check file type
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Type de fichier non supporté. Utilisez .xlsx ou .xls');
  }

  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('Fichier trop volumineux. Taille maximale: 50MB');
  }

  return true;
}
```

### Data Sanitization
```typescript
function sanitizeQuestionData(data: any) {
  return {
    questionText: sanitizeHtml(data.questionText),
    optionA: sanitizeHtml(data.optionA),
    optionB: sanitizeHtml(data.optionB),
    optionC: sanitizeHtml(data.optionC),
    optionD: sanitizeHtml(data.optionD),
    optionE: sanitizeHtml(data.optionE),
    explanation: sanitizeHtml(data.explanation),
    // Validate enums
    level: validateLevel(data.level),
    semester: validateSemester(data.semester),
    correctAnswer: validateCorrectAnswer(data.correctAnswer)
  };
}
```

## 🚀 Deployment & Configuration

### Environment Setup
```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/medq

# File Upload Limits
MAX_FILE_SIZE=50MB
ALLOWED_FILE_TYPES=.xlsx,.xls

# Import Configuration
BATCH_SIZE=100
IMPORT_TIMEOUT=300000
PROGRESS_CACHE_TTL=3600
```

### Production Considerations
- **File Storage**: Use cloud storage (AWS S3, Google Cloud) for uploaded files
- **Queue Management**: Use Redis/Bull for job queue management
- **Progress Storage**: Use Redis for real-time progress tracking
- **Error Handling**: Implement comprehensive error logging and recovery
- **Rate Limiting**: Limit concurrent imports per user
- **Monitoring**: Track import success rates and performance metrics

This comprehensive import system provides robust file processing capabilities with real-time progress tracking, detailed error reporting, and automatic data validation for medical question and session management.