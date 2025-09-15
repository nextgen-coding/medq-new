
import { Button } from '@/components/ui/button'; // updated to include user answer display
import { ChevronLeft, ChevronRight, Keyboard, StickyNote, SendHorizontal, CheckCircle2 } from 'lucide-react';

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
  assessmentCompleted = false
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
        {!isSubmitted ? (
          <Button
            onClick={onSubmit}
            disabled={hasSubmitted || !canSubmit}
            className="flex items-center gap-1 w-full sm:w-auto"
          >
            {hasSubmitted ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline">Répondu</span>
              </>
            ) : (
              <>
                <SendHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Soumettre</span>
              </>
            )}
          </Button>
        ) : (
          <>
      {onToggleNotes && !hideNotesButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
        onClick={onToggleNotes}
        className="flex items-center gap-1"
              >
                <StickyNote className="h-4 w-4" />
        <span className="hidden sm:inline">{showNotesArea ? 'Fermer les notes' : 'Prendre une note'}</span>
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
          </>
        )}
        </div>
      </div>
    </div>
  );
}
