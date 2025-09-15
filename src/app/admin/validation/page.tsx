"use client";

import { useEffect, useState, useCallback } from 'react';
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
  Users, 
  FileText, 
  Download, 
  MoreHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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

interface StatsData {
  totalJobs: number;
  completedJobs: number;
  activeJobs: number;
  failedJobs: number;
}

export default function AdminValidationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [allJobs, setAllJobs] = useState<AiJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [previewJob, setPreviewJob] = useState<AiJob | null>(null);
  const [statsData, setStatsData] = useState<StatsData>({
    totalJobs: 0,
    completedJobs: 0,
    activeJobs: 0,
    failedJobs: 0
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Auto-refresh interval
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Load jobs from API
  const loadJobs = useCallback(async () => {
    try {
      setJobsLoading(true);
      const response = await fetch('/api/ai-jobs?admin=true&limit=50');
      if (response.ok) {
        const data = await response.json();
        setAllJobs(data.jobs || []);
        
        // Calculate stats
        const stats = {
          totalJobs: data.jobs?.length || 0,
          completedJobs: data.jobs?.filter((j: AiJob) => j.status === 'completed').length || 0,
          activeJobs: data.jobs?.filter((j: AiJob) => ['queued', 'processing'].includes(j.status)).length || 0,
          failedJobs: data.jobs?.filter((j: AiJob) => j.status === 'failed').length || 0
        };
        setStatsData(stats);
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les jobs",
        variant: "destructive",
      });
    } finally {
      setJobsLoading(false);
    }
  }, []);

  // Auto-refresh when there are active jobs
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    // Only auto-refresh if there are active jobs (processing or queued)
    if (statsData.activeJobs > 0) {
      console.log(`🔄 Auto-refresh activated: ${statsData.activeJobs} active jobs`);
      interval = setInterval(() => {
        loadJobs();
      }, 3000); // 3 second intervals
      setRefreshInterval(interval);
    } else {
      console.log('⏸️ Auto-refresh deactivated: no active jobs');
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [statsData.activeJobs, loadJobs, refreshInterval]);

  // Load jobs on mount
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Classic validation
  const handleClassicValidation = async () => {
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/validation', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `validated_${file.name}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Validation terminée",
          description: "Le fichier validé a été téléchargé",
        });
        setFile(null);
      } else {
        throw new Error('Validation failed');
      }
    } catch (error) {
      console.error('Classic validation error:', error);
      toast({
        title: "Erreur de validation",
        description: "Impossible de valider le fichier",
        variant: "destructive",
      });
    }
  };

  // Download job result
  const downloadJobResult = async (job: AiJob) => {
    try {
      const response = await fetch(`/api/ai-jobs/${job.id}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `enhanced_${job.fileName}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Téléchargement réussi",
          description: "Le fichier amélioré a été téléchargé",
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Erreur de téléchargement",
        description: "Impossible de télécharger le fichier",
        variant: "destructive",
      });
    }
  };

  // Delete job
  const deleteJob = async (job: AiJob) => {
    try {
      const response = await fetch(`/api/ai-jobs/${job.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        await loadJobs();
        toast({
          title: "Job supprimé",
          description: "Le job a été supprimé avec succès",
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Erreur de suppression",
        description: "Impossible de supprimer le job",
        variant: "destructive",
      });
    }
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, { color: string; icon: any }> = {
      queued: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      processing: { color: 'bg-blue-100 text-blue-800', icon: Clock },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
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
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedJobs = allJobs.slice(startIndex, startIndex + itemsPerPage);

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
              <Button onClick={loadJobs} disabled={jobsLoading}>
                {jobsLoading ? 'Actualisation...' : 'Actualiser'}
              </Button>
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
                  <CardTitle>Filter</CardTitle>
                  <p className="text-sm text-muted-foreground">Validation instantanée des données</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
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
                      <FileText className={`mx-auto h-12 w-12 ${file ? 'text-green-500' : 'text-gray-400'}`} />
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
                  
                  <Button 
                    onClick={handleClassicValidation} 
                    disabled={!file}
                    className="w-full"
                  >
                    Filtrer maintenant
                  </Button>
                </CardContent>
              </Card>

              {/* AI Validation - AI Enrichment */}
              <Card>
                <CardHeader>
                  <CardTitle>AI Enrichment</CardTitle>
                  <p className="text-sm text-muted-foreground">Enrichissement par intelligence artificielle</p>
                </CardHeader>
                <CardContent>
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
                                onClick={() => setPreviewJob(job)}
                              >
                                Détails
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
                                onClick={() => deleteJob(job)}
                              >
                                Supprimer
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
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}