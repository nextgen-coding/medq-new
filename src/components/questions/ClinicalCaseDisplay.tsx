import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { HighlightableCaseText } from './HighlightableCaseText';

interface ClinicalCaseDisplayProps {
  caseNumber?: number;
  caseText?: string;
  caseQuestionNumber?: number;
  lectureId?: string; // for per-lecture highlight keying
}

export function ClinicalCaseDisplay({ caseNumber, caseText, lectureId }: ClinicalCaseDisplayProps) {
  const { t } = useTranslation();
  
  if (!caseText) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
    >
      <HighlightableCaseText
        lectureId={lectureId ?? 'unknown'}
        text={caseText}
        className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed break-words whitespace-pre-wrap"
      />
    </motion.div>
  );
} 