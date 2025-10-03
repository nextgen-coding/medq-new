
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface EditLectureDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lecture: any | null;
  onLectureUpdated: () => void;
}

export function EditLectureDialog({ 
  isOpen, 
  onOpenChange, 
  lecture,
  onLectureUpdated 
}: EditLectureDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (lecture) {
      setFormData({
        title: lecture.title || '',
        description: lecture.description || ''
      });
    }
  }, [lecture]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lecture?.id) return;
    
    if (!formData.title.trim()) {
      toast({
        title: 'Erreur de validation',
        description: 'Le titre du cours est requis.',
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch(`/api/lectures/${lecture.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Échec de la mise à jour du cours');
      }
      
      toast({
        title: 'Succès',
        description: 'Le cours a été mis à jour avec succès.',
      });
      
      onOpenChange(false);
      onLectureUpdated();
      
    } catch (error: unknown) {
      console.error('Error updating lecture:', error);
      let errorMessage = 'Veuillez réessayer.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Erreur',
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le cours</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre du cours *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Entrer le titre du cours"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Entrer une description du cours"
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
