
import { Button } from '@/components/ui/button'; // updated to include user answer display
import { ChevronLeft, ChevronRight, Keyboard, StickyNote, SendHorizontal, CheckCircle2, X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface OpenQuestionActionsProps {
  isSubmitted: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onNext: () => void;
  onPrevious?: () => void;
  showPrevious?: boolean;
  showNext?: boolean;
  hasSubmitted?: boolean; // Track if question has been submitted (for clinical cases)
  showNotesArea?: boolean;
  onToggleNotes?: () => void; // toggle unified notes area
  hideNotesButton?: boolean; // Hide notes button when notes have content
  assessmentCompleted?: boolean; // Track if self-assessment is completed
  assessmentResult?: boolean | 'partial' | null; // The result of self-assessment (correct/partial/wrong)
  onResubmit?: () => void; // Allow resubmitting the question
  userAnswerText?: string; // User's submitted answer for display
  correctAnswer?: string; // Correct answer for display
  currentAnswer?: string; // Current answer being typed (for validation)
}

export function OpenQuestionActions({
  isSubmitted,
  canSubmit,
  onSubmit,
  onNext,
  onPrevious,
  showPrevious = false,
  showNext = true,
  hasSubmitted = false,
  showNotesArea,
  onToggleNotes,
  hideNotesButton = false,
  assessmentCompleted = false,
  assessmentResult,
  onResubmit,
  userAnswerText,
  correctAnswer,
  currentAnswer = ''
}: OpenQuestionActionsProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-6">
      <div className="hidden sm:flex items-center text-xs text-muted-foreground">
        <Keyboard className="h-3.5 w-3.5 mr-1" />
        <span>
          {!isSubmitted ? "Entrée: Soumettre | Shift+Entrée: Nouvelle ligne" :
           !assessmentCompleted ? "1/2/3: Noter votre réponse" :
           "Entrée: Suivant"}
        </span>
      </div>
      {showPrevious && onPrevious && (
        <Button
          variant="outline"
          onClick={onPrevious}
          className="flex items-center gap-1 w-full sm:w-auto"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Précédent</span>
        </Button>
      )}
      
      <div className={`flex gap-2 ${showPrevious ? 'sm:ml-auto' : ''} justify-end flex-wrap`}>
        <div className="flex gap-2 items-center flex-wrap">
        {!hasSubmitted && (
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || !currentAnswer.trim()}
            className="flex items-center gap-1 w-full sm:w-auto"
          >
            <SendHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Soumettre</span>
          </Button>
        )}

        {/* Assessment Result Indicator */}
        {isSubmitted && assessmentCompleted && assessmentResult !== undefined && (
          <div className="flex items-center mr-4">
            {assessmentResult === true ? (
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span className="font-medium">Correcte!</span>
              </div>
            ) : assessmentResult === 'partial' ? (
              <div className="flex items-center text-yellow-600">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span className="font-medium">Partiellement correcte</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <XCircle className="h-5 w-5 mr-2" />
                <span className="font-medium">Incorrecte</span>
              </div>
            )}
          </div>
        )}


        {/* Resubmit Button */}
        {isSubmitted && assessmentCompleted && onResubmit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onResubmit}
            className="flex items-center gap-1"
          >
            <span className="hidden sm:inline">Soumettre à nouveau</span>
            <span className="sm:hidden">Réessayer</span>
          </Button>
        )}

        {onToggleNotes && !hideNotesButton && assessmentCompleted && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleNotes}
            className="flex items-center gap-1"
          >
            <StickyNote className="h-4 w-4" />
            <span className="hidden sm:inline">{showNotesArea ? 'Fermer les notes' : 'Mes notes'}</span>
          </Button>
        )}
        {showNext && (
          <Button
            size="sm"
            onClick={onNext}
            className="flex items-center gap-1"
          >
            <span className="hidden sm:inline">Suivant</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        </div>
      </div>
    </div>
  );
}
