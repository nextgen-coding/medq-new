
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  MinusCircle, 
  Target, 
  Trophy, 
  RotateCcw, 
  Home, 
  TrendingUp,
  Award,
  Brain,
  BarChart3,
  Star,
  Sparkles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  
  // Calculate performance statistics based on TASKS (clinical cases count as 1 task regardless of sub-questions)
  
  // Count total tasks: clinical cases = 1 task each, regular questions = 1 task each
  const totalQuestions = Math.max(0, questions.length);
  
  // For each task, check if it's completed and what the result is
  let answeredTasks = 0;
  let correctTasks = 0;
  let partiallyCorrectTasks = 0;
  let incorrectTasks = 0;
  
  questions.forEach((item: any) => {
    if ('questions' in item && Array.isArray(item.questions)) {
      // Clinical case - check if ALL sub-questions have results (completed case)
      const clinicalCase = item;
      const allSubQuestionsHaveResults = clinicalCase.questions.every((subQ: any) => answerResults[subQ.id] !== undefined);
      
      if (allSubQuestionsHaveResults) {
        answeredTasks++;
        
        // Determine clinical case result based on sub-question results
        const subResults = clinicalCase.questions.map((subQ: any) => answerResults[subQ.id]).filter((r: any) => r !== undefined);
        if (subResults.length > 0) {
          const allCorrect = subResults.every((r: any) => r === true);
          const hasCorrect = subResults.some((r: any) => r === true);
          const hasPartial = subResults.some((r: any) => r === 'partial');
          
          if (allCorrect) {
            correctTasks++;
          } else if (hasCorrect || hasPartial) {
            partiallyCorrectTasks++;
          } else {
            incorrectTasks++;
          }
        }
      }
    } else {
      // Regular question
      const question = item;
      const answer = answers[question.id];
      const isQrocQuestion = (question.type as any) === 'qroc' || (question.type as any) === 'open';
      const hasAnswer = answer !== undefined && answer !== null && 
        (Array.isArray(answer) ? answer.length > 0 : 
         typeof answer === 'string' ? (isQrocQuestion ? true : answer.trim().length > 0) : 
         Boolean(answer));
      
      if (hasAnswer) {
        answeredTasks++;
        
        const result = answerResults[question.id];
        if (result === true) {
          correctTasks++;
        } else if (result === 'partial') {
          partiallyCorrectTasks++;
        } else if (result === false) {
          incorrectTasks++;
        }
      }
    }
  });
  
  // Use task-based counts instead of individual question counts
  const answeredQuestions = Math.max(0, answeredTasks);
  const correctAnswers = Math.max(0, correctTasks);
  const partiallyCorrectAnswers = Math.max(0, partiallyCorrectTasks);
  const incorrectAnswers = Math.max(0, incorrectTasks);
  
  // Use the count of valid results for calculations
  const totalResultsCount = correctAnswers + partiallyCorrectAnswers + incorrectAnswers;
  
  // Ensure no negative numbers
  const unansweredQuestions = Math.max(0, totalQuestions - answeredQuestions);
  
  // Calculate percentages based on actual answered questions
  const baseForAccuracy = Math.max(answeredQuestions, 1); // Avoid division by zero
  const accuracyPercentage = answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0;
  const completionPercentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 100;
  
  // Calculate partial rate safely
  const partialPercentage = answeredQuestions > 0 ? Math.round((partiallyCorrectAnswers / answeredQuestions) * 100) : 0;
  
  // Ensure percentages don't exceed 100%
  const safeAccuracyPercentage = Math.min(100, Math.max(0, accuracyPercentage));
  const safeCompletionPercentage = Math.min(100, Math.max(0, completionPercentage));
  const safePartialPercentage = Math.min(100, Math.max(0, partialPercentage));
  
  // Debug logging to help identify issues (can be removed in production)
  if (process.env.NODE_ENV === 'development') {
    const clinicalCaseCount = questions.filter(q => 'questions' in q).length;
    const regularQuestionCount = questions.filter(q => !('questions' in q)).length;
    
    console.log('LectureComplete Stats Debug (Task-based):', {
      totalTasks: totalQuestions,
      answeredTasks: answeredQuestions,
      correctTasks: correctAnswers,
      partiallyCorrectTasks: partiallyCorrectAnswers,
      incorrectTasks: incorrectAnswers,
      totalResultsCount,
      unansweredTasks: unansweredQuestions,
      accuracyPercentage,
      completionPercentage,
      partialPercentage,
      safeAccuracyPercentage,
      safeCompletionPercentage,
      safePartialPercentage,
      clinicalCaseCount,
      regularQuestionCount,
      answersKeys: Object.keys(answers).length,
      answerResultsKeys: Object.keys(answerResults).length,
      // Show sample of answer and result keys for debugging
      sampleAnswerKeys: Object.keys(answers).slice(0, 5),
      sampleResultKeys: Object.keys(answerResults).slice(0, 5)
    });
  }
  
  // Determine performance level
  const getPerformanceLevel = () => {
    if (safeAccuracyPercentage >= 90) return { level: 'Excellent', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: Trophy };
    if (safeAccuracyPercentage >= 75) return { level: 'Bien', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Award };
    if (safeAccuracyPercentage >= 60) return { level: 'Correct', color: 'text-orange-600', bgColor: 'bg-orange-50', icon: TrendingUp };
    return { level: 'À améliorer', color: 'text-red-600', bgColor: 'bg-red-50', icon: Brain };
  };

  const performance = getPerformanceLevel();
  const PerformanceIcon = performance.icon;

  return (
    <div className="min-h-screen pt-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="relative inline-block">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
              className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg"
            >
              <Trophy className="w-10 h-10 text-white" />
            </motion.div>
            
            <motion.div 
              className="absolute -top-2 -right-2"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-6 h-6 text-emerald-500" />
            </motion.div>
          </div>
          
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent"
          >
            Cours Terminé !
          </motion.h1>
          
          {lectureTitle && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-6 font-medium"
            >
              {lectureTitle}
            </motion.p>
          )}
          
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9 }}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full ${performance.bgColor} ${performance.color} font-semibold text-lg shadow-lg`}
          >
            <PerformanceIcon className="w-5 h-5" />
            Performance: {performance.level}
          </motion.div>
        </motion.div>
        {/* Summary Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                {totalQuestions}
              </div>
              <div className="text-lg text-gray-600 dark:text-gray-400 font-medium">
                Total Tâches
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-bold text-emerald-600 mb-2">
                {answeredQuestions}
              </div>
              <div className="text-lg text-gray-600 dark:text-gray-400 font-medium">
                Complétées
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-400 to-gray-600 rounded-2xl flex items-center justify-center">
                <MinusCircle className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-bold text-gray-500 mb-2">
                {unansweredQuestions}
              </div>
              <div className="text-lg text-gray-600 dark:text-gray-400 font-medium">
                Non Complétées
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Progress Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Progrès Global</h3>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {answeredQuestions} sur {totalQuestions} tâches terminées ({safeCompletionPercentage}%)
                </p>
              </div>
              <div className="max-w-2xl mx-auto">
                <Progress value={safeCompletionPercentage} className="h-4 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Performance Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Accuracy & Completion */}
          <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Performance</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">Taux de Précision</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-lg px-4 py-2 font-bold">
                    {safeAccuracyPercentage}%
                  </Badge>
                </div>
                <Progress value={safeAccuracyPercentage} className="h-3 rounded-full" />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">Taux Complétion</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-lg px-4 py-2 font-bold">
                    {safeCompletionPercentage}%
                  </Badge>
                </div>
                <Progress value={safeCompletionPercentage} className="h-3 rounded-full" />
              </div>
            </CardContent>
          </Card>

          {/* Answer Results */}
          <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Répartition des Réponses</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="text-center p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-800/30 border border-emerald-200 dark:border-emerald-700"
                >
                  <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-emerald-700 mb-1">{correctAnswers}</div>
                  <div className="text-sm text-emerald-600 font-medium">Correctes</div>
                </motion.div>
                
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="text-center p-4 rounded-xl bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/30 dark:to-rose-800/30 border border-red-200 dark:border-red-700"
                >
                  <XCircle className="w-8 h-8 text-red-600 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-red-700 mb-1">{incorrectAnswers}</div>
                  <div className="text-sm text-red-600 font-medium">Incorrectes</div>
                </motion.div>

                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="text-center p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-orange-800/30 border border-amber-200 dark:border-amber-700"
                >
                  <MinusCircle className="w-8 h-8 text-amber-600 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-amber-700 mb-1">{partiallyCorrectAnswers}</div>
                  <div className="text-sm text-amber-600 font-medium">Partielles</div>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Achievement Badge (if high performance) */}
        {safeAccuracyPercentage >= 85 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0, duration: 0.5, type: "spring" }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-2xl shadow-xl text-lg">
              <Star className="w-6 h-6" />
              Performance Exceptionnelle !
              <Star className="w-6 h-6" />
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto"
        >
          <Button
            onClick={onRestart}
            variant="outline"
            size="lg"
            className="group relative overflow-hidden bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-2 border-blue-300 hover:border-blue-500 text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200 font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
          >
            <div className="flex items-center justify-center gap-3">
              <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
              <span>Recommencer le Cours</span>
            </div>
          </Button>
          
          <Button
            onClick={onBackToSpecialty}
            size="lg"
            className="group relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
          >
            <div className="flex items-center justify-center gap-3">
              <Home className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
              <span>Retour à la Spécialité</span>
            </div>
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
          </Button>
        </motion.div>



      </div>
    </div>
  );
}
