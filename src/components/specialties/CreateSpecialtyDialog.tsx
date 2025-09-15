import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SpecialtyIconCustomizer } from '@/components/ui/specialty-icon-customizer';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Niveau } from '@/types';
import { getIconBySpecialtyName } from '@/lib/medical-icons';

interface CreateSpecialtyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSpecialtyCreated: () => void;
}

export function CreateSpecialtyDialog({ 
  isOpen, 
  onOpenChange, 
  onSpecialtyCreated 
}: CreateSpecialtyDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconData, setIconData] = useState<{
    icon?: string;
    iconColor?: string;
    iconType: 'icon' | 'image';
    imageUrl?: string;
  }>({ 
    iconType: 'icon', 
    icon: 'heart', 
    iconColor: '#2563eb' 
  });
  const [niveauId, setNiveauId] = useState<string>('');
  const [semesterId, setSemesterId] = useState<string>('');
  const [isFree, setIsFree] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [semesters, setSemesters] = useState<Array<{ id: string; name: string; order: number; niveauId: string }>>([]);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchNiveaux = async () => {
      try {
        const response = await fetch('/api/niveaux');
        if (response.ok) {
          const data = await response.json();
          setNiveaux(data);
        }
      } catch (error) {
        console.error('Error fetching niveaux:', error);
      }
    };

    if (isOpen) {
      fetchNiveaux();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const url = niveauId ? `/api/semesters?niveauId=${niveauId}` : '/api/semesters';
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setSemesters(data);
        }
      } catch (error) {
        console.error('Error fetching semesters:', error);
      }
    };
    if (isOpen) {
      fetchSemesters();
    }
  }, [isOpen, niveauId]);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setName('');
      setDescription('');
      setIconData({ 
        iconType: 'icon', 
        icon: 'heart', 
        iconColor: '#2563eb' 
      });
      setNiveauId('');
      setSemesterId('');
      setIsFree(true);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: t('common.error'),
        description: t('common.nameRequired'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Auto-suggest icon if none selected and using icon mode
      const finalIcon = iconData.iconType === 'icon' 
        ? (iconData.icon || getIconBySpecialtyName(name).name)
        : undefined;
      
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        icon: finalIcon,
        iconColor: iconData.iconColor || null,
        iconType: iconData.iconType,
        imageUrl: iconData.imageUrl || null,
        niveauId: niveauId || null,
        semesterId: semesterId || null,
        isFree,
      };

      console.log('Creating specialty with payload:', payload);
      
      const response = await fetch('/api/specialties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Failed to create specialty');
      }

      toast({
        title: t('common.success'),
        description: t('specialties.createdSuccessfully'),
      });

      onSpecialtyCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating specialty:', error);
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto backdrop-blur-sm bg-white/95 dark:bg-gray-900/95 border-blue-200 dark:border-blue-800">
        <DialogHeader className="border-b border-blue-100/80 dark:border-blue-900/40 bg-gradient-to-b from-blue-50/60 to-transparent dark:from-blue-950/30">
          <DialogTitle className="text-2xl font-bold text-blue-700 dark:text-blue-400">
            {t('specialties.addSpecialty')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('common.name')} *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('specialties.enterName')}
              className="border-blue-200 dark:border-blue-800 focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">{t('common.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('specialties.enterDescription')}
              rows={3}
              className="border-blue-200 dark:border-blue-800 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <SpecialtyIconCustomizer
            value={iconData}
            onChange={setIconData}
            label={t('specialties.icon')}
          />

          <div className="space-y-2">
            <Label htmlFor="niveau">{t('common.niveau')}</Label>
            <Select value={niveauId || "none"} onValueChange={(value) => setNiveauId(value === "none" ? "" : value)}>
              <SelectTrigger className="border-blue-200 dark:border-blue-800 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder={t('common.selectNiveau')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('common.noNiveau')}</SelectItem>
                {niveaux.map((niveau) => (
                  <SelectItem key={niveau.id} value={niveau.id}>
                    {niveau.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="semester">Semester</Label>
            <Select value={semesterId || "none"} onValueChange={(value) => setSemesterId(value === "none" ? "" : value)}>
              <SelectTrigger className="border-blue-200 dark:border-blue-800 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Select semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No semester</SelectItem>
                {semesters.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} (#{s.order})
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
            <Label htmlFor="isFree">{t('specialties.isFree')}</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              {t('common.cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              {isLoading ? t('common.creating') : t('common.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
