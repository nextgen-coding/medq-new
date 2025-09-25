"use client";

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, BookOpen, Eye, EyeOff } from 'lucide-react';
import { HighlightableQuestionText } from '../HighlightableQuestionText';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import { useTranslation } from 'react-i18next';

interface OpenQuestionHeaderProps {
  questionText: string;
  questionNumber?: number;
  session?: string;
  lectureTitle?: string;
  specialtyName?: string;
  questionId?: string;
  highlightConfirm?: boolean;
  hideMeta?: boolean;
  correctAnswers?: string[];
  showEyeButton?: boolean; // Whether to show the eye button (clinical/multi contexts)
}

export function OpenQuestionHeader({ questionText, questionNumber, session, lectureTitle, specialtyName, questionId, highlightConfirm, hideMeta, correctAnswers, showEyeButton }: OpenQuestionHeaderProps) {
  const { t } = useTranslation();
  const [showAnswer, setShowAnswer] = useState(false);
  
  // Enhanced session formatting to preserve full session information
  const formatSession = (sessionValue?: string) => {
    if (!sessionValue) return '';
    
    // Clean up extra whitespace and normalize
    const cleaned = sessionValue.trim().replace(/\s+/g, ' ');
    
    // If it's just a number, prefix with "Session"
    if (/^\d+$/.test(cleaned)) return `Session ${cleaned}`;
    
    // If it contains "theme" or other descriptive text, use as-is
    if (/theme|thème/i.test(cleaned)) return cleaned;
    
    // For date formats like "JANVIER 2020", "Juin 2016", etc., prefix with "Session"
    if (/^(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/i.test(cleaned) ||
        /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i.test(cleaned)) {
      return `Session ${cleaned}`;
    }
    
    // Otherwise, use as-is (for complex formats)
    return cleaned;
  };

  // Build the metadata line with better structure
  const buildMetadataLine = () => {
    const parts: string[] = [];
    
    // Always start with QROC (without number)
    parts.push('qroc');
    
    // Add session info if available
    const formattedSession = formatSession(session);
    if (formattedSession) {
      parts.push(formattedSession);
    }
    
    return parts.join(' • ');
  };

  const metadataLine = buildMetadataLine();
  
  return (
    <div className="space-y-2">
      {/* Show metadata only when hideMeta is false */}
      {!hideMeta && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm sm:text-base font-semibold text-foreground dark:text-gray-100">
              {metadataLine}
            </div>
            {/* Eye button positioned to align with question number circle */}
            {showEyeButton && correctAnswers && correctAnswers.length > 0 && (
              <div className="flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-md"
                  title={showAnswer ? "Masquer la réponse" : "Voir la réponse"}
                >
                  {showAnswer ? (
                    <EyeOff className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                </Button>
              </div>
            )}
          </div>
          {(specialtyName || lectureTitle) && (
            <div className="text-xs sm:text-sm text-muted-foreground">
              {[specialtyName, lectureTitle].filter(Boolean).join(' • ')}
            </div>
          )}
        </>
      )}
      
      {/* Show eye button for clinical contexts even when hideMeta is true */}
      {hideMeta && showEyeButton && correctAnswers && correctAnswers.length > 0 && (
        <div className="flex items-center justify-end mb-2">
          <div className="flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAnswer(!showAnswer)}
              className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-md shadow-sm"
              title={showAnswer ? "Masquer la réponse" : "Voir la réponse"}
            >
              {showAnswer ? (
                <EyeOff className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              )}
            </Button>
          </div>
        </div>
      )}
      
      {/* Show correct answer when eye button is clicked */}
      {showAnswer && showEyeButton && correctAnswers && correctAnswers.length > 0 && (
        <div className="mb-3 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
          <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
            Réponse attendue :
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">
            <RichTextDisplay content={correctAnswers.join(', ')} />
          </div>
        </div>
      )}
      
      {/* Show question text - always show when component is used as main header */}
      {questionId ? (
        <div data-question-text={questionId}>
          <HighlightableQuestionText
            questionId={questionId}
            text={questionText}
            className={`${hideMeta ? 'mt-0' : 'mt-3'} text-base sm:text-lg font-medium text-foreground dark:text-gray-200 break-words whitespace-pre-wrap`}
            confirmMode={highlightConfirm}
          />
        </div>
      ) : (
        <h3 className={`${hideMeta ? 'mt-0' : 'mt-3'} text-base sm:text-lg font-medium text-foreground dark:text-gray-200 break-words whitespace-pre-wrap`}>{questionText}</h3>
      )}
    </div>
  );
}