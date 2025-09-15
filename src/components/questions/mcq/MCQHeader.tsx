
import { useTranslation } from 'react-i18next';
import { HighlightableQuestionText } from '../HighlightableQuestionText';

interface MCQHeaderProps {
  questionText: string;
  isSubmitted: boolean;
  questionNumber?: number;
  session?: string;
  lectureTitle?: string;
  specialtyName?: string;
  questionId?: string;
  highlightConfirm?: boolean;
  hideMeta?: boolean; // when true, suppress first meta line and specialty/course line
}

export function MCQHeader({ questionText, isSubmitted, questionNumber, session, lectureTitle, specialtyName, questionId, highlightConfirm, hideMeta }: MCQHeaderProps) {
  const { t } = useTranslation();
  
  // Enhanced session formatting to preserve full session information
  const formatSession = (sessionValue?: string) => {
    if (!sessionValue) return '';
    
    // Clean up parentheses and extra spaces
    let cleaned = sessionValue.replace(/^\(|\)$/g, '').trim();
    
    // If already contains "Session", use as-is
    if (/session/i.test(cleaned)) return cleaned;
    
    // If it's just a number or year, format as "Session X"
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
    
    // Always start with QCM
    if (questionNumber !== undefined) {
      parts.push(`QCM ${questionNumber}`);
    } else {
      parts.push('QCM');
    }
    
    // Add formatted session if available
    const formattedSession = formatSession(session);
    if (formattedSession) {
      parts.push(formattedSession);
    }
    
    return parts.join(' • ');
  };

  const metadataLine = buildMetadataLine();
  
  return (
    <div className="space-y-2">
      {!hideMeta && (
        <>
          <div className="text-sm sm:text-base font-semibold text-foreground dark:text-gray-100">
            {metadataLine}
          </div>
          {(specialtyName || lectureTitle) && (
            <div className="text-xs sm:text-sm text-muted-foreground">
              {[specialtyName, lectureTitle].filter(Boolean).join(' • ')}
            </div>
          )}
        </>
      )}
      {questionId ? (
        <div data-question-text={questionId}>
          <HighlightableQuestionText
            questionId={questionId}
            text={questionText}
            className="mt-3 text-lg sm:text-xl font-semibold text-foreground dark:text-gray-200 break-words whitespace-pre-wrap"
            confirmMode={highlightConfirm}
          />
        </div>
      ) : (
        <h3 className="mt-3 text-lg sm:text-xl font-semibold text-foreground dark:text-gray-200 break-words whitespace-pre-wrap">{questionText}</h3>
      )}
    </div>
  );
}
