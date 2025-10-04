"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FilePreviewDialog } from '@/components/validation/FilePreviewDialog';
import { PersistentAiJob } from '@/components/validation/PersistentAiJob';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Download, 
  ChevronLeft,
  ChevronRight,
  Filter as FilterIcon,
  Bug as BugIcon,
  Info,
  Trash2,
  Activity,
  Terminal,
  Pause,
  Play,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

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
  user?: { name?: string; email?: string };
}

interface StatsData {
  totalJobs: number;
  completedJobs: number;
  activeJobs: number;
  failedJobs: number;
}

// Shapes returned by /api/validation
type SheetName = 'qcm' | 'qroc' | 'cas_qcm' | 'cas_qroc';
interface GoodRow { sheet: SheetName; row: number; data: Record<string, any> }
interface BadRow { sheet: SheetName; row: number; reason: string; original: Record<string, any> }

export default function AdminValidationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    good: GoodRow[];
    bad: BadRow[];
    goodCount: number;
    badCount: number;
    sessionId?: string;
    fileName?: string;
  } | null>(null);

  const [allJobs, setAllJobs] = useState<AiJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [previewJob, setPreviewJob] = useState<AiJob | null>(null);
  const [statsData, setStatsData] = useState<StatsData>({
    totalJobs: 0,
    completedJobs: 0,
    activeJobs: 0,
    failedJobs: 0
  });
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<AiJob | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  
  // Details modal
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsJobId, setDetailsJobId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState<any | null>(null);
  const detailsEventRef = useRef<EventSource | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Auto-refresh interval (ref-based to avoid state update loops)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load jobs from API
  const loadJobs = useCallback(async () => {
    try {
      setJobsLoading(true);
      const response = await fetch('/api/validation/ai-progress?action=list');
      if (response.ok) {
        const data = await response.json();
        
        // Map the new API response to the expected format
        const mappedJobs = (data.jobs || []).map((job: any) => ({
          id: job.id,
          fileName: job.fileName || 'fichier.xlsx',
          status: job.phase === 'complete' ? 'completed' as const : 
                  job.phase === 'error' ? 'failed' as const :
                  job.phase === 'running' ? 'processing' as const : 'queued' as const,
          progress: job.progress || 0,
          message: job.message || '',
          processedItems: job.processedItems,
          totalItems: job.totalItems,
          createdAt: new Date(job.createdAt).toISOString(),
          startedAt: job.lastUpdated ? new Date(job.lastUpdated).toISOString() : undefined,
          completedAt: job.phase === 'complete' && job.lastUpdated ? new Date(job.lastUpdated).toISOString() : undefined,
          user: undefined // No user info in new API
        }));
        
        setAllJobs(mappedJobs);
        
        // Calculate stats
        const stats = {
          totalJobs: mappedJobs.length,
          completedJobs: mappedJobs.filter((j: AiJob) => j.status === 'completed').length,
          activeJobs: mappedJobs.filter((j: AiJob) => ['queued', 'processing'].includes(j.status)).length,
          failedJobs: mappedJobs.filter((j: AiJob) => j.status === 'failed').length
        };
        setStatsData(stats);
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast.error("Impossible de charger les jobs");
    } finally {
      setJobsLoading(false);
    }
  }, []);

  // Auto-refresh when there are active jobs AND auto-refresh is enabled
  useEffect(() => {
    // Only auto-refresh if enabled AND there are active jobs (processing or queued)
    if (autoRefreshEnabled && statsData.activeJobs > 0) {
      if (!refreshIntervalRef.current) {
        console.log(`🔄 Auto-refresh activated: ${statsData.activeJobs} active jobs`);
        refreshIntervalRef.current = setInterval(() => {
          loadJobs();
        }, 3000); // 3 second intervals
      }
    } else {
      if (refreshIntervalRef.current) {
        console.log('⏸️ Auto-refresh deactivated');
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      // When auto-refresh is disabled, close active details SSE connection
      if (!autoRefreshEnabled && detailsEventRef.current) {
        console.log('🔌 Closing details EventSource: auto-refresh disabled');
        detailsEventRef.current.close();
        detailsEventRef.current = null;
      }
    }

    return () => {
      // no-op here; explicit unmount cleanup below
    };
  }, [statsData.activeJobs, loadJobs, autoRefreshEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      if (detailsEventRef.current) {
        detailsEventRef.current.close();
        detailsEventRef.current = null;
      }
    };
  }, []);

  // Load jobs on mount
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Classic validation (Filter)
  const handleClassicValidation = async () => {
    if (!file) return;

    try {
      setValidating(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/validation', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        const errorMsg = err?.error || 'Validation failed';
        
        // Show user-friendly error message
        toast.error("Erreur de validation", {
          description: errorMsg,
          duration: 6000, // Show longer for complex errors
        });
        throw new Error(errorMsg);
      }

      const result = await response.json();
      setValidationResult(result);
      
      // Show detailed success message
      if (result.badCount === 0) {
        toast.success('✅ Validation réussie!', { 
          description: `${result.goodCount} question${result.goodCount > 1 ? 's' : ''} valide${result.goodCount > 1 ? 's' : ''} • Prêt pour l'import`,
          duration: 4000
        });
      } else if (result.goodCount === 0) {
        toast.error('❌ Aucune question valide', { 
          description: `${result.badCount} erreur${result.badCount > 1 ? 's' : ''} détectée${result.badCount > 1 ? 's' : ''} • Consultez le fichier d'erreurs`,
          duration: 5000
        });
      } else {
        toast.warning('⚠️ Validation partielle', { 
          description: `${result.goodCount} valide${result.goodCount > 1 ? 's' : ''} • ${result.badCount} erreur${result.badCount > 1 ? 's' : ''} • Téléchargez les deux fichiers`,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Classic validation error:', error);
      // Error already shown in toast above
    } finally {
      setValidating(false);
    }
  };

  const downloadValidated = async (mode: 'good' | 'bad') => {
    if (!validationResult) return;
    try {
      // Prefer session-based download (no long URLs)
      if (validationResult.sessionId) {
        const urlParams = new URLSearchParams({ mode, sessionId: validationResult.sessionId! });
        if (validationResult.fileName) urlParams.set('fileName', validationResult.fileName);
        const res = await fetch(`/api/validation?${urlParams.toString()}`);
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const cd = res.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename="?([^";]+)"?/i);
        const suggested = match ? match[1] : undefined;
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = objectUrl;
        a.download = suggested || `validation_${mode}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(objectUrl);
        return;
      }

      // Fallback to POST export with JSON body
      const res = await fetch('/api/validation/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, good: validationResult.good, bad: validationResult.bad, fileName: validationResult.fileName })
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^";]+)"?/i);
      const suggested = match ? match[1] : undefined;
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = objectUrl;
      a.download = suggested || `validation_${mode}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
    } catch (e) {
      toast.error('Impossible de télécharger');
    }
  };

  const resetValidation = () => {
    setFile(null);
    setValidationResult(null);
  };

  // Download job result
  const downloadJobResult = async (job: AiJob) => {
    try {
      const response = await fetch(`/api/validation/ai-progress?aiId=${job.id}&action=download`);
      if (response.ok) {
        const blob = await response.blob();
        const cd = response.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename="?([^";]+)"?/i);
        const suggested = match ? match[1] : undefined;
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = objectUrl;
        a.download = suggested || `enhanced_${job.fileName}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(objectUrl);
        
        toast.success("Le fichier amélioré a été téléchargé");
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Impossible de télécharger le fichier");
    }
  };

  // Delete job (custom dialog)
  const deleteJob = async (job: AiJob) => {
    setDeletingJobId(job.id);
    try {
      const response = await fetch(`/api/validation/ai-progress?aiId=${job.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Suppression échouée');
      toast.success('Job supprimé');
      if (detailsJobId === job.id) {
        setDetailsOpen(false);
        setDetailsJobId(null);
        setDetailsData(null);
      }
      // Optimistic removal
      setAllJobs(prev => prev.filter(j => j.id !== job.id));
      loadJobs();
    } catch (error: any) {
      toast.error('Erreur suppression', { description: error?.message || 'Erreur inconnue' });
    } finally {
      setConfirmDeleteJob(null);
      setDeletingJobId(null);
    }
  };

  // Open job details
  const openDetails = async (job: AiJob) => {
    setDetailsJobId(job.id);
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const response = await fetch(`/api/validation/ai-progress?aiId=${encodeURIComponent(job.id)}&action=details`);
      if (response.ok) {
        const data = await response.json();
        setDetailsData(data);

        // Auto-refresh logs if job is running
        if (data.phase === 'running') {
          if (detailsEventRef.current) detailsEventRef.current.close();
          const eventSource = new EventSource(`/api/validation/ai-progress?aiId=${encodeURIComponent(job.id)}`);
          detailsEventRef.current = eventSource;
          eventSource.onmessage = (ev) => {
            try {
              const upd = JSON.parse(ev.data);
              setDetailsData((prev: any) => prev ? { ...prev, ...upd, logs: upd.logs || prev.logs || [] } : upd);
            } catch { }
          };
          eventSource.onerror = () => {
            eventSource.close();
          };
        }
      } else {
        toast.error('Impossible de charger les détails');
      }
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setDetailsJobId(null);
    setDetailsData(null);
    if (detailsEventRef.current) {
      detailsEventRef.current.close();
      detailsEventRef.current = null;
    }
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, { color: string; icon: any }> = {
      queued: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
      processing: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Clock },
      completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
      cancelled: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200', icon: XCircle },
    };

    const variant = variants[status] || variants.queued;
    const Icon = variant.icon;

    return (
      <Badge className={`${variant.color} border-0`}>
        <Icon className="w-3 h-3 mr-1" />
        {status === 'queued' ? 'En attente' :
         status === 'processing' ? 'En cours' :
         status === 'completed' ? 'Terminé' :
         status === 'failed' ? 'Échoué' :
         'Annulé'}
      </Badge>
    );
  };

  // Pagination
  const totalPages = Math.ceil(allJobs.length / itemsPerPage);
  const displayedJobs = allJobs.slice((currentPage - 1) * itemsPerPage, (currentPage - 1) * itemsPerPage + itemsPerPage);

  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">Validation des Questions</h1>
                <p className="text-muted-foreground">Système de validation classique et IA</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={autoRefreshEnabled ? "default" : "outline"}
                  onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                  title={autoRefreshEnabled ? "Désactiver le rafraîchissement automatique" : "Activer le rafraîchissement automatique"}
                >
                  {autoRefreshEnabled ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Auto-refresh ON
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Auto-refresh OFF
                    </>
                  )}
                </Button>
                <Button onClick={loadJobs} disabled={jobsLoading} variant="outline">
                  <RefreshCw className={`h-4 w-4 mr-2 ${jobsLoading ? 'animate-spin' : ''}`} />
                  {jobsLoading ? 'Actualisation...' : 'Actualiser'}
                </Button>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statsData.totalJobs}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Terminés</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{statsData.completedJobs}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Actifs</CardTitle>
                  <Clock className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{statsData.activeJobs}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Échoués</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{statsData.failedJobs}</div>
                </CardContent>
              </Card>
            </div>

            {/* Validation Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Classic Validation - Filter */}
              <Card>
                <CardHeader>
                  <CardTitle>Filter (Validation)</CardTitle>
                  <p className="text-sm text-muted-foreground">Vérification rapide et normalisation de votre classeur Excel</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Help Section */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 dark:bg-blue-950/30 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-200">📋 Comment ça marche</h4>
                    <div className="text-sm text-blue-800 space-y-2 dark:text-blue-100">
                      <p><strong>Objectif :</strong> Vérifier que votre classeur est utilisable et identifier les erreurs avant l'import</p>
                      <p><strong>Feuilles acceptées :</strong> <code>qcm</code>, <code>qroc</code>, <code>cas qcm</code>, <code>cas qroc</code></p>
                      <p><strong>Vérifications :</strong></p>
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>Présence des colonnes requises par type de feuille</li>
                        <li>Réponses QCM valides (A–E) ou "?" / "Pas de réponse"</li>
                        <li>Réponses QROC non vides</li>
                        <li>Explications: facultatives (QCM/QROC/Cas clinique), si présentes on les conserve</li>
                      </ul>
                      <p><strong>Résultat :</strong> Liste des lignes valides vs invalides avec raisons d'erreur</p>
                    </div>
                  </div>

                  {/* File Upload */}
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      file ? 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-400' : 'border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
                    }`}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv'))) {
                        setFile(droppedFile);
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="classic-file"
                    />
                    <label htmlFor="classic-file" className="cursor-pointer">
                      <FileText className={`mx-auto h-12 w-12 ${file ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`} />
                      <div className="mt-2">
                        <p className="text-sm font-medium">
                          {file ? file.name : 'Glissez-déposez votre fichier ici'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ou cliquez pour sélectionner • Excel (.xlsx, .xls) ou CSV
                        </p>
                      </div>
                    </label>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleClassicValidation} 
                      disabled={!file || validating}
                      className="w-full"
                    >
                      <FilterIcon className={`h-4 w-4 mr-2 ${validating ? 'animate-spin' : ''}`} />
                      {validating ? 'Filtrage...' : 'Filtrer maintenant'}
                    </Button>
                    {validationResult && (
                      <Button variant="ghost" onClick={resetValidation}>
                        Réinitialiser
                      </Button>
                    )}
                  </div>

                  {/* Results */}
                  {validationResult && (
                    <div className="mt-2 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-green-100 text-green-800 border-0 dark:bg-green-900/30 dark:text-green-300">{validationResult.goodCount} valides</Badge>
                        <Badge className="bg-red-100 text-red-800 border-0 dark:bg-red-900/30 dark:text-red-300">{validationResult.badCount} erreurs</Badge>
                        <Button size="sm" variant="outline" onClick={() => downloadValidated('good')}>
                          <Download className="h-4 w-4 mr-2" /> Télécharger valides
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadValidated('bad')}>
                          <Download className="h-4 w-4 mr-2" /> Télécharger erreurs
                        </Button>
                      </div>

                      {/* Bad rows preview */}
                      {validationResult.bad.length > 0 && (
                        <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                          <div className="flex items-center gap-2 mb-3">
                            <BugIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                            <span className="text-sm font-semibold text-red-900 dark:text-red-100">
                              Erreurs détectées ({validationResult.bad.length})
                            </span>
                          </div>
                          
                          {/* Error breakdown by sheet */}
                          <div className="mb-3 flex gap-2 flex-wrap">
                            {Object.entries(
                              validationResult.bad.reduce((acc: Record<string, number>, r: any) => {
                                acc[r.sheet] = (acc[r.sheet] || 0) + 1;
                                return acc;
                              }, {})
                            ).map(([sheet, count]) => (
                              <Badge key={sheet} variant="outline" className="bg-white dark:bg-gray-800 text-xs">
                                {sheet}: {count}
                              </Badge>
                            ))}
                          </div>
                          
                          <ul className="space-y-2 text-sm text-red-800 dark:text-red-200 mb-3">
                            {validationResult.bad.slice(0, 10).map((r: any, idx: number) => (
                              <li key={idx} className="border-l-2 border-red-400 pl-3 py-1">
                                <div className="flex items-start gap-2">
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {r.sheet}
                                  </Badge>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium">Ligne {r.row}</div>
                                    <div className="text-xs opacity-90 break-words">{r.reason}</div>
                                    {r.original?.['texte de la question'] && (
                                      <div className="text-xs mt-1 opacity-75 truncate">
                                        "{String(r.original['texte de la question']).substring(0, 60)}..."
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </li>
                            ))}
                            {validationResult.bad.length > 10 && (
                              <li className="text-xs text-center opacity-75 pt-2">
                                ... et {validationResult.bad.length - 10} autre{validationResult.bad.length - 10 > 1 ? 's' : ''} erreur{validationResult.bad.length - 10 > 1 ? 's' : ''}
                              </li>
                            )}
                          </ul>
                          
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-red-200 dark:border-red-700">
                            <div className="flex items-start gap-2">
                              <Info className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                              <div className="text-xs text-gray-700 dark:text-gray-300">
                                <strong className="text-purple-700 dark:text-purple-300">💡 Solution :</strong> 
                                <ol className="mt-1 ml-4 list-decimal space-y-1">
                                  <li>Téléchargez le fichier d'erreurs (structure identique à l'original avec colonne "reason")</li>
                                  <li>Corrigez manuellement OU utilisez l'AI Enrichment ci-dessous pour correction automatique</li>
                                  <li>Les erreurs sont organisées par onglet (qcm, qroc, cas_qcm, cas_qroc) comme le fichier original</li>
                                </ol>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Validation - AI Enrichment */}
              <Card>
                <CardHeader>
                  <CardTitle>AI Enrichment (Assistance IA)</CardTitle>
                  <p className="text-sm text-muted-foreground">Normalisation automatique des réponses et explications</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* AI Help Section */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3 dark:bg-purple-900/20 dark:border-purple-800">
                    <h4 className="font-medium text-purple-900 dark:text-purple-200">🤖 Assistance IA</h4>
                    <div className="text-sm text-purple-800 space-y-2 dark:text-purple-100">
                      <p><strong>Astuce :</strong> Après le filtrage, téléchargez le fichier des erreurs et déposez-le ici pour correction automatique.</p>
                    </div>
                  </div>
                  
                  <PersistentAiJob onJobCreated={loadJobs} />
                </CardContent>
              </Card>
            </div>

            {/* Jobs Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Gestion des Jobs IA</span>
                  {statsData.activeJobs > 0 && (
                    <Badge variant="secondary" className="animate-pulse">
                      {statsData.activeJobs} actifs
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {displayedJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun job trouvé
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {displayedJobs.map((job) => (
                        <div key={job.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <StatusBadge status={job.status} />
                                <span className="font-medium">{job.fileName}</span>
                                {job.user && (
                                  <span className="text-sm text-muted-foreground">
                                    par {job.user.name || job.user.email}
                                  </span>
                                )}
                              </div>
                              
                              {job.status === 'processing' && (
                                <div className="mt-2">
                                  <Progress value={job.progress} className="w-full" />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {job.message} ({job.processedItems || 0}/{job.totalItems || 0})
                                  </p>
                                </div>
                              )}
                              
                              <p className="text-xs text-muted-foreground mt-1">
                                Créé le {new Date(job.createdAt).toLocaleString()}
                              </p>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDetails(job)}
                                title="Détails"
                              >
                                <Info className="h-4 w-4 mr-1" /> Détails
                              </Button>
                              
                              {job.status === 'completed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => downloadJobResult(job)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setConfirmDeleteJob(job)}
                                title="Supprimer"
                                disabled={deletingJobId === job.id}
                              >
                                {deletingJobId === job.id ? (
                                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />...</span>
                                ) : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6">
                        <div className="text-sm text-muted-foreground">
                          Page {currentPage} sur {totalPages} ({allJobs.length} jobs au total)
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Précédent
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Suivant
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview Dialog */}
          {previewJob && (
            <FilePreviewDialog
              job={previewJob}
              open={!!previewJob}
              onOpenChange={() => setPreviewJob(null)}
            />
          )}

          {/* Details Dialog */}
          {detailsOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/40">
              <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg w-full max-w-4xl p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Détails Job {detailsData?.fileName && <span className="font-normal text-muted-foreground">({detailsData.fileName})</span>}
                  </h2>
                  <div className="flex gap-2">
                    {detailsData?.phase === 'complete' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadJobResult({ id: detailsData.id, fileName: detailsData.fileName, status: 'completed', progress: detailsData.progress, message: detailsData.message, createdAt: new Date().toISOString() } as AiJob)}
                      >
                        <Download className="h-4 w-4 mr-1" /> Télécharger
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={closeDetails}>
                      Fermer
                    </Button>
                  </div>
                </div>
                {detailsLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}
                {!detailsLoading && detailsData && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div className="p-2 rounded bg-gray-100 dark:bg-gray-800">
                        <p className="font-medium">Phase</p>
                        <p>{detailsData.phase}</p>
                      </div>
                      <div className="p-2 rounded bg-gray-100 dark:bg-gray-800">
                        <p className="font-medium">Progression</p>
                        <p>{detailsData.progress}%</p>
                      </div>
                      <div className="p-2 rounded bg-gray-100 dark:bg-gray-800">
                        <p className="font-medium">Corrigées</p>
                        <p>{detailsData.stats?.fixedCount ?? 0}</p>
                      </div>
                      <div className="p-2 rounded bg-gray-100 dark:bg-gray-800">
                        <p className="font-medium">Erreurs</p>
                        <p>{detailsData.stats?.errorCount ?? 0}</p>
                      </div>
                      <div className="p-2 rounded bg-gray-100 dark:bg-gray-800 md:col-span-2 col-span-2">
                        <p className="font-medium">Lots</p>
                        <p>{detailsData.stats?.processedBatches ?? 0} / {detailsData.stats?.totalBatches ?? 0}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium flex items-center gap-1">
                        <Terminal className="h-3 w-3" /> Logs
                      </p>
                      <div className="border rounded h-64 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-3 text-[11px] leading-relaxed font-mono">
                        {(detailsData.logs || []).length === 0 && <p className="text-muted-foreground">Aucun log</p>}
                        {(detailsData.logs || []).map((l: string, i: number) => (
                          <div key={i} className="whitespace-pre-wrap">{l}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Global Delete Confirmation Dialog (always mounted) */}
          <Dialog open={!!confirmDeleteJob} onOpenChange={(o)=>{ if(!o) setConfirmDeleteJob(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Supprimer ce job ?</DialogTitle>
                <DialogDescription>
                  Cette action est irréversible. Le job {confirmDeleteJob?.fileName} sera définitivement supprimé.
                </DialogDescription>
              </DialogHeader>
              <div className="text-sm space-y-2">
                <p>ID: <code className="text-xs">{confirmDeleteJob?.id}</code></p>
                {confirmDeleteJob?.status !== 'completed' && (
                  <p className="text-red-600 dark:text-red-400 text-xs">Attention: ce job n'est pas terminé.</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={()=>setConfirmDeleteJob(null)}>Annuler</Button>
                <Button variant="destructive" disabled={!!deletingJobId} onClick={()=> confirmDeleteJob && deleteJob(confirmDeleteJob)}>
                  {deletingJobId ? 'Suppression...' : 'Supprimer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}