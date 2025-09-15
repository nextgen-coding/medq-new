
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { DialogTrigger } from '@/components/ui/dialog';
import { Lecture } from '@/types';
import { useTranslation } from 'react-i18next';

interface LectureHeaderProps {
  lecture: Lecture | null;
  onBackClick: () => void;
  onAddQuestionClick: () => void;
}

export function LectureHeader({ 
  lecture, 
  onBackClick, 
  onAddQuestionClick 
}: LectureHeaderProps) {
  const { t } = useTranslation();
  
  return (
    <div className="flex justify-between items-center">
      <Button 
        variant="ghost" 
        className="group flex items-center" 
        onClick={onBackClick}
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        {lecture?.specialtyId ? t('lectures.backToSpecialty') : t('common.back')}
      </Button>
      
      <DialogTrigger asChild>
        <Button onClick={onAddQuestionClick}>
          <PlusCircle className="h-4 w-4 mr-2" />
          {t('questions.addQuestion')}
        </Button>
      </DialogTrigger>
    </div>
  );
}
