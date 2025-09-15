
import { ChangeEvent, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';

interface OpenQuestionInputProps {
  answer: string;
  setAnswer: (answer: string) => void;
  isSubmitted: boolean;
  onSubmit?: () => void; // optional submit handler for Enter key
  onBlur?: (answer: string) => void; // callback when leaving input field
}

export function OpenQuestionInput({ answer, setAnswer, isSubmitted, onSubmit, onBlur }: OpenQuestionInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-focus on the textarea when component mounts and not submitted
  useEffect(() => {
    if (!isSubmitted && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isSubmitted]);
  
  const handleAnswerChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (isSubmitted) return;
    setAnswer(e.target.value);
  };

  const handleBlur = () => {
    if (isSubmitted) return;
    if (onBlur) {
      onBlur(answer);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSubmitted) return; // textarea is typically disabled when submitted, but guard anyway
    // Shift+Enter should insert a newline; plain Enter should submit (even if empty)
    if (e.key === 'Enter' && !e.shiftKey) {
      // Prevent newline insertion
      e.preventDefault();
      if (onSubmit) {
        onSubmit(); // Allow submission even with empty answer
      }
    }
  };
  
  return (
    <div className="space-y-1 w-full">
      <Textarea
        ref={textareaRef}
        placeholder={t('questions.answerText')}
        value={answer}
        onChange={handleAnswerChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        rows={3}
        disabled={isSubmitted}
        className={`
          resize-none transition-all duration-200 w-full max-w-full min-h-[60px] text-sm
          ${isSubmitted ? 'bg-muted' : ''}
        `}
      />
    </div>
  );
}
