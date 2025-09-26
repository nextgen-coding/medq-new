"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Brain, 
  FileText, 
  Download,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Users
} from 'lucide-react';
import { toast } from 'sonner';

interface AiJob {
  id: string;
  fileName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  processedItems?: number;
  totalItems?: number;
  currentBatch?: number;
  totalBatches?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  user?: {
    name?: string;
    email?: string;
  };
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
    estimatedTimeRemaining: number;
    isProcessing: boolean;
    startTime: number;
    lastUpdateTime: number;
  };
}

interface FilePreviewDialogProps {
  job: AiJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({ job, open, onOpenChange }: FilePreviewDialogProps) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Load preview data
  const loadPreviewData = async () => {
    try {
      setLoading(true);
      // For the new AI system, we don't have a separate preview endpoint
      // Just show basic job information
      setPreviewData({
        explanations: [],
        summary: {
          totalExplanations: 0,
          validExplanations: 0,
          questionsWithAI: 0,
          questionsWithoutAI: 0,
          warnings: [
            "Aperçu détaillé non disponible pour ce type de job. Les informations seront affichées lorsque le traitement avancé sera implémenté."
          ]
        }
      });
    } catch (error) {
      console.error('Error loading preview data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh for processing jobs
  useEffect(() => {
    if (open) {
      loadPreviewData();
      
      // Set up auto-refresh for processing jobs
      if (job.status === 'processing') {
        const interval = setInterval(() => {
          loadPreviewData();
        }, 2000); // 2 second intervals
        
        setRefreshInterval(interval);
        return () => {
          clearInterval(interval);
          setRefreshInterval(null);
        };
      } else if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [open, job.status]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  const downloadJobResult = async () => {
    try {
      const response = await fetch(`/api/validation/ai-progress?aiId=${job.id}&action=download`);
      if (response.ok) {
        const blob = await response.blob();
        const cd = response.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename="?([^";]+)"?/i);
        const suggested = match ? match[1] : undefined;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = suggested || `enhanced_${job.fileName}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast.success("Téléchargement réussi", {
          description: "Le fichier amélioré a été téléchargé",
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Erreur de téléchargement", {
        description: "Impossible de télécharger le fichier",
      });
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-medblue-100 text-medblue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued': return Clock;
      case 'processing': return Brain;
      case 'completed': return CheckCircle;
      case 'failed': return XCircle;
      case 'cancelled': return XCircle;
      default: return Clock;
    }
  };

  const StatusIcon = getStatusIcon(job.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">
            <FileText className="h-5 w-5" />
            {job.fileName}
            <Badge className={`${getStatusColor(job.status)} border-0`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {job.status === 'queued' ? 'En attente' :
               job.status === 'processing' ? 'En cours' :
               job.status === 'completed' ? 'Terminé' :
               job.status === 'failed' ? 'Échoué' :
               'Annulé'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Section for Processing Jobs */}
          {job.status === 'processing' && previewData?.progressInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5" />
                  Progression en Temps Réel
                  {job.status === 'processing' && (
                    <Badge variant="secondary" className="animate-pulse">
                      Actif
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progression globale</span>
                    <span>{Math.round(previewData.progressInfo.progress)}%</span>
                  </div>
                  <Progress value={previewData.progressInfo.progress} className="w-full" />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {previewData.progressInfo.processedItems}
                    </div>
                    <div className="text-sm text-muted-foreground">Traités</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {previewData.progressInfo.totalItems}
                    </div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {previewData.progressInfo.currentBatch}
                    </div>
                    <div className="text-sm text-muted-foreground">Batch actuel</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {previewData.progressInfo.totalBatches}
                    </div>
                    <div className="text-sm text-muted-foreground">Total batches</div>
                  </div>
                </div>
                
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {previewData.progressInfo.message}
                  </p>
                  {previewData.progressInfo.estimatedTimeRemaining > 0 && (
                    <p className="text-sm text-blue-600 mt-1">
                      Temps estimé restant: {formatDuration(previewData.progressInfo.estimatedTimeRemaining)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Job Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Informations du Job
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm">Créé par</h4>
                  <p className="text-sm text-muted-foreground">
                    {job.user?.name || job.user?.email || 'Utilisateur inconnu'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm">Date de création</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString()}
                  </p>
                </div>
                {job.startedAt && (
                  <div>
                    <h4 className="font-medium text-sm">Démarré le</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(job.startedAt).toLocaleString()}
                    </p>
                  </div>
                )}
                {job.completedAt && (
                  <div>
                    <h4 className="font-medium text-sm">Terminé le</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(job.completedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Tabs */}
          {previewData && (
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary">Résumé</TabsTrigger>
                <TabsTrigger value="explanations">Explications</TabsTrigger>
                <TabsTrigger value="warnings">Avertissements</TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Statistiques de Traitement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{previewData.summary.totalExplanations}</div>
                        <div className="text-sm text-muted-foreground">Total explications</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {previewData.summary.validExplanations}
                        </div>
                        <div className="text-sm text-muted-foreground">Valides</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {previewData.summary.questionsWithAI}
                        </div>
                        <div className="text-sm text-muted-foreground">Avec IA</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {previewData.summary.questionsWithoutAI}
                        </div>
                        <div className="text-sm text-muted-foreground">Sans IA</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="explanations" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Aperçu des Explications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {previewData.explanations.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        Aucune explication disponible pour le moment
                      </p>
                    ) : (
                      <div className="space-y-4 max-h-60 overflow-y-auto">
                        {previewData.explanations.slice(0, 10).map((explanation) => (
                          <div key={explanation.id} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">
                                {explanation.sheet} - Ligne {explanation.rowNumber}
                              </span>
                              <Badge variant={explanation.hasAiAnalysis ? "default" : "secondary"}>
                                {explanation.hasAiAnalysis ? "IA" : "Standard"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {explanation.questionText}
                            </p>
                            <div className="text-xs text-muted-foreground">
                              {explanation.optionExplanations.length} explications d'options
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="warnings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      Avertissements et Problèmes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {previewData.summary.warnings.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        Aucun avertissement
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {previewData.summary.warnings.map((warning, index) => (
                          <div key={index} className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm">{warning}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={loadPreviewData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            
            {job.status === 'completed' && (
              <Button onClick={downloadJobResult}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger le résultat
              </Button>
            )}
            
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}