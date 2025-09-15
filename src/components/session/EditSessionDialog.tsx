'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Semester, Niveau } from '@/types';

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
  niveauId?: string;
  semesterId?: string;
};

interface EditSessionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string;
  onSessionUpdated: () => void;
}

export function EditSessionDialog({ 
  isOpen, 
  onOpenChange, 
  sessionId,
  onSessionUpdated 
}: EditSessionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    pdfUrl: '',
    correctionUrl: '',
    niveauId: '',
    semesterId: '',
    specialtyId: '',
  });

  // Load session data when dialog opens
  useEffect(() => {
    if (isOpen && sessionId) {
      loadSessionData();
      loadFilterData();
    }
  }, [isOpen, sessionId]);

  const loadSessionData = async () => {
    if (!sessionId) return;
    
    setIsLoadingData(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (response.ok) {
        const sessionData = await response.json();
        setSession(sessionData);
        setFormData({
          name: sessionData.name || '',
          pdfUrl: sessionData.pdfUrl || '',
          correctionUrl: sessionData.correctionUrl || '',
          niveauId: sessionData.niveauId || '',
          semesterId: sessionData.semesterId || '',
          specialtyId: sessionData.specialtyId || '',
        });
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de charger les données de la session.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading session:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors du chargement.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadFilterData = async () => {
    try {
      // Load specialties
      const specialtyRes = await fetch('/api/specialties');
      if (specialtyRes.ok) {
        const specialtyData = await specialtyRes.json();
        setSpecialties(specialtyData || []);
      }

      // Load niveaux
      const niveauRes = await fetch('/api/niveaux');
      if (niveauRes.ok) {
        const niveauData = await niveauRes.json();
        setNiveaux(niveauData || []);
      }

      // Load semesters
      const semesterRes = await fetch('/api/semesters');
      if (semesterRes.ok) {
        const semesterData = await semesterRes.json();
        setSemesters(semesterData || []);
      }
    } catch (error) {
      console.error('Error loading filter data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          pdfUrl: formData.pdfUrl || null,
          correctionUrl: formData.correctionUrl || null,
          niveauId: formData.niveauId || null,
          semesterId: formData.semesterId || null,
          specialtyId: formData.specialtyId || null,
        }),
      });

      if (response.ok) {
        const updatedSession = await response.json();
        
        // Update the session data locally
        setSession(updatedSession);
        
        toast({
          title: "Succès",
          description: "Session mise à jour avec succès.",
        });
        onSessionUpdated();
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        toast({
          title: "Erreur",
          description: errorData.error || "Impossible de mettre à jour la session.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating session:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de la mise à jour.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Filter semesters based on selected niveau
  const filteredSemesters = semesters.filter(semester => 
    !formData.niveauId || semester.niveauId === formData.niveauId
  );

  // Filter specialties based on selected niveau and semester
  const filteredSpecialties = specialties.filter(specialty => {
    if (formData.niveauId && specialty.niveauId !== formData.niveauId) return false;
    if (formData.semesterId && specialty.semesterId !== formData.semesterId) return false;
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifier la session</DialogTitle>
        </DialogHeader>

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la session *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Nom de la session"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="niveau">Niveau</Label>
              <Select 
                value={formData.niveauId} 
                onValueChange={(value) => {
                  handleInputChange('niveauId', value);
                  // Reset semester and specialty when niveau changes
                  handleInputChange('semesterId', '');
                  handleInputChange('specialtyId', '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun niveau</SelectItem>
                  {niveaux.map((niveau) => (
                    <SelectItem key={niveau.id} value={niveau.id}>
                      {niveau.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="semester">Semestre</Label>
              <Select 
                value={formData.semesterId} 
                onValueChange={(value) => {
                  handleInputChange('semesterId', value);
                  // Reset specialty when semester changes
                  handleInputChange('specialtyId', '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un semestre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun semestre</SelectItem>
                  {filteredSemesters.map((semester) => (
                    <SelectItem key={semester.id} value={semester.id}>
                      {semester.name} {typeof semester.order === 'number' ? `(S${semester.order})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Spécialité</Label>
              <Select 
                value={formData.specialtyId} 
                onValueChange={(value) => handleInputChange('specialtyId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une spécialité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucune spécialité</SelectItem>
                  {filteredSpecialties.map((specialty) => (
                    <SelectItem key={specialty.id} value={specialty.id}>
                      {specialty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdfUrl">URL du PDF</Label>
              <Input
                id="pdfUrl"
                value={formData.pdfUrl}
                onChange={(e) => handleInputChange('pdfUrl', e.target.value)}
                placeholder="https://example.com/session.pdf"
                type="url"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correctionUrl">URL de la correction</Label>
              <Input
                id="correctionUrl"
                value={formData.correctionUrl}
                onChange={(e) => handleInputChange('correctionUrl', e.target.value)}
                placeholder="https://example.com/correction.pdf"
                type="url"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading || !formData.name.trim()}>
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Mise à jour...
                  </>
                ) : (
                  'Mettre à jour'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
