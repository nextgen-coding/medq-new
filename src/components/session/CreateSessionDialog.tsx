'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

interface Specialty {
  id: string;
  name: string;
  niveauId?: string;
  semesterId?: string;
}

interface Niveau {
  id: string;
  name: string;
}

interface Semester {
  id: string;
  name: string;
  order: number;
  niveauId: string;
}

interface CreateSessionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  specialtyId?: string;
  onSessionCreated: () => void;
}

export function CreateSessionDialog({ 
  isOpen, 
  onOpenChange, 
  specialtyId,
  onSessionCreated 
}: CreateSessionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    pdfUrl: '',
    correctionUrl: '',
    niveauId: '',
    semesterId: '',
    specialtyId: specialtyId || '',
    isFree: false,
  });

  // Load filter data when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadFilterData();
      // Reset form when dialog opens
      setFormData({
        name: '',
        pdfUrl: '',
        correctionUrl: '',
        niveauId: '',
        semesterId: '',
        specialtyId: specialtyId || '',
        isFree: false,
      });
    }
  }, [isOpen, specialtyId]);

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

    if (!formData.name.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom de la session est requis.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
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
          isFree: formData.isFree,
        }),
      });

      if (response.ok) {
        toast({
          title: "Succès",
          description: "Session créée avec succès.",
        });
        onSessionCreated();
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        toast({
          title: "Erreur",
          description: errorData.error || "Impossible de créer la session.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de la création.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Filter semesters based on selected niveau
  const filteredSemesters = formData.niveauId
    ? semesters.filter(s => s.niveauId === formData.niveauId)
    : semesters;

  // Filter specialties based on selected niveau and semester
  // Show all specialties if no filters, otherwise filter by available criteria
  const filteredSpecialties = specialties.filter(specialty => {
    // If no niveau selected, show all specialties
    if (!formData.niveauId) return true;
    
    // If niveau selected, filter by niveau (if specialty has niveauId)
    if (specialty.niveauId && specialty.niveauId !== formData.niveauId) return false;
    
    // If semester also selected, filter by semester (if specialty has semesterId)
    if (formData.semesterId && specialty.semesterId && specialty.semesterId !== formData.semesterId) return false;
    
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle session</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la session *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Ex: Session 2024"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdfUrl">URL du PDF</Label>
              <Input
                id="pdfUrl"
                type="url"
                value={formData.pdfUrl}
                onChange={(e) => handleInputChange('pdfUrl', e.target.value)}
                placeholder="https://example.com/session.pdf"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correctionUrl">URL de correction</Label>
              <Input
                id="correctionUrl"
                type="url"
                value={formData.correctionUrl}
                onChange={(e) => handleInputChange('correctionUrl', e.target.value)}
                placeholder="https://example.com/correction.pdf"
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
                  {filteredSpecialties.map((specialty) => (
                    <SelectItem key={specialty.id} value={specialty.id}>
                      {specialty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isFree"
                checked={formData.isFree}
                onCheckedChange={(checked) => handleInputChange('isFree', checked as boolean)}
              />
              <Label
                htmlFor="isFree"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Session gratuite pour tous les utilisateurs
              </Label>
            </div>
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
              {isLoading ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
