
import { ChangeEvent, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';

interface OpenQuestionInputProps {
  answer: string;
  setAnswer: (answer: string) => void;
  isSubmitted: boolean;
  onSubmit?: () => void; // optional submit handler for Enter key
  onBlur?: (answer: string) => void; // callback when leaving input field
  isActive?: boolean; // whether this question is currently active/focused
  disableEnterKey?: boolean; // when true, defer Enter handling to parent
}

export function OpenQuestionInput({ answer, setAnswer, isSubmitted, onSubmit, onBlur, isActive = false, disableEnterKey = false }: OpenQuestionInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on the textarea only when this question becomes active and not submitted
  useEffect(() => {
    if (!isSubmitted && isActive && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isSubmitted, isActive]);
  
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
    
    // In grouped mode (clinical cases), defer Enter handling to parent
    if (disableEnterKey && e.key === 'Enter') {
      if (!e.shiftKey) {
        // Blur the textarea to allow smooth navigation to next question
        if (textareaRef.current) {
          textareaRef.current.blur();
        }
      }
      return; // let event bubble up to parent handlers
    }
    
    // Submit on Enter; allow Shift+Enter to insert a newline
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return; // allow newline
      }
      e.preventDefault();
      onSubmit?.();
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
