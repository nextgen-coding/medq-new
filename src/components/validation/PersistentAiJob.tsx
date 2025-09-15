"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileText, 
  Brain, 
  Clock, 
  CheckCircle, 
  XCircle,
  Download,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface AiSession {
  id: string;
  phase: 'queued' | 'running' | 'complete' | 'error';
  progress: number;
  message: string;
  logs: string[];
  fileName?: string;
  createdAt?: number;
  lastUpdated?: number;
  stats?: {
    totalRows: number;
    mcqRows: number;
    processedBatches: number;
    totalBatches: number;
    fixedCount?: number;
    errorCount?: number;
    reasonCounts?: Record<string, number>;
    errorsPreview?: Array<{ sheet: string; row: number; reason: string; question?: string; questionNumber?: number | null }>;
  };
  error?: string;
}

interface PersistentAiJobProps {
  onJobCreated?: () => void;
}

export function PersistentAiJob({ onJobCreated }: PersistentAiJobProps) {
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentSession, setCurrentSession] = useState<AiSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<AiSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load recent sessions
  const loadRecentSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      const response = await fetch('/api/validation/ai-progress?action=list');
      if (response.ok) {
        const data = await response.json();
        setRecentSessions(data.jobs || []);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // Load sessions on mount
  useEffect(() => {
    loadRecentSessions();
  }, [loadRecentSessions]);

  // File drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(file => 
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'text/csv' ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.name.endsWith('.csv')
    );

    if (validFile) {
      setFile(validFile);
    } else {
      toast.error("Format de fichier non supporté", {
        description: "Veuillez sélectionner un fichier Excel (.xlsx, .xls) ou CSV",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  // Start streaming AI session
  const startAiSession = async (aiId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/validation/ai-progress?aiId=${encodeURIComponent(aiId)}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setCurrentSession(data);

        if (data.phase === 'complete') {
          toast.success("Traitement IA terminé", {
            description: `${data.stats?.fixedCount || 0} questions corrigées`,
          });
          eventSource.close();
          loadRecentSessions();
          onJobCreated?.();
        } else if (data.phase === 'error') {
          toast.error("Erreur dans le traitement IA", {
            description: data.error || "Une erreur est survenue",
          });
          eventSource.close();
          loadRecentSessions();
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
    };
  };

  const createAiJob = async () => {
    if (!file) return;

    try {
      setIsSubmitting(true);
      
      const formData = new FormData();
      formData.append('file', file);
      if (instructions.trim()) {
        formData.append('instructions', instructions);
      }

      const response = await fetch('/api/validation/ai-progress', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast.success("Job IA créé avec succès", {
          description: `Job ${result.aiId} en cours de traitement`,
        });
        
        // Start streaming updates
        await startAiSession(result.aiId);
        
        // Reset form
        setFile(null);
        setInstructions('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create AI job');
      }
    } catch (error) {
      console.error('AI job creation error:', error);
      toast.error("Erreur de création du job", {
        description: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadSessionResult = async (session: AiSession) => {
    try {
      const response = await fetch(`/api/validation/ai-progress?aiId=${encodeURIComponent(session.id)}&action=download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `ai_fixed_${session.fileName || 'result'}.xlsx`;
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

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const StatusBadge = ({ phase }: { phase: string }) => {
    const variants: Record<string, { color: string; icon: any }> = {
      queued: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
      running: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Brain },
      complete: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
      error: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
    };

    const variant = variants[phase] || variants.queued;
    const Icon = variant.icon;

    return (
      <Badge className={`${variant.color} border-0`}>
        <Icon className="w-3 h-3 mr-1" />
        {phase === 'queued' ? 'En attente' :
         phase === 'running' ? 'En cours' :
         phase === 'complete' ? 'Terminé' :
         'Erreur'}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver 
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' 
              : file
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400'
                : 'border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
            id="ai-file"
          />
          <label htmlFor="ai-file" className="cursor-pointer">
            <Brain className={`mx-auto h-12 w-12 ${
              isDragOver ? 'text-blue-500' : file ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'
            }`} />
            <div className="mt-2">
              <p className="text-sm font-medium">
                {file ? file.name : 'Glissez-déposez votre fichier ici'}
              </p>
              <p className="text-xs text-muted-foreground">
                ou cliquez pour sélectionner • Excel (.xlsx, .xls) ou CSV
              </p>
              <p className="text-xs text-blue-600 mt-1 dark:text-blue-400">
                Traitement IA avec explications détaillées
              </p>
            </div>
          </label>
        </div>

        {/* Custom Instructions */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Instructions personnalisées (optionnel)</label>
          <Textarea
            placeholder="Ajoutez des instructions spécifiques pour l'IA (ex: focus sur la cardiologie, style académique, etc.)"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Submit Button */}
        <Button 
          onClick={createAiJob} 
          disabled={!file || isSubmitting || Boolean(currentSession?.phase === 'running')}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Création du job...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Créer un job IA
            </>
          )}
        </Button>

        {/* Current Session Progress */}
        {currentSession && currentSession.phase === 'running' && (
          <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge phase={currentSession.phase} />
              <span className="text-sm font-medium">En cours de traitement...</span>
            </div>
            <Progress value={currentSession.progress} className="w-full mb-2" />
            <p className="text-xs text-muted-foreground">
              {currentSession.message}
            </p>
            {currentSession.stats && (
              <div className="text-xs text-muted-foreground mt-1">
                {currentSession.stats.processedBatches}/{currentSession.stats.totalBatches} lots traités
                {currentSession.stats.mcqRows && ` • ${currentSession.stats.mcqRows} questions MCQ`}
              </div>
            )}
          </div>
        )}

        {/* Recent Sessions */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Sessions Récentes</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadRecentSessions}
              disabled={loadingSessions}
            >
              <RefreshCw className={`h-4 w-4 ${loadingSessions ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune session trouvée
            </p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {recentSessions.slice(0, 5).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg dark:bg-gray-800/50 dark:border dark:border-gray-700">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge phase={session.phase} />
                      <span className="text-sm font-medium truncate">{session.fileName || 'Fichier'}</span>
                    </div>
                    
                    {session.phase === 'running' && (
                      <div className="mb-2">
                        <Progress value={session.progress} className="w-full h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {session.message}
                        </p>
                      </div>
                    )}
                    
                    {session.phase === 'complete' && session.stats && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {session.stats.fixedCount || 0} corrigées • {session.stats.errorCount || 0} en erreur
                      </p>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      {session.createdAt ? new Date(session.createdAt).toLocaleString() : 'Récent'}
                    </p>
                  </div>
                  
                  <div className="flex gap-1 ml-2">
                    {session.phase === 'complete' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadSessionResult(session)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}