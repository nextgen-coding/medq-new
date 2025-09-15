
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconSelector } from '@/components/ui/icon-selector';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getIconBySpecialtyName } from '@/lib/medical-icons';

interface AddSpecialtyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSpecialtyAdded: () => void;
}

export function AddSpecialtyDialog({ 
  isOpen, 
  onOpenChange, 
  onSpecialtyAdded 
}: AddSpecialtyDialogProps) {
  const { isAdmin, user } = useAuth();
  const [newSpecialty, setNewSpecialty] = useState({
    name: '',
    description: '',
    icon: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();

  const handleAddSpecialty = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast({
        title: t('auth.accessDenied'),
        description: t('auth.adminRequired'),
        variant: "destructive",
      });
      return;
    }
    
    if (!newSpecialty.name.trim()) {
      toast({
        title: t('specialties.validationError'),
        description: t('specialties.nameRequired'),
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Auto-suggest icon if none selected
      const finalIcon = newSpecialty.icon || getIconBySpecialtyName(newSpecialty.name).name;
      
      const response = await fetch('/api/specialties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newSpecialty.name.trim(),
          description: newSpecialty.description.trim() || null,
          icon: finalIcon
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create specialty');
      }
      
      toast({
        title: t('specialties.success'),
        description: t('specialties.specialtyCreated'),
      });
      
      // Reset form and close dialog
      setNewSpecialty({
        name: '',
        description: '',
        icon: ''
      });
      onOpenChange(false);
      
      // Refresh the specialties list
      onSpecialtyAdded();
      
    } catch (error: unknown) {
      console.error('Error creating specialty:', error);
      let errorMessage = t('common.tryAgain');
      
      if (error instanceof Error && error.message) {
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

  if (!isAdmin) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('specialties.addSpecialty')}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleAddSpecialty} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('specialties.name')}</Label>
            <Input 
              id="name"
              value={newSpecialty.name}
              onChange={(e) => setNewSpecialty({...newSpecialty, name: e.target.value})}
              placeholder={t('specialties.namePlaceholder')}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">{t('specialties.description')}</Label>
            <Input 
              id="description"
              value={newSpecialty.description}
              onChange={(e) => setNewSpecialty({...newSpecialty, description: e.target.value})}
              placeholder={t('specialties.descriptionPlaceholder')}
            />
          </div>
          
          <IconSelector
            value={newSpecialty.icon}
            onChange={(icon) => setNewSpecialty({...newSpecialty, icon})}
            label={t('specialties.icon')}
          />
          
          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('specialties.creating') : t('specialties.createSpecialty')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
