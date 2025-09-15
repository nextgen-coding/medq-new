
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EmptyLectureStateProps {
  onAddQuestion: () => void;
}

export function EmptyLectureState({ onAddQuestion }: EmptyLectureStateProps) {
  const { t } = useTranslation();
  
  return (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold">{t('lectures.noQuestions')}</h2>
      <p className="text-muted-foreground mt-2 mb-6">
        {t('lectures.emptyLectureMessage')}
      </p>
      <div className="flex justify-center">
        <Button 
          onClick={onAddQuestion}
          size="lg"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          {t('lectures.addFirstQuestion')}
        </Button>
      </div>
    </div>
  );
}
