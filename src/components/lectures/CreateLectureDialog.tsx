import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Specialty } from '@/types';

interface CreateLectureDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLectureCreated: () => void;
  preselectedSpecialty?: Specialty;
}

export function CreateLectureDialog({ 
  isOpen, 
  onOpenChange, 
  onLectureCreated,
  preselectedSpecialty
}: CreateLectureDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [specialtyId, setSpecialtyId] = useState<string>('');
  const [isFree, setIsFree] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    if (preselectedSpecialty) {
      setSpecialtyId(preselectedSpecialty.id);
    } else {
      const fetchSpecialties = async () => {
        try {
          const response = await fetch('/api/specialties');
          if (response.ok) {
            const data = await response.json();
            setSpecialties(data);
          }
        } catch (error) {
          console.error('Error fetching specialties:', error);
        }
      };

      if (isOpen) {
        fetchSpecialties();
      }
    }
  }, [isOpen, preselectedSpecialty]);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setTitle('');
      setDescription('');
      if (!preselectedSpecialty) {
        setSpecialtyId('');
      }
      setIsFree(true);
    }
  }, [isOpen, preselectedSpecialty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: t('common.error'),
        description: t('common.titleRequired'),
        variant: "destructive",
      });
      return;
    }

    if (!specialtyId) {
      toast({
        title: t('common.error'),
        description: t('lectures.specialtyRequired'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        specialtyId,
        isFree,
      };

      console.log('Creating lecture with payload:', payload);

      const response = await fetch('/api/lectures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Failed to create lecture');
      }

      toast({
        title: t('common.success'),
        description: t('lectures.createdSuccessfully'),
      });

      onLectureCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating lecture:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('common.tryAgain'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-blue-200/60 dark:border-blue-900/40">
        <DialogHeader className="border-b border-blue-100/80 dark:border-blue-900/40 bg-gradient-to-b from-blue-50/60 to-transparent dark:from-blue-950/30">
          <DialogTitle className="text-blue-700 dark:text-blue-400">{t('lectures.addLecture')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('common.title')} *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('lectures.enterTitle')}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">{t('common.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('lectures.enterDescription')}
              rows={3}
            />
          </div>

          {preselectedSpecialty ? (
            <div className="space-y-2">
              <Label>{t('common.specialty')}</Label>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <span className="text-blue-700 dark:text-blue-300 font-medium">{preselectedSpecialty.name}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="specialty">{t('common.specialty')} *</Label>
              <Select value={specialtyId || "none"} onValueChange={(value) => setSpecialtyId(value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('lectures.selectSpecialty')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('lectures.selectSpecialty')}</SelectItem>
                  {specialties.map((specialty) => (
                    <SelectItem key={specialty.id} value={specialty.id}>
                      {specialty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="isFree"
              checked={isFree}
              onCheckedChange={setIsFree}
            />
            <Label htmlFor="isFree">{t('lectures.isFree')}</Label>
          </div>

          <div className="flex justify-end space-x-2 border-t pt-4 border-blue-100/80 dark:border-blue-900/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="border-blue-200 dark:border-blue-800"
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              {isLoading ? t('common.creating') : t('common.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
