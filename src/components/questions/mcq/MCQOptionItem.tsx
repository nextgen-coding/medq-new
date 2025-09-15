
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimpleTextDisplay } from '@/components/ui/simple-text-display';
import { HighlightableOptionText } from '../HighlightableOptionText';

interface MCQOptionItemProps {
  option: {
    id: string;
    text: string;
    explanation?: string;
  };
  index: number;
  isSelected: boolean;
  isSubmitted: boolean;
  isCorrect: boolean;
  explanation?: string;
  onSelect: (id: string) => void;
  expandedExplanations: string[];
  toggleExplanation: (id: string) => void;
  hideImmediateResults?: boolean;
  // Added stats
  totalAttempts?: number; // total submissions for this question
  optionPickCount?: number; // how many times this option was chosen
  // Highlighting props
  questionId?: string; // for highlighting storage
  enableHighlighting?: boolean; // whether to enable highlighting
  highlightConfirm?: boolean; // whether to show confirmation bubble
}

export function MCQOptionItem({
  option,
  index,
  isSelected,
  isSubmitted,
  isCorrect,
  explanation,
  onSelect,
  expandedExplanations,
  toggleExplanation,
  hideImmediateResults = false,
  totalAttempts,
  optionPickCount,
  questionId,
  enableHighlighting = false,
  highlightConfirm = false
}: MCQOptionItemProps) {
  // Get expanded state from parent component
  const isExpanded = expandedExplanations.includes(option.id);
  
  // Determine option letter (A, B, C, D, etc.)
  const optionLetter = String.fromCharCode(65 + index);
  
  // Background color based on state
  let bgColorClass = 'bg-card dark:bg-card';
  let borderColorClass = 'border-gray-200 dark:border-gray-700';
  let textColorClass = 'text-foreground';
  
  if (isSubmitted && !hideImmediateResults) {
    if (isSelected && isCorrect) {
      // Correct & selected: stronger green
      bgColorClass = 'bg-green-100 dark:bg-green-900/40';
      borderColorClass = 'border-green-500 dark:border-green-500';
      textColorClass = 'text-green-900 dark:text-green-200';
    } else if (isSelected && !isCorrect) {
      // Selected but wrong: stronger red
      bgColorClass = 'bg-red-100 dark:bg-red-900/40';
      borderColorClass = 'border-red-500 dark:border-red-500';
      textColorClass = 'text-red-900 dark:text-red-300';
    } else if (!isSelected && isCorrect) {
      // Missed correct option: stronger amber/orange highlight
      bgColorClass = 'bg-amber-100 dark:bg-amber-900/40';
      borderColorClass = 'border-amber-500 dark:border-amber-500';
      textColorClass = 'text-amber-900 dark:text-amber-200';
    }
  } else if (isSelected) {
    // Not submitted yet but selected: bump primary contrast
    bgColorClass = 'bg-primary/10 dark:bg-primary/30';
    borderColorClass = 'border-primary-400 dark:border-primary-500';
    textColorClass = 'text-primary-900 dark:text-primary-200';
  }
  
  // Compute percentage (only when submitted & stats available & not hiding results)
  let percentage: number | null = null;
  if (isSubmitted && !hideImmediateResults && totalAttempts && totalAttempts > 0 && typeof optionPickCount === 'number') {
    percentage = Math.round((optionPickCount / totalAttempts) * 100);
  }

  return (
    <div 
      className={`rounded-lg border ${borderColorClass} p-4 ${bgColorClass} transition-colors duration-200 w-full max-w-full relative ${isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
      onClick={isSubmitted ? undefined : () => onSelect(option.id)}
    >
      <div className="flex items-start gap-3 w-full">
        <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-colors text-sm font-medium
          ${isSelected ? 'bg-primary text-primary-foreground ring-2 ring-primary/40' : 'bg-muted text-muted-foreground'}`}
        >
          {optionLetter}
        </div>
        
        <div className="flex-grow min-w-0">
          <div className={`${textColorClass} break-words text-base sm:text-lg leading-relaxed`}>
            {enableHighlighting && questionId ? (
              <HighlightableOptionText 
                optionId={option.id}
                questionId={questionId}
                text={option.text}
                confirmMode={highlightConfirm}
              />
            ) : (
              <SimpleTextDisplay text={option.text} />
            )}
          </div>
          
          {isSubmitted && !hideImmediateResults && option.explanation && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExplanation(option.id);
                  }}
                  className="text-sm text-muted-foreground flex items-center hover:text-primary transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Masquer l'explication
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Afficher l'explication
                    </>
                  )}
                </button>
              </div>
              
              {isExpanded && (
                <div className="mt-3 text-base sm:text-lg pl-3 border-l-2 border-muted py-2 text-foreground leading-relaxed">
                  {enableHighlighting && questionId ? (
                    <HighlightableOptionText 
                      optionId={`${option.id}-explanation`}
                      questionId={questionId}
                      text={option.explanation || ''}
                      confirmMode={highlightConfirm}
                    />
                  ) : (
                    <SimpleTextDisplay text={option.explanation || ''} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
  {/* Removed inner white check icon to reduce visual noise per user request */}
      </div>
      {percentage !== null && (
        <div className="absolute bottom-2 right-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 backdrop-blur border border-border flex items-center gap-1 pointer-events-none">
          <span className="tabular-nums">{percentage}%</span>
        </div>
      )}
    </div>
  );
}
