'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Edit, Trash2, Plus } from "lucide-react";
import { toast } from '@/hooks/use-toast';
import { EditSessionDialog } from './EditSessionDialog';

type Session = {
  id: string;
  name: string;
  pdfUrl?: string;
  correctionUrl?: string;
  niveauId?: string;
  semesterId?: string;
  specialtyId?: string;
  specialty?: { id: string; name: string };
  niveau?: { id: string; name: string };
  semester?: { id: string; name: string; order: number };
};

type Specialty = {
  id: string;
  name: string;
};

interface ManageSessionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  specialty: Specialty | null;
  onSessionsChanged: () => void;
}

export function ManageSessionsDialog({ 
  isOpen, 
  onOpenChange, 
  specialty,
  onSessionsChanged 
}: ManageSessionsDialogProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Load sessions when dialog opens
  useEffect(() => {
    if (isOpen && specialty) {
      loadSessions();
    }
  }, [isOpen, specialty]);

  const loadSessions = async () => {
    if (!specialty) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sessions/by-specialty/${specialty.id}/index`);
      if (response.ok) {
        const sessionsData = await response.json();
        setSessions(sessionsData);
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de charger les sessions.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors du chargement.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsEditDialogOpen(true);
  };

  const handleDeleteSession = async (session: Session) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la session "${session.name}" ?`)) return;
    
    setDeletingSessionId(session.id);
    
    try {
      // Optimistically update the UI first
      const originalSessions = [...sessions];
      const updatedSessions = sessions.filter(s => s.id !== session.id);
      setSessions(updatedSessions);
      
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Revert the optimistic update if the request failed
        setSessions(originalSessions);
        const errorData = await response.json();
        throw new Error(errorData.error || "Impossible de supprimer la session.");
      }

      toast({
        title: "Succès",
        description: `Session "${session.name}" supprimée avec succès.`,
      });
      
      // Notify parent to refresh session counts
      onSessionsChanged();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur s'est produite lors de la suppression.",
        variant: "destructive",
      });
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleSessionUpdated = async () => {
    // Refresh the sessions list immediately
    await loadSessions();
    // Notify parent to refresh session counts
    onSessionsChanged();
  };

  const handleAddSession = () => {
    // TODO: Implement add session functionality
    toast({
      title: "Fonctionnalité à venir",
      description: "L'ajout de sessions sera disponible prochainement.",
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Gérer les sessions - {specialty?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {sessions.length} session(s) trouvée(s)
              </p>
              <Button onClick={handleAddSession} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une session
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Aucune session trouvée pour cette spécialité.
                </p>
                <Button onClick={handleAddSession} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer la première session
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {session.name}
                      </h4>
                      <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                        {session.niveau && (
                          <p>Niveau: {session.niveau.name}</p>
                        )}
                        {session.semester && (
                          <p>Semestre: {session.semester.name}</p>
                        )}
                        <div className="flex gap-4">
                          {session.pdfUrl && (
                            <span className="text-green-600 dark:text-green-400">PDF</span>
                          )}
                          {session.correctionUrl && (
                            <span className="text-blue-600 dark:text-blue-400">Correction</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSession(session.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSession(session)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        disabled={deletingSessionId === session.id}
                      >
                        {deletingSessionId === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EditSessionDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        sessionId={selectedSessionId}
        onSessionUpdated={handleSessionUpdated}
      />
    </>
  );
}
