import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import { HighlightableAnswerDisplay } from '../HighlightableAnswerDisplay';

interface OpenQuestionSelfAssessmentProps {
  onAssessment: (rating: 'correct' | 'wrong' | 'partial') => void;
  userAnswerText?: string;
  questionId?: string; // for highlighting
  enableHighlighting?: boolean; // whether to enable highlighting
  highlightConfirm?: boolean; // whether to show confirmation bubble
}

export function OpenQuestionSelfAssessment({ onAssessment, userAnswerText, questionId, enableHighlighting = false, highlightConfirm = false }: OpenQuestionSelfAssessmentProps) {
  const { t } = useTranslation();

  // Keyboard shortcuts for self-assessment
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '1') {
        event.preventDefault();
        handleRatingSelect('correct');
      } else if (event.key === '2') {
        event.preventDefault();
        handleRatingSelect('partial');
      } else if (event.key === '3') {
        event.preventDefault();
        handleRatingSelect('wrong');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRatingSelect = (rating: 'correct' | 'wrong' | 'partial') => {
    // Immediately trigger the assessment when a rating is selected
    onAssessment(rating);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 w-full max-w-full"
    >
      <div className="p-4 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium mb-4 text-blue-900 dark:text-blue-200">
          Évaluez votre réponse: {userAnswerText !== undefined && (
            <span className="font-normal text-blue-800 dark:text-blue-100">
              {userAnswerText.trim() ? (
                enableHighlighting && questionId ? (
                  <HighlightableAnswerDisplay 
                    questionId={questionId}
                    answer={userAnswerText}
                    confirmMode={highlightConfirm}
                  />
                ) : (
                  <RichTextDisplay text={userAnswerText} enableImageZoom={true} />
                )
              ) : (
                <span className="italic opacity-70">(vide)</span>
              )}
            </span>
          )}
        </h4>

        {/* Separator */}
        <div className="border-t border-blue-200/60 dark:border-blue-700/60 my-4"></div>

        <div className="flex flex-row gap-3 w-full">
          <Button
            size="lg"
            className="flex-1 gap-3 bg-green-600/90 hover:bg-green-600 text-white shadow-md hover:shadow-lg transition-all duration-200 transform-gpu hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-green-400"
            onClick={() => handleRatingSelect('correct')}
          >
            <CheckCircle className="h-5 w-5" />
            Correcte
          </Button>

          <Button
            size="lg"
            className="flex-1 gap-3 bg-amber-500/90 hover:bg-amber-500 text-white shadow-md hover:shadow-lg transition-all duration-200 transform-gpu hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-amber-400"
            onClick={() => handleRatingSelect('partial')}
          >
            <MinusCircle className="h-5 w-5" />
            Partiellement correcte
          </Button>

          <Button
            size="lg"
            className="flex-1 gap-3 bg-red-600/90 hover:bg-red-600 text-white shadow-md hover:shadow-lg transition-all duration-200 transform-gpu hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-red-400"
            onClick={() => handleRatingSelect('wrong')}
          >
            <XCircle className="h-5 w-5" />
            Incorrecte
          </Button>
        </div>
      </div>
    </motion.div>
  );
} 