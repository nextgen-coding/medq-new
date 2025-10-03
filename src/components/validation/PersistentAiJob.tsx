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
  RefreshCw,
  Trash2,
  Info,
  Activity,
  Terminal,
  StopCircle,
  Pause,
  Play
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
    qrocRows?: number;
    // Detailed breakdown by question type
    qcmCount?: number;      // Regular QCM questions
    casQcmCount?: number;   // Clinical case QCM questions
    qrocCount?: number;     // Regular QROC questions
    casQrocCount?: number;  // Clinical case QROC questions
    sheetsFound?: number;
    sheetsRecognized?: number;
    emptyRowsRemoved?: number;
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
  const [fastMode, setFastMode] = useState(true); // Default to fast mode
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true); // Auto-refresh toggle
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentSession, setCurrentSession] = useState<AiSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<AiSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsJobId, setDetailsJobId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState<any | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const detailsEventRef = useRef<EventSource | null>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
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
      } else {
        const code = response.status;
        if (code === 401) {
          toast.error('Session expirée ou non autorisée', { description: 'Reconnectez-vous pour voir vos sessions AI.' });
        } else if (code === 503) {
          toast.warning('Service temporairement indisponible', { description: 'Le service de sessions est indisponible (DB). Nouvel essai dans 20s.' });
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // Load sessions on mount + periodic refresh (when no active running currentSession)
  useEffect(() => {
    loadRecentSessions();
    
    // Only set up auto-refresh if enabled
    if (autoRefreshEnabled) {
      autoRefreshRef.current = setInterval(() => {
        if (!currentSession || currentSession.phase !== 'running') {
          loadRecentSessions();
        }
      }, 20000);
    } else {
      // When auto-refresh is disabled, close active SSE connections
      if (eventSourceRef.current) {
        console.log('🔌 Closing EventSource: auto-refresh disabled');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
    
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [loadRecentSessions, currentSession, autoRefreshEnabled]);

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
      // Add fast mode preference
      formData.append('fastMode', fastMode ? '1' : '0');

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
        const cd = response.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename="?([^";]+)"?/i);
        const suggested = match ? match[1] : undefined;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = suggested || `ai_fixed_${session.fileName || 'result'}.xlsx`;
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

  // Cleanup EventSource(s) on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (detailsEventRef.current) detailsEventRef.current.close();
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, []);

  // Stop running job
  const stopJob = async (id: string) => {
    setStoppingId(id);
    try {
      const resp = await fetch(`/api/validation/ai-progress?aiId=${encodeURIComponent(id)}&action=stop`, { method: 'POST' });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Arrêt échoué');
      }
      toast.success('Job arrêté', {
        description: 'Le traitement a été interrompu'
      });
      // Close event source if it's the current session
      if (currentSession?.id === id && eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        // Clear current session from UI
        setCurrentSession(null);
      }
      // Close details event source if viewing this job
      if (detailsJobId === id && detailsEventRef.current) {
        detailsEventRef.current.close();
        detailsEventRef.current = null;
      }
      // Refresh sessions list
      await loadRecentSessions();
      // Refresh details if open
      if (detailsJobId === id) {
        const r = await fetch(`/api/validation/ai-progress?aiId=${encodeURIComponent(id)}&action=details`);
        if (r.ok) {
          const d = await r.json();
          setDetailsData(d);
        }
      }
    } catch (e: any) {
      toast.error('Erreur arrêt', { description: e?.message || 'Erreur inconnue' });
    } finally {
      setStoppingId(null);
    }
  };

  // Delete job
  const deleteJob = async (id: string) => {
    setDeletingId(id);
    try {
      const resp = await fetch(`/api/validation/ai-progress?aiId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Suppression échouée');
      }
      toast.success('Job supprimé');
      if (detailsJobId === id) {
        setDetailsOpen(false);
        setDetailsJobId(null);
        setDetailsData(null);
      }
      // Optimistic remove
      setRecentSessions(prev => prev.filter(s => s.id !== id));
      await loadRecentSessions();
    } catch (e: any) {
      toast.error('Erreur suppression', { description: e?.message || 'Erreur inconnue' });
    } finally {
      setConfirmDeleteId(null);
      setDeletingId(null);
    }
  };

  // Open details modal
  const openDetails = async (id: string) => {
    setDetailsJobId(id);
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const r = await fetch(`/api/validation/ai-progress?aiId=${encodeURIComponent(id)}&action=details`);
      if (r.ok) {
        const d = await r.json();
        setDetailsData(d);
        if (d.phase === 'running') {
          if (detailsEventRef.current) detailsEventRef.current.close();
          const es = new EventSource(`/api/validation/ai-progress?aiId=${encodeURIComponent(id)}`);
          detailsEventRef.current = es;
          es.onmessage = (ev) => {
            try {
              const upd = JSON.parse(ev.data);
              setDetailsData((prev: any) => {
                if (!prev) return upd;
                return { ...prev, ...upd, logs: upd.logs || prev.logs || [] };
              });
            } catch {}
          };
          es.onerror = () => { es.close(); };
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
    if (detailsEventRef.current) { detailsEventRef.current.close(); detailsEventRef.current = null; }
  };

  const StatusBadge = ({ phase }: { phase: string }) => {
    const variants: Record<string, { color: string; icon: any }> = {
      queued: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
      running: { color: 'bg-medblue-100 text-medblue-800 dark:bg-medblue-900/30 dark:text-medblue-300', icon: Brain },
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
    <>
    <div className="space-y-4">
        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver 
              ? 'border-medblue-400 bg-medblue-50 dark:bg-medblue-900/20 dark:border-medblue-400' 
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
              isDragOver ? 'text-medblue-500' : file ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'
            }`} />
            <div className="mt-2">
              <p className="text-sm font-medium">
                {file ? file.name : 'Glissez-déposez votre fichier ici'}
              </p>
              <p className="text-xs text-muted-foreground">
                ou cliquez pour sélectionner • Excel (.xlsx, .xls) ou CSV
              </p>
              <p className="text-xs text-medblue-600 mt-1 dark:text-medblue-400">
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

        {/* AI Fast Mode Toggle */}
        <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <label className="text-sm font-semibold text-blue-900 dark:text-blue-100">Mode Rapide IA</label>
                <Badge variant="outline" className="text-xs bg-white/50 dark:bg-black/20">
                  {fastMode ? '⚡ Activé' : '🔄 Qualité Max'}
                </Badge>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                {fastMode ? (
                  <>
                    <strong>Traitement ultra-rapide</strong> (2-3 secondes pour 100 questions). 
                    L'IA génère des explications détaillées sans passe d'amélioration supplémentaire. 
                    Qualité: <strong>85-90%</strong>
                  </>
                ) : (
                  <>
                    <strong>Traitement avec amélioration</strong> (12-33 secondes pour 100 questions). 
                    Les explications courtes sont ré-analysées pour plus de détails. 
                    Qualité: <strong>95-100%</strong>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFastMode(!fastMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                fastMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={fastMode}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  fastMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
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
          <div className="border rounded-lg p-4 bg-medblue-50 dark:bg-medblue-900/20 dark:border-medblue-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <StatusBadge phase={currentSession.phase} />
                <span className="text-sm font-medium">En cours de traitement...</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stopJob(currentSession.id)}
                disabled={stoppingId === currentSession.id}
                className="h-7 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/20"
                title="Arrêter le traitement"
              >
                {stoppingId === currentSession.id ? (
                  <span className="h-3 w-3 rounded-full border-2 border-orange-600 border-t-transparent animate-spin" />
                ) : (
                  <>
                    <StopCircle className="h-3.5 w-3.5 mr-1 text-orange-600" />
                    <span className="text-xs">Arrêter</span>
                  </>
                )}
              </Button>
            </div>
            <Progress value={currentSession.progress} className="w-full mb-2" />
            <p className="text-xs text-muted-foreground">
              {currentSession.message}
            </p>
            {currentSession.stats && (
              <div className="mt-2 space-y-1">
                <div className="text-xs text-muted-foreground">
                  {currentSession.stats.processedBatches}/{currentSession.stats.totalBatches} lots traités
                </div>
                {(currentSession.stats.mcqRows || currentSession.stats.qrocRows) && (
                  <div className="text-xs space-y-1">
                    <div className="font-medium text-blue-700 dark:text-blue-300">
                      {currentSession.stats.mcqRows && `📝 ${currentSession.stats.mcqRows} MCQ`}
                      {currentSession.stats.mcqRows && currentSession.stats.qrocRows && ' • '}
                      {currentSession.stats.qrocRows && `📋 ${currentSession.stats.qrocRows} QROC`}
                      {currentSession.stats.mcqRows && currentSession.stats.qrocRows && 
                        ` • Total: ${currentSession.stats.mcqRows + currentSession.stats.qrocRows}`}
                    </div>
                    {(currentSession.stats.qcmCount || currentSession.stats.casQcmCount || currentSession.stats.qrocCount || currentSession.stats.casQrocCount) && (
                      <div className="text-[10px] text-gray-600 dark:text-gray-400 pl-1">
                        {currentSession.stats.qcmCount ? `📝 ${currentSession.stats.qcmCount} QCM` : ''}
                        {currentSession.stats.qcmCount && currentSession.stats.casQcmCount ? ' + ' : ''}
                        {currentSession.stats.casQcmCount ? `🏫 ${currentSession.stats.casQcmCount} CAS QCM` : ''}
                        {(currentSession.stats.qcmCount || currentSession.stats.casQcmCount) && (currentSession.stats.qrocCount || currentSession.stats.casQrocCount) ? ' | ' : ''}
                        {currentSession.stats.qrocCount ? `📋 ${currentSession.stats.qrocCount} QROC` : ''}
                        {currentSession.stats.qrocCount && currentSession.stats.casQrocCount ? ' + ' : ''}
                        {currentSession.stats.casQrocCount ? `🏫 ${currentSession.stats.casQrocCount} CAS QROC` : ''}
                      </div>
                    )}
                  </div>
                )}
                {currentSession.stats.sheetsRecognized && (
                  <div className="text-xs text-green-600 dark:text-green-400">
                    ✅ {currentSession.stats.sheetsRecognized} feuille{currentSession.stats.sheetsRecognized > 1 ? 's' : ''} reconnue{currentSession.stats.sheetsRecognized > 1 ? 's' : ''}
                  </div>
                )}
                {currentSession.stats.emptyRowsRemoved && currentSession.stats.emptyRowsRemoved > 0 && (
                  <div className="text-xs text-orange-600 dark:text-orange-400">
                    🗑️ {currentSession.stats.emptyRowsRemoved} ligne{currentSession.stats.emptyRowsRemoved > 1 ? 's' : ''} vide{currentSession.stats.emptyRowsRemoved > 1 ? 's' : ''} filtrée{currentSession.stats.emptyRowsRemoved > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recent Sessions */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Sessions Récentes</h3>
            <div className="flex items-center gap-2">
              <Button
                variant={autoRefreshEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                className="h-8"
                title={autoRefreshEnabled ? "Désactiver le rafraîchissement automatique" : "Activer le rafraîchissement automatique"}
              >
                {autoRefreshEnabled ? (
                  <>
                    <Pause className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Auto</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Manuel</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadRecentSessions}
                disabled={loadingSessions}
                className="h-8 w-8 p-0"
                title="Rafraîchir maintenant"
              >
                <RefreshCw className={`h-4 w-4 ${loadingSessions ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune session trouvée
            </p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {recentSessions.slice(0, 10).map((session) => (
                <div key={session.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg dark:bg-gray-800/50 dark:border dark:border-gray-700 gap-2">
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
                      <div className="space-y-0.5">
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                          ✅ {session.stats.fixedCount || 0} corrigées • {session.stats.errorCount || 0} en erreur
                        </p>
                        {(session.stats.mcqRows || session.stats.qrocRows) && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            {session.stats.mcqRows && `${session.stats.mcqRows} MCQ`}
                            {session.stats.mcqRows && session.stats.qrocRows && ' + '}
                            {session.stats.qrocRows && `${session.stats.qrocRows} QROC`}
                            {session.stats.mcqRows && session.stats.qrocRows && 
                              ` = ${session.stats.mcqRows + session.stats.qrocRows} total`}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      {session.createdAt ? new Date(session.createdAt).toLocaleString() : 'Récent'}
                    </p>
                  </div>
                  
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetails(session.id)}
                      className="h-8 w-8 p-0"
                      title="Détails"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                    {session.phase === 'complete' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadSessionResult(session)}
                        className="h-8 w-8 p-0"
                        title="Télécharger"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                    {(session.phase === 'running' || session.phase === 'queued') ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => stopJob(session.id)}
                        className="h-8 w-8 p-0 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/20"
                        title="Arrêter"
                        disabled={stoppingId === session.id}
                      >
                        {stoppingId === session.id ? (
                          <span className="h-3 w-3 rounded-full border-2 border-orange-600 border-t-transparent animate-spin" />
                        ) : (
                          <StopCircle className="h-4 w-4 text-orange-600" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmDeleteId(session.id)}
                        className="h-8 w-8 p-0"
                        title="Supprimer"
                        disabled={deletingId === session.id}
                      >
                        {deletingId === session.id ? <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {detailsOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/40">
            <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg w-full max-w-3xl p-5 relative">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4"/> Détails Job {detailsData?.fileName && <span className="font-normal text-muted-foreground">({detailsData.fileName})</span>}</h2>
                <div className="flex gap-2">
                  {(detailsData?.phase === 'running' || detailsData?.phase === 'queued') && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => detailsData && stopJob(detailsData.id)}
                      disabled={stoppingId === detailsData?.id}
                      className="border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/20"
                    >
                      {stoppingId === detailsData?.id ? (
                        <span className="h-3 w-3 rounded-full border-2 border-orange-600 border-t-transparent animate-spin mr-1" />
                      ) : (
                        <StopCircle className="h-4 w-4 mr-1 text-orange-600" />
                      )}
                      Arrêter
                    </Button>
                  )}
                  {detailsData?.phase === 'complete' && (
                    <Button size="sm" variant="outline" onClick={() => downloadSessionResult(detailsData)}>
                      <Download className="h-4 w-4 mr-1"/> Télécharger
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={closeDetails}>Fermer</Button>
                </div>
              </div>
              {detailsLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}
              {!detailsLoading && detailsData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-2 rounded bg-gray-100 dark:bg-gray-800"><p className="font-medium">Phase</p><p>{detailsData.phase}</p></div>
                    <div className="p-2 rounded bg-gray-100 dark:bg-gray-800"><p className="font-medium">Progression</p><p>{detailsData.progress}%</p></div>
                    <div className="p-2 rounded bg-gray-100 dark:bg-gray-800"><p className="font-medium">✅ Corrigées</p><p>{detailsData.stats?.fixedCount ?? 0}</p></div>
                    <div className="p-2 rounded bg-gray-100 dark:bg-gray-800"><p className="font-medium">❌ Erreurs</p><p>{detailsData.stats?.errorCount ?? 0}</p></div>
                  </div>
                  
                  {detailsData.stats && (detailsData.stats.mcqRows || detailsData.stats.qrocRows || detailsData.stats.sheetsRecognized) && (
                    <div className="space-y-3 border-t pt-3">
                      {/* Primary question type cards - ALWAYS FIRST ROW */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {detailsData.stats.mcqRows && (
                          <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                            <p className="font-medium text-green-700 dark:text-green-300">� MCQ</p>
                            <p className="text-green-900 dark:text-green-100">{detailsData.stats.mcqRows} question{detailsData.stats.mcqRows > 1 ? 's' : ''}</p>
                          </div>
                        )}
                        {detailsData.stats.qrocRows && (
                          <div className="p-2 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                            <p className="font-medium text-purple-700 dark:text-purple-300">� QROC</p>
                            <p className="text-purple-900 dark:text-purple-100">{detailsData.stats.qrocRows} question{detailsData.stats.qrocRows > 1 ? 's' : ''}</p>
                          </div>
                        )}
                        {detailsData.stats.totalRows && (
                          <div className="p-2 rounded bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                            <p className="font-medium text-indigo-700 dark:text-indigo-300">📊 Total</p>
                            <p className="text-indigo-900 dark:text-indigo-100">{detailsData.stats.totalRows} ligne{detailsData.stats.totalRows > 1 ? 's' : ''}</p>
                          </div>
                        )}
                        {detailsData.stats.processedBatches !== undefined && detailsData.stats.totalBatches && (
                          <div className="p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700">
                            <p className="font-medium">🎯 Lots</p>
                            <p>{detailsData.stats.processedBatches} / {detailsData.stats.totalBatches}</p>
                          </div>
                        )}
                      </div>
                      {/* Secondary metadata cards */}
                      {(detailsData.stats.sheetsRecognized || (detailsData.stats.emptyRowsRemoved && detailsData.stats.emptyRowsRemoved > 0)) && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                          {detailsData.stats.sheetsRecognized && (
                            <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                              <p className="font-medium text-blue-700 dark:text-blue-300">� Feuilles</p>
                              <p className="text-blue-900 dark:text-blue-100">{detailsData.stats.sheetsRecognized} reconnue{detailsData.stats.sheetsRecognized > 1 ? 's' : ''}</p>
                            </div>
                          )}
                          {detailsData.stats.emptyRowsRemoved && detailsData.stats.emptyRowsRemoved > 0 && (
                            <div className="p-2 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                              <p className="font-medium text-orange-700 dark:text-orange-300">🗑️ Filtrées</p>
                              <p className="text-orange-900 dark:text-orange-100">{detailsData.stats.emptyRowsRemoved} vide{detailsData.stats.emptyRowsRemoved > 1 ? 's' : ''}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {(detailsData.stats.qcmCount || detailsData.stats.casQcmCount || detailsData.stats.qrocCount || detailsData.stats.casQrocCount) && (
                        <div>
                          <p className="text-xs font-medium mb-2 text-gray-600 dark:text-gray-400">🔍 Détail par type de question</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                            {detailsData.stats.qcmCount !== undefined && detailsData.stats.qcmCount > 0 && (
                              <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                                <p className="font-medium text-emerald-700 dark:text-emerald-300">📝 QCM</p>
                                <p className="text-emerald-900 dark:text-emerald-100">{detailsData.stats.qcmCount}</p>
                              </div>
                            )}
                            {detailsData.stats.casQcmCount !== undefined && detailsData.stats.casQcmCount > 0 && (
                              <div className="p-2 rounded bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                                <p className="font-medium text-teal-700 dark:text-teal-300">🏫 CAS QCM</p>
                                <p className="text-teal-900 dark:text-teal-100">{detailsData.stats.casQcmCount}</p>
                              </div>
                            )}
                            {detailsData.stats.qrocCount !== undefined && detailsData.stats.qrocCount > 0 && (
                              <div className="p-2 rounded bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                                <p className="font-medium text-violet-700 dark:text-violet-300">📋 QROC</p>
                                <p className="text-violet-900 dark:text-violet-100">{detailsData.stats.qrocCount}</p>
                              </div>
                            )}
                            {detailsData.stats.casQrocCount !== undefined && detailsData.stats.casQrocCount > 0 && (
                              <div className="p-2 rounded bg-fuchsia-50 dark:bg-fuchsia-900/20 border border-fuchsia-200 dark:border-fuchsia-800">
                                <p className="font-medium text-fuchsia-700 dark:text-fuchsia-300">🏫 CAS QROC</p>
                                <p className="text-fuchsia-900 dark:text-fuchsia-100">{detailsData.stats.casQrocCount}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs font-medium flex items-center gap-1"><Terminal className="h-3 w-3"/> Logs</p>
                    <div className="border rounded h-56 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-2 text-[11px] leading-relaxed font-mono">
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
    </div>
    <Dialog open={!!confirmDeleteId} onOpenChange={(o)=>{ if(!o) setConfirmDeleteId(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer le job ?</DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Le job sera supprimé définitivement.
          </DialogDescription>
        </DialogHeader>
        <div className="text-xs text-muted-foreground">ID: <code>{confirmDeleteId}</code></div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>setConfirmDeleteId(null)}>Annuler</Button>
          <Button variant="destructive" disabled={!!deletingId} onClick={()=> confirmDeleteId && deleteJob(confirmDeleteId)}>
            {deletingId ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}