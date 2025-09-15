
import { Button } from '@/components/ui/button';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FormActionButtonsProps {
  isLoading: boolean;
  onCancel: () => void;
  isEdit: boolean;
}

export function FormActionButtons({ isLoading, onCancel, isEdit }: FormActionButtonsProps) {
  const { t } = useTranslation();
  
  return (
    <div className="flex justify-end space-x-3 pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        className="transition-all"
      >
        <X className="h-4 w-4 mr-2" />
        {t('common.cancel')}
      </Button>
      <Button 
        type="submit" 
        disabled={isLoading}
        className="transition-all"
      >
        <Save className="h-4 w-4 mr-2" />
        {isLoading ? t('admin.saving') : (isEdit ? t('admin.updateQuestion') : t('admin.createQuestion'))}
      </Button>
    </div>
  );
}
