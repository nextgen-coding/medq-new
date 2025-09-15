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
  completedAt?: string;
  outputUrl?: string;
}

interface PersistentAiJobProps {
  onJobCreated?: () => void;
}

export function PersistentAiJob({ onJobCreated }: PersistentAiJobProps) {
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [userJobs, setUserJobs] = useState<AiJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user's jobs
  const loadUserJobs = useCallback(async () => {
    try {
      setLoadingJobs(true);
      const response = await fetch('/api/ai-jobs?limit=10');
      if (response.ok) {
        const data = await response.json();
        setUserJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error loading user jobs:', error);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Load jobs on mount
  useEffect(() => {
    loadUserJobs();
  }, [loadUserJobs]);

  // Auto-refresh for active jobs
  useEffect(() => {
    const activeJobs = userJobs.filter(job => ['queued', 'processing'].includes(job.status));
    
    if (activeJobs.length > 0) {
      const interval = setInterval(() => {
        loadUserJobs();
      }, 2000); // 2 second intervals for user jobs
      
      return () => clearInterval(interval);
    }
  }, [userJobs, loadUserJobs]);

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
      toast({
        title: "Format de fichier non supporté",
        description: "Veuillez sélectionner un fichier Excel (.xlsx, .xls) ou CSV",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
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

      const response = await fetch('/api/validation/ai', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Job IA créé avec succès",
          description: `Job ${result.id} en cours de traitement`,
        });
        
        // Reset form
        setFile(null);
        setInstructions('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Refresh jobs and notify parent
        await loadUserJobs();
        onJobCreated?.();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create AI job');
      }
    } catch (error) {
      console.error('AI job creation error:', error);
      toast({
        title: "Erreur de création du job",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const StatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, { color: string; icon: any }> = {
      queued: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      processing: { color: 'bg-blue-100 text-blue-800', icon: Brain },
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

  return (
    <div className="space-y-4">
        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver 
              ? 'border-blue-400 bg-blue-50' 
              : file
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
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
              isDragOver ? 'text-blue-500' : file ? 'text-green-500' : 'text-gray-400'
            }`} />
            <div className="mt-2">
              <p className="text-sm font-medium">
                {file ? file.name : 'Glissez-déposez votre fichier ici'}
              </p>
              <p className="text-xs text-muted-foreground">
                ou cliquez pour sélectionner • Excel (.xlsx, .xls) ou CSV
              </p>
              <p className="text-xs text-blue-600 mt-1">
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
          disabled={!file || isSubmitting}
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

        {/* User Jobs Section */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Mes Jobs Récents</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadUserJobs}
              disabled={loadingJobs}
            >
              <RefreshCw className={`h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {userJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun job trouvé
            </p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {userJobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={job.status} />
                      <span className="text-sm font-medium truncate">{job.fileName}</span>
                    </div>
                    
                    {job.status === 'processing' && (
                      <div className="mb-2">
                        <Progress value={job.progress} className="w-full h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {job.message} ({job.processedItems || 0}/{job.totalItems || 0})
                        </p>
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="flex gap-1 ml-2">
                    {job.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadJobResult(job)}
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