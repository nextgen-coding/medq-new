
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, ArrowRight, Keyboard, StickyNote, AlertCircle } from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MCQActionsProps {
  isSubmitted: boolean;
  canSubmit: boolean;
  isCorrect: boolean | 'partial' | null;
  onSubmit: () => void;
  onNext: () => void;
  hasSubmitted?: boolean; // Track if question has been submitted (for clinical cases)
  buttonRef?: React.RefObject<HTMLButtonElement>; // Ref for direct button control
  showNotesArea?: boolean;
  onToggleNotes?: () => void;
  hideNotesButton?: boolean; // Hide notes button when notes have content
  onResubmit?: () => void; // Allow resubmitting the question
}

export function MCQActions({
  isSubmitted,
  canSubmit,
  isCorrect,
  onSubmit,
  onNext,
  hasSubmitted = false,
  buttonRef,
  showNotesArea,
  onToggleNotes,
  hideNotesButton = false,
  onResubmit
}: MCQActionsProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden sm:flex items-center text-xs text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5 mr-1" />
              <span>
                {isSubmitted ? "Entrée: Suivant" : "1-5: Sélectionner, Entrée: Soumettre"}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs p-4">
            <div className="space-y-2 text-sm">
              <h4 className="font-semibold">Raccourcis clavier:</h4>
              <ul className="space-y-1.5">
                <li className="flex justify-between">
                  <span className="font-mono bg-muted px-1.5 rounded text-xs">1-5</span>
                  <span>Sélectionner réponses A-E</span>
                </li>
                <li className="flex justify-between">
                  <span className="font-mono bg-muted px-1.5 rounded text-xs">Entrée</span>
                  <span>{isSubmitted ? "Question suivante" : "Soumettre réponse"}</span>
                </li>
                <li className="flex justify-between">
                  <span className="font-mono bg-muted px-1.5 rounded text-xs">Espace</span>
                  <span>Effacer sélection</span>
                </li>
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {!isSubmitted ? (
        <Button 
          ref={buttonRef}
          onClick={onSubmit} 
          disabled={hasSubmitted || !canSubmit}
          className="sm:ml-auto w-full sm:w-auto"
        >
          {hasSubmitted ? "Répondu" : "Soumettre la réponse"}
        </Button>
      ) : (
        <div className="w-full sm:w-auto sm:ml-auto flex flex-col gap-3">
          {/* Result indicator - full width on mobile */}
          <div className="flex items-center justify-center sm:justify-start">
            {isCorrect === true ? (
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span className="font-medium text-sm sm:text-base">Correcte!</span>
              </div>
            ) : isCorrect === 'partial' ? (
              <div className="flex items-center text-yellow-600">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span className="font-medium text-sm sm:text-base">Partiellement correcte</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <XCircle className="h-5 w-5 mr-2" />
                <span className="font-medium text-sm sm:text-base">Incorrecte</span>
              </div>
            )}
          </div>
          
          {/* Action buttons - responsive layout */}
          <div className="flex flex-col xs:flex-row gap-2 xs:justify-end items-stretch xs:items-center">
            {/* Resubmit Button */}
            {onResubmit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResubmit}
                className="flex items-center gap-1 justify-center text-xs sm:text-sm min-w-0 flex-shrink-0"
              >
                <span className="hidden xs:inline truncate">Soumettre à nouveau</span>
                <span className="xs:hidden truncate">Réessayer</span>
              </Button>
            )}
            
            {/* Notes Button */}
            {onToggleNotes && !hideNotesButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleNotes}
                className="flex items-center gap-1 justify-center text-xs sm:text-sm min-w-0 flex-shrink-0"
              >
                <StickyNote className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{showNotesArea ? 'Fermer les notes' : 'Mes notes'}</span>
              </Button>
            )}
            
            {/* Next Button */}
            <Button onClick={onNext} className="group flex items-center gap-1 justify-center text-xs sm:text-sm min-w-0 flex-shrink-0">
              <span className="hidden xs:inline truncate">Question suivante</span>
              <span className="xs:hidden truncate">Suivant</span>
              <ArrowRight className="h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
