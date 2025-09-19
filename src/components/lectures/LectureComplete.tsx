
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ListOrdered, CheckCircle, XCircle, MinusCircle, Clock, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
// import { LectureComments } from '@/components/lectures/LectureComments';

interface LectureCompleteProps {
  onRestart: () => void;
  onBackToSpecialty: () => void;
  questions: any[];
  answers: Record<string, any>;
  answerResults: Record<string, boolean | 'partial'>;
  lectureTitle?: string;
  lectureId: string;
}

export function LectureComplete({
  onRestart,
  onBackToSpecialty,
  questions,
  answers,
  answerResults,
  lectureTitle,
  lectureId
}: LectureCompleteProps) {
  const { t } = useTranslation();
  
  // Calculate performance statistics
  const totalQuestions = questions.length;
  const answeredQuestions = Object.keys(answers).length;
  const correctAnswers = Object.values(answerResults).filter(result => result === true).length;
  const partiallyCorrectAnswers = Object.values(answerResults).filter(result => result === 'partial').length;
  const incorrectAnswers = Object.values(answerResults).filter(result => result === false).length;
  const unansweredQuestions = totalQuestions - answeredQuestions;
  
  const accuracyPercentage = answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0;
  const completionPercentage = Math.round((answeredQuestions / totalQuestions) * 100);
  
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border rounded-lg p-0 shadow-lg overflow-hidden"
      >
        {/* Confetti celebration */}
        <div className="relative">
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Simple confetti effect using emoji (for lightweight, no lib) */}
            <div className="w-full h-24 flex items-center justify-center animate-bounce-slow text-4xl select-none">
              🎉 🏆 🎊
            </div>
          </div>
          <div className="text-center py-12 bg-gradient-to-b from-green-50 to-white dark:from-green-900/30 dark:to-gray-900">
            <div className="w-20 h-20 bg-green-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border-4 border-green-400 animate-pop">
              <CheckCircle className="h-10 w-10 text-green-700" />
            </div>
            <h3 className="text-3xl font-extrabold mb-2 text-green-700 drop-shadow-lg tracking-tight">
              {t('lectures.lectureComplete')}
            </h3>
            {lectureTitle && (
              <p className="text-lg text-muted-foreground mb-4 font-medium">{lectureTitle}</p>
            )}
            <p className="text-base text-gray-700 dark:text-gray-200 mb-6 max-w-xl mx-auto">
              {t('lectures.completionMessage')}
            </p>
          </div>
        </div>
        {/* Performance Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 px-6 -mt-8 z-20 relative">
          <Card className="shadow-md">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-600">{accuracyPercentage}%</div>
              <div className="text-sm text-muted-foreground">{t('lectures.accuracy')}</div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">{correctAnswers}</div>
              <div className="text-sm text-muted-foreground">{t('lectures.correct')}</div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <MinusCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="text-2xl font-bold text-yellow-600">{partiallyCorrectAnswers}</div>
              <div className="text-sm text-muted-foreground">{t('lectures.partiallyCorrect')}</div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-600">{incorrectAnswers}</div>
              <div className="text-sm text-muted-foreground">{t('lectures.incorrect')}</div>
            </CardContent>
          </Card>
        </div>
        {/* Detailed Statistics */}
        <div className="bg-muted/50 rounded-lg p-6 mb-8 mx-4 shadow-inner">
          <h4 className="font-semibold mb-3 text-lg text-blue-700">{t('lectures.detailedSummary')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>{t('lectures.totalQuestions')}:</span>
                <span className="font-medium">{totalQuestions}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('lectures.answeredQuestions')}:</span>
                <span className="font-medium">{answeredQuestions}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('lectures.unansweredQuestions')}:</span>
                <span className="font-medium">{unansweredQuestions}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>{t('lectures.completionRate')}:</span>
                <span className="font-medium">{completionPercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span>{t('lectures.correctRate')}:</span>
                <span className="font-medium">{answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0}%</span>
              </div>
              <div className="flex justify-between">
                <span>{t('lectures.partialRate')}:</span>
                <span className="font-medium">{answeredQuestions > 0 ? Math.round((partiallyCorrectAnswers / answeredQuestions) * 100) : 0}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-4 pb-8">
          <Button onClick={onRestart} variant="outline" className="text-base px-6 py-3 rounded-xl font-semibold border-2 border-blue-500 hover:bg-blue-50">
            🔄 {t('lectures.restartLecture')}
          </Button>
          <Button onClick={onBackToSpecialty} className="text-base px-6 py-3 rounded-xl font-semibold bg-green-600 hover:bg-green-700">
            🏠 {t('lectures.backToSpecialty')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
