
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface MCQExplanationProps {
  courseReminder?: string;
  explanation?: string;
}

export function MCQExplanation({ courseReminder, explanation }: MCQExplanationProps) {
  const { t } = useTranslation();
  
  if (!courseReminder && !explanation) return null;
  
  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="space-y-4 w-full max-w-full"
    >          
      {courseReminder && (
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 w-full">
          <h4 className="font-medium mb-1">{t('questions.courseReminder')}</h4>
          <p className="text-blue-700 dark:text-blue-300 break-words">{courseReminder}</p>
        </div>
      )}
      
      {/* Fallback to explanation field for backward compatibility */}
      {!courseReminder && explanation && (
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 w-full">
          <h4 className="font-medium mb-1">{t('questions.courseReminder')}</h4>
          <p className="text-blue-700 dark:text-blue-300 break-words">{explanation}</p>
        </div>
      )}
    </motion.div>
  );
}
