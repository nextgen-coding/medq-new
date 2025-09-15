
import { Button } from '@/components/ui/button';
import { HelpCircle, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EmptyQuestionsStateProps {
  onAddQuestion: () => void;
}

export function EmptyQuestionsState({ onAddQuestion }: EmptyQuestionsStateProps) {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <HelpCircle className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{t('admin.noQuestionsYet')}</h3>
      <p className="text-muted-foreground mt-2 mb-6">
        {t('admin.addYourFirstQuestion')}
      </p>
      <Button 
        onClick={onAddQuestion}
        size="lg"
        className="mt-4"
      >
        <PlusCircle className="h-5 w-5 mr-2" />
        {t('admin.addYourFirstQuestion')}
      </Button>
    </div>
  );
}
