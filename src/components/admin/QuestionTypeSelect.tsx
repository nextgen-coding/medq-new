
import { Label } from '@/components/ui/label';
import { HelpCircle, PenLine } from 'lucide-react';
import { QuestionType } from '@/types';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// New pill style option button
interface OptionButtonProps {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
}

const OptionButton = ({ active, label, icon, onClick, className }: OptionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group relative flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
      active ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 shadow-sm' : 'border-border',
      className
    )}
  >
    <span className={cn('flex items-center justify-center', active && 'text-blue-600 dark:text-blue-300')}>{icon}</span>
    <span className="font-medium leading-none tracking-wide">{label}</span>
  </button>
);

interface QuestionTypeSelectProps {
  questionType: QuestionType;
  setQuestionType: (type: QuestionType) => void;
}

export function QuestionTypeSelect({ questionType, setQuestionType }: QuestionTypeSelectProps) {
  const { t } = useTranslation();

  // Only allow standard MCQ & QROC selection here now.
  const isClinic = questionType === 'clinic_mcq' || questionType === 'clinic_croq';
  const selectBase = (val: 'mcq' | 'qroc') => {
    if (val === 'mcq') setQuestionType('mcq');
    else setQuestionType('qroc');
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{t('admin.questionType')}</Label>
      {!isClinic && (
        <div className="flex flex-wrap gap-2">
          <OptionButton
            active={questionType === 'mcq'}
            label={t('questions.mcq') || 'QCM'}
            icon={<HelpCircle className="h-4 w-4" />}
            onClick={()=>selectBase('mcq')}
          />
          <OptionButton
            active={questionType === 'qroc'}
            label={t('questions.open') || 'QROC'}
            icon={<PenLine className="h-4 w-4" />}
            onClick={()=>selectBase('qroc')}
          />
        </div>
      )}
      {isClinic && (
        <div className="text-xs text-muted-foreground italic">Cas clinique (type verrouillé)</div>
      )}
      {questionType === 'qroc' && (
        <div className="pl-1 space-y-2 animate-in fade-in-50">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modes QROC</div>
          <p className="text-xs text-muted-foreground leading-relaxed">Utilisez le parsing automatique ou ajoutez plusieurs sous-questions via l'outil multi QROC (bientôt intégré ici).</p>
        </div>
      )}
      <Separator className="mt-2" />
    </div>
  );
}
