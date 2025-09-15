
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface OpenQuestionExplanationProps {
  explanation?: string;
  courseReminder?: string;
  correctAnswers?: string[];
}

export function OpenQuestionExplanation({ explanation, courseReminder, correctAnswers }: OpenQuestionExplanationProps) {
  const { t } = useTranslation();
  
  if (!explanation && !courseReminder && (!correctAnswers || correctAnswers.length === 0)) return null;
  
  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="space-y-4 w-full max-w-full"
    >
      {/* Show reference answer first */}
      {(explanation || (correctAnswers && correctAnswers.length > 0)) && (
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 w-full border border-green-200 dark:border-green-800">
          <h4 className="font-medium mb-2">{t('questions.referenceAnswer')}</h4>
          {correctAnswers && correctAnswers.length > 0 ? (
            <div className="space-y-1">
              {correctAnswers.map((answer, index) => (
                <p key={index} className="text-green-700 dark:text-green-300 break-words">
                  {answer}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-green-700 dark:text-green-300 break-words">{explanation}</p>
          )}
        </div>
      )}
      
      {/* Show additional info/course reminder */}
      {courseReminder && (
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 w-full border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium mb-1">{t('questions.courseReminder')}</h4>
          <p className="text-blue-700 dark:text-blue-300 break-words">{courseReminder}</p>
        </div>
      )}
    </motion.div>
  );
}
