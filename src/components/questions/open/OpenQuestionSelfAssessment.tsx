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
  const [userRating, setUserRating] = useState<'correct' | 'wrong' | 'partial' | null>(null);

  // DEBUG: Log props to console
  console.log('OpenQuestionSelfAssessment props:', {
    selectedRating,
    assessmentCompleted,
    userAnswerText,
    correctAnswer,
    variant
  });

  // Check if assessment is completed based on selectedRating prop or local state
  // selectedRating null means not completed, any other value (true/false/'partial') means completed
  const hasSelectedRating = selectedRating !== null && selectedRating !== undefined;
  const isCompleted = assessmentCompleted || hasSelectedRating;
  const currentRating = userRating || (selectedRating === true ? 'correct' : selectedRating === 'partial' ? 'partial' : selectedRating === false ? 'wrong' : null);

  

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
    setUserRating(rating);
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
        <div className="space-y-4">

          {/* Show results after evaluation completion - styled like evaluation boxes */}
          {isCompleted && (
            <div className="space-y-4">
              {/* Reference Answer Section - Same style as evaluation */}
              {correctAnswer && showCorrectAnswer && (
                <div className="mb-4">
                  <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4">
                    <h5 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2 uppercase tracking-wide">
                      Réponse de référence
                    </h5>
                    <div className="text-green-700 dark:text-green-300 leading-relaxed">
                      <RichTextDisplay text={correctAnswer} enableImageZoom={true} />
                    </div>
                  </div>
                </div>
              )}


            </div>
          )}

          {/* Show boxed answers only during evaluation (before completion) */}
          {!isCompleted && correctAnswer && showCorrectAnswer && (
            <div className="mb-4">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2 uppercase tracking-wide">
                  Réponse de référence
                </h5>
                <div className="text-green-700 dark:text-green-300 leading-relaxed">
                  <RichTextDisplay text={correctAnswer} enableImageZoom={true} />
                </div>
              </div>
            </div>
          )}

          {!isCompleted && userAnswerText && (
            <div className="mb-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h5 className="text-sm font-semibold mb-2 uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Évaluer votre réponse : {userAnswerText}
                </h5>
                
                {/* Evaluation Buttons inside blue box */}
                <div className="mt-4">
                  <div className="flex flex-col xs:flex-row gap-3 w-full">
                    <Button
                      size="lg"
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-full transition-all duration-200 flex-1"
                      onClick={() => handleRatingSelect('correct')}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Correct!
                    </Button>

                    <Button
                      size="lg" 
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-full transition-all duration-200 flex-1"
                      onClick={() => handleRatingSelect('partial')}
                    >
                      <MinusCircle className="h-4 w-4" />
                      Partiellement correcte
                    </Button>

                    <Button
                      size="lg"
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-full transition-all duration-200 flex-1"
                      onClick={() => handleRatingSelect('wrong')}
                    >
                      <XCircle className="h-4 w-4" />
                      Incorrect
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">

          {/* Reference Answer Section - Show when evaluation interface is visible */}
          {correctAnswer && showCorrectAnswer && (
            <div className="mb-4">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2 uppercase tracking-wide">
                  Réponse de référence
                </h5>
                <div className="text-green-700 dark:text-green-300 leading-relaxed">
                  <RichTextDisplay text={correctAnswer} enableImageZoom={true} />
                </div>
              </div>
            </div>
          )}

          {/* User Answer Evaluation Section - Only show during evaluation (not after completion) */}
          {!isCompleted && userAnswerText && (
            <div className="mb-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h5 className="text-sm font-semibold mb-2 uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Évaluer votre réponse : {userAnswerText}
                </h5>
                
                {/* Evaluation Buttons inside blue box */}
                <div className="mt-4">
                  <div className="flex flex-col xs:flex-row gap-3 w-full">
                    <Button
                      size="lg"
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-full transition-all duration-200 flex-1"
                      onClick={() => handleRatingSelect('correct')}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Correct!
                    </Button>

                    <Button
                      size="lg" 
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-full transition-all duration-200 flex-1"
                      onClick={() => handleRatingSelect('partial')}
                    >
                      <MinusCircle className="h-4 w-4" />
                      Partiellement correcte
                    </Button>

                    <Button
                      size="lg"
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-full transition-all duration-200 flex-1"
                      onClick={() => handleRatingSelect('wrong')}
                    >
                      <XCircle className="h-4 w-4" />
                      Incorrect
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
} 