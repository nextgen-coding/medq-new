'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CSVImportDialogProps {
  lectureId: string;
  onImportSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function CSVImportDialog({ lectureId, onImportSuccess, trigger }: CSVImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    total: number;
    imported: number;
    failed: number;
    errors?: string[];
  } | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    phase: 'validating' | 'importing' | 'complete';
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast({
          title: t('common.error'),
          description: 'Please select a valid Excel file (.xlsx or .xls)',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setImportResult(null);
    setProgress({ current: 0, total: 0, phase: 'validating' });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      // Use bulk import endpoint if lectureId is "bulk-import"
      const endpoint = lectureId === 'bulk-import' ? '/api/questions/bulk-import' : '/api/questions/import';
      
      if (lectureId !== 'bulk-import') {
        formData.append('lectureId', lectureId);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setProgress({ current: result.total, total: result.total, phase: 'complete' });
        setImportResult(result);
        toast({
          title: t('common.success'),
          description: t('admin.questionsImported', { count: result.imported }),
        });
        onImportSuccess?.();
      } else {
        setProgress({ current: 0, total: 0, phase: 'complete' });
        setImportResult({
          success: false,
          total: result.total || 0,
          imported: result.processedCount || 0,
          failed: result.details?.length || 0,
          errors: result.details || [result.error],
        });
        toast({
          title: t('common.error'),
          description: result.error || t('admin.importError'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setProgress({ current: 0, total: 0, phase: 'complete' });
      toast({
        title: t('common.error'),
        description: t('admin.failedToUploadFile'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImportResult(null);
    setProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    handleReset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="btn-hover">
            <Upload className="h-4 w-4 mr-2" />
            {t('admin.importQROCQuestions')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('admin.importQROCQuestions')}</DialogTitle>
          <DialogDescription>
            Upload an Excel file with QROC questions. The file should have the following columns:
            matiere, cours, question n, source, texte de la question, reponse
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!importResult && (
            <div className="space-y-2">
                             <Label htmlFor="excel-file">Select Excel File</Label>
                             <Input
                 id="excel-file"
                 ref={fileInputRef}
                 type="file"
                 accept=".xlsx,.xls"
                 onChange={handleFileSelect}
                 disabled={isUploading}
               />
              {selectedFile && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{selectedFile.name}</span>
                  <span>({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>
          )}

          {/* Progress Indicator */}
          {isUploading && progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {progress.phase === 'validating' && t('admin.validatingFile')}
                  {progress.phase === 'importing' && t('admin.importingQuestions')}
                  {progress.phase === 'complete' && t('admin.importComplete')}
                </span>
                <span className="text-muted-foreground">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' 
                  }}
                />
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResult && importResult !== null && (
            <div className="space-y-2">
              {importResult.success ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {t('admin.importSuccessful')}
                      </div>
                      <div className="text-sm">
                        <span className="text-green-600 font-medium">{importResult.imported}</span> {t('admin.questionsImportedOf')} {importResult.total}
                        {importResult.failed > 0 && (
                          <span className="text-red-600 ml-2">
                            ({importResult.failed} {t('admin.failures')})
                          </span>
                        )}
                      </div>
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="mt-3">
                          <details className="text-xs">
                            <summary className="cursor-pointer font-medium text-red-700 hover:text-red-800">
                              Voir les erreurs ({importResult.errors.length})
                            </summary>
                            <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 bg-red-50">
                              <ul className="space-y-1">
                                {importResult.errors.map((error, index) => (
                                  <li key={index} className="text-red-700 border-b border-red-200 pb-1 last:border-b-0">
                                    {error}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {t('admin.importWithErrors')}
                      </div>
                      <div className="text-sm">
                        <span className="text-green-600 font-medium">{importResult.imported}</span> {t('admin.questionsImportedOf')} {importResult.total}
                        <span className="text-red-600 ml-2">
                          ({importResult.failed} {t('admin.failures')})
                        </span>
                      </div>
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="mt-3">
                          <details className="text-xs">
                            <summary className="cursor-pointer font-medium text-red-700 hover:text-red-800">
                              Voir les erreurs ({importResult.errors.length})
                            </summary>
                            <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 bg-red-50">
                              <ul className="space-y-1">
                                {importResult.errors.map((error, index) => (
                                  <li key={index} className="text-red-700 border-b border-red-200 pb-1 last:border-b-0">
                                    {error}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!importResult ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? t('admin.uploading') : t('admin.importQuestions')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleReset}>
                {t('admin.importAnotherFile')}
              </Button>
              <Button onClick={handleClose}>
                {t('common.cancel')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 