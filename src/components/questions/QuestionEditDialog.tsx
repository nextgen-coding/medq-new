
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Question } from '@/types';
import { useQuestionEdit } from './edit/useQuestionEdit';
import { QuestionEditContent } from './edit/QuestionEditContent';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';

interface QuestionEditDialogProps {
  question: Question | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onQuestionUpdated: () => void;
}

export function QuestionEditDialog({ 
  question, 
  isOpen, 
  onOpenChange,
  onQuestionUpdated
}: QuestionEditDialogProps) {
  const { t } = useTranslation();
  const {
    isLoading,
    questionText,
    setQuestionText,
    courseReminder,
    setCourseReminder,
    questionNumber,
    setQuestionNumber,
    session,
    setSession,
    options,
    correctAnswers,
    mediaUrl,
    mediaType,
    handleMediaChange,
  reminderMediaUrl,
  reminderMediaType,
  handleReminderMediaChange,
    updateOptionText,
    updateOptionExplanation,
    toggleCorrectAnswer,
  setCorrectAnswers,
  handleSubmit,
  images,
  setImages
  } = useQuestionEdit({
    question,
    onOpenChange,
    onQuestionUpdated
  });

  if (!question) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t('questions.editQuestion')}</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <QuestionEditContent
            question={question}
            questionText={questionText}
            setQuestionText={setQuestionText}
            courseReminder={courseReminder}
            setCourseReminder={setCourseReminder}
            questionNumber={questionNumber}
            setQuestionNumber={setQuestionNumber}
            session={session}
            setSession={setSession}
            options={options}
            updateOptionText={updateOptionText}
            updateOptionExplanation={updateOptionExplanation}
            correctAnswers={correctAnswers}
            toggleCorrectAnswer={toggleCorrectAnswer}
            setCorrectAnswers={setCorrectAnswers}
            mediaUrl={mediaUrl}
            mediaType={mediaType}
            handleMediaChange={handleMediaChange}
            reminderMediaUrl={reminderMediaUrl}
            reminderMediaType={reminderMediaType}
            handleReminderMediaChange={handleReminderMediaChange}
            isLoading={isLoading}
            onCancel={() => onOpenChange(false)}
            onSubmit={handleSubmit}
            images={images}
            onImagesChange={setImages}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
