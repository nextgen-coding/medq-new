
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QuestionType } from '@/types';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';

interface QuestionFieldsProps {
  questionText: string;
  setQuestionText: (text: string) => void;
  courseReminder: string;
  setCourseReminder: (text: string) => void;
  questionType: QuestionType;
  questionNumber: number | undefined;
  setQuestionNumber: (number: number | undefined) => void;
  session: string;
  setSession: (session: string) => void;
}

export function QuestionFields({ 
  questionText, 
  setQuestionText, 
  courseReminder, 
  setCourseReminder,
  questionType,
  questionNumber,
  setQuestionNumber,
  session,
  setSession
}: QuestionFieldsProps) {
  const { t } = useTranslation();
  
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <Label htmlFor="question-number">{t('questions.questionNumber')}</Label>
          <Input 
            id="question-number"
            type="number"
            placeholder={t('questions.questionNumber')}
            value={questionNumber === undefined ? '' : questionNumber}
            onChange={(e) => {
              const value = e.target.value;
              setQuestionNumber(value === '' ? undefined : parseInt(value, 10));
            }}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="session">{t('questions.session')}</Label>
          <Input 
            id="session"
            placeholder="e.g., Session 2022"
            value={session}
            onChange={(e) => setSession(e.target.value)}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="question-text">{t('questions.questionText')}</Label>
        <Textarea
          id="question-text"
          placeholder={t('questions.questionText')}
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          required
          className="min-h-24"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="course-reminder">
          {questionType === 'mcq' ? t('questions.courseReminder') : t('questions.referenceAnswer')}
        </Label>
        <Textarea
          id="course-reminder"
          placeholder={questionType === 'mcq' 
            ? t('questions.courseReminder')
            : t('questions.referenceAnswer')}
          value={courseReminder}
          onChange={(e) => setCourseReminder(e.target.value)}
          className="min-h-32"
        />
      </div>
    </>
  );
}
