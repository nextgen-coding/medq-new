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
import { Lecture, Specialty } from '@/types';

interface EditLectureDialogProps {
  lecture: Lecture | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLectureUpdated: () => void;
}

export function EditLectureDialog({ 
  lecture, 
  isOpen, 
  onOpenChange, 
  onLectureUpdated 
}: EditLectureDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [specialtyId, setSpecialtyId] = useState<string>('');
  const [isFree, setIsFree] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    if (lecture) {
      setTitle(lecture.title || '');
      setDescription(lecture.description || '');
      setSpecialtyId(lecture.specialtyId || '');
      setIsFree(lecture.isFree || false);
    }
  }, [lecture]);

  useEffect(() => {
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
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecture) return;

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
      const response = await fetch(`/api/lectures/${lecture.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          specialtyId,
          isFree,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update lecture');
      }

      toast({
        title: t('common.success'),
        description: t('lectures.updatedSuccessfully'),
      });

      onLectureUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating lecture:', error);
      toast({
        title: t('common.error'),
        description: t('common.tryAgain'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('lectures.editLecture')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('common.title')} *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">{t('common.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

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

          <div className="flex items-center space-x-2">
            <Switch
              id="isFree"
              checked={isFree}
              onCheckedChange={setIsFree}
            />
            <Label htmlFor="isFree">{t('lectures.isFree')}</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
