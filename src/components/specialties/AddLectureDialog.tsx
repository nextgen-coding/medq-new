
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface AddLectureDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  specialtyId: string;
  onLectureAdded: () => void;
}

export function AddLectureDialog({ 
  isOpen, 
  onOpenChange, 
  specialtyId, 
  onLectureAdded 
}: AddLectureDialogProps) {
  const [newLecture, setNewLecture] = useState({
    title: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();

  const handleAddLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!specialtyId) return;
    
    if (!newLecture.title.trim()) {
      toast({
        title: t('specialties.validationError'),
        description: t('specialties.nameRequired'),
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/lectures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newLecture.title,
          description: newLecture.description || null,
          specialtyId: specialtyId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create lecture');
      }
      
      toast({
        title: t('specialties.success'),
        description: t('specialties.specialtyCreated'),
      });
      
      // Reset form and close dialog
      setNewLecture({
        title: '',
        description: ''
      });
      onOpenChange(false);
      
      // Refresh the lectures list
      onLectureAdded();
      
    } catch (error: unknown) {
      console.error('Error creating lecture:', error);
      let errorMessage = t('common.tryAgain');
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('lectures.addLecture')}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleAddLecture} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('specialties.name')}</Label>
            <Input 
              id="title"
              value={newLecture.title}
              onChange={(e) => setNewLecture({...newLecture, title: e.target.value})}
              placeholder={t('specialties.name')}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">{t('specialties.description')}</Label>
            <Input 
              id="description"
              value={newLecture.description}
              onChange={(e) => setNewLecture({...newLecture, description: e.target.value})}
              placeholder={t('specialties.description')}
            />
          </div>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('lectures.creating') : t('lectures.createLecture')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
