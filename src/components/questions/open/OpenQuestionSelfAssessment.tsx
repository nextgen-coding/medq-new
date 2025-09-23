import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, MinusCircle, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import { HighlightableAnswerDisplay } from '../HighlightableAnswerDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OpenQuestionSelfAssessmentProps {
  onAssessment: (rating: 'correct' | 'wrong' | 'partial') => void;
  userAnswerText?: string;
  questionId?: string; // for highlighting
  enableHighlighting?: boolean; // whether to enable highlighting
  highlightConfirm?: boolean; // whether to show confirmation bubble
  variant?: 'panel' | 'flat'; // presentation style
  correctAnswer?: string; // the correct answer to show for comparison
  selectedRating?: boolean | 'partial' | null; // the user's self-assessment rating
  showCorrectAnswer?: boolean; // whether to show the correct answer section
}

export function OpenQuestionSelfAssessment({ onAssessment, userAnswerText, questionId, enableHighlighting = false, highlightConfirm = false, variant = 'panel', correctAnswer, selectedRating, showCorrectAnswer = true }: OpenQuestionSelfAssessmentProps) {
  const { t } = useTranslation();
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);

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
    // Mark assessment as completed and hide the correct answer
    setAssessmentCompleted(true);
    // Immediately trigger the assessment when a rating is selected
    onAssessment(rating);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 w-full max-w-none"
    >
      {variant === 'panel' ? (
        <div className="p-3 md:p-4 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium mb-1 text-blue-900 dark:text-blue-200">Évaluez votre réponse</h4>

          {/* User Answer vs Correct Answer Comparison - Always show if available */}
          {(userAnswerText || correctAnswer) && (
            <div className="mb-4 space-y-3">
              {userAnswerText && (
                <div className="rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-gray-50/80 dark:bg-gray-800/50 p-4 shadow-sm">
                  <div className="mb-2 flex items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Votre réponse</h5>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed">
                    <RichTextDisplay text={userAnswerText} enableImageZoom={true} />
                  </div>
                </div>
              )}

              {correctAnswer && showCorrectAnswer && !assessmentCompleted && (
                <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-900/40 p-4 shadow-sm">
                  <div className="mb-2 flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2" />
                    <h5 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Réponse correcte</h5>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-emerald-800 dark:text-emerald-200 leading-relaxed">
                    <RichTextDisplay text={correctAnswer} enableImageZoom={true} />
                  </div>
                </div>
              )}
            </div>
          )}

          {!assessmentCompleted && (
            <div className="mt-1 flex flex-row gap-2 w-full">
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
          )}
        </div>
      ) : (
        <div className="pt-4">
          <h4 className="font-medium mb-2">Évaluez votre réponse</h4>

          {/* User Answer vs Correct Answer Comparison - Always show if available */}
          {(userAnswerText || correctAnswer) && (
            <div className="mb-4 space-y-3">
              {userAnswerText && (
                <div className="rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-gray-50/80 dark:bg-gray-800/50 p-4 shadow-sm">
                  <div className="mb-2 flex items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Votre réponse</h5>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed">
                    <RichTextDisplay text={userAnswerText} enableImageZoom={true} />
                  </div>
                </div>
              )}

              {correctAnswer && showCorrectAnswer && !assessmentCompleted && (
                <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-900/40 p-4 shadow-sm">
                  <div className="mb-2 flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2" />
                    <h5 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Réponse correcte</h5>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-emerald-800 dark:text-emerald-200 leading-relaxed">
                    <RichTextDisplay text={correctAnswer} enableImageZoom={true} />
                  </div>
                </div>
              )}
            </div>
          )}
          {!assessmentCompleted && (
            <div className="mt-4 flex flex-row gap-2 w-full">
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
          )}
        </div>
      )}
    </motion.div>
  );
} 