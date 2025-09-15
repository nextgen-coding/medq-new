
import { Lecture } from '@/types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink, BookOpen, Clock, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { LockIcon } from '@/components/ui/lock-icon';
import { UpgradeDialog } from '@/components/subscription/UpgradeDialog';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';

interface LecturesListViewProps {
  lectures: Lecture[];
  isLoading: boolean;
  specialtyId?: string;  // Add specialtyId prop for nested routing
}

interface LectureProgressData {
  totalQuestions: number;
  correct: number;
  incorrect: number;
  partial: number;
  incomplete: number;
}

export function LecturesListView({ lectures, isLoading, specialtyId }: LecturesListViewProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canAccessContent, isContentLocked } = useSubscription();
  const [lectureProgress, setLectureProgress] = useState<Record<string, LectureProgressData>>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  // Fetch progress for all lectures
  useEffect(() => {
    if (!user || lectures.length === 0) return;

    const fetchAllLectureProgress = async () => {
      setIsLoadingProgress(true);
      try {
        const progressPromises = lectures.map(async (lecture) => {
          const response = await fetch(`/api/progress?lectureId=${lecture.id}`);
          if (response.ok) {
            const progressData = await response.json();
            
            // Get total questions for this lecture
            const questionsResponse = await fetch(`/api/questions?lectureId=${lecture.id}`);
            if (questionsResponse.ok) {
              const questions = await questionsResponse.json();
              const totalQuestions = questions.length;
              
              // Calculate detailed progress
              let correct = 0;
              let incorrect = 0;
              let partial = 0;
              
              progressData.forEach((item: any) => {
                if (item.completed && item.questionId) {
                  if (item.score === 1) {
                    correct++;
                  } else if (item.score === 0) {
                    incorrect++;
                  } else if (item.score && item.score > 0 && item.score < 1) {
                    partial++;
                  } else {
                    incorrect++;
                  }
                }
              });
              
              const completed = correct + incorrect + partial;
              const incomplete = totalQuestions - completed;
              
              return {
                lectureId: lecture.id,
                progress: {
                  totalQuestions,
                  correct,
                  incorrect,
                  partial,
                  incomplete
                }
              };
            }
          }
          return null;
        });

        const results = await Promise.all(progressPromises);
        const progressMap: Record<string, LectureProgressData> = {};
        
        results.forEach(result => {
          if (result) {
            progressMap[result.lectureId] = result.progress;
          }
        });
        
        setLectureProgress(progressMap);
      } catch (error) {
        console.error('Error fetching lecture progress:', error);
      } finally {
        setIsLoadingProgress(false);
      }
    };

    fetchAllLectureProgress();
  }, [lectures, user]);

  const renderProgressBar = (lectureId: string) => {
    const progress = lectureProgress[lectureId];
    if (!progress || progress.totalQuestions === 0) {
      return (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div className="h-full bg-gray-300 dark:bg-gray-600 rounded-full w-0" />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">0/0</span>
        </div>
      );
    }

    const correctPercent = (progress.correct / progress.totalQuestions) * 100;
    const partialPercent = (progress.partial / progress.totalQuestions) * 100;
    const incorrectPercent = (progress.incorrect / progress.totalQuestions) * 100;
    const completed = progress.correct + progress.incorrect + progress.partial;
    const completionPercent = (completed / progress.totalQuestions) * 100;

    return (
      <div className="flex items-center gap-2">
        <div className="relative h-2 w-20 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          {/* Correct (Green) */}
          {correctPercent > 0 && (
            <div 
              className="absolute h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
              style={{ width: `${correctPercent}%` }}
            />
          )}
          {/* Partial (Yellow) */}
          {partialPercent > 0 && (
            <div 
              className="absolute h-full bg-gradient-to-r from-yellow-500 to-yellow-600 transition-all duration-500"
              style={{ 
                left: `${correctPercent}%`, 
                width: `${partialPercent}%` 
              }}
            />
          )}
          {/* Incorrect (Red) */}
          {incorrectPercent > 0 && (
            <div 
              className="absolute h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500"
              style={{ 
                left: `${correctPercent + partialPercent}%`, 
                width: `${incorrectPercent}%` 
              }}
            />
          )}
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        </div>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {completed}/{progress.totalQuestions}
        </span>
        {completionPercent === 100 && (
          <CheckCircle2 className="w-3 h-3 text-green-500" />
        )}
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (lectures.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center p-12 text-center"
      >
        <Card className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg max-w-md mx-auto">
          <CardContent className="p-8">
            <div className="flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl mb-4 mx-auto">
              <BookOpen className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {t('lectures.noLecturesAvailable')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('lectures.noLecturesDescription')}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {lectures.map((lecture, index) => {
        const isLocked = isContentLocked(lecture.isFree || false);
        const canAccess = canAccessContent(lecture.isFree || false);
        const progress = lectureProgress[lecture.id];
        const isCompleted = progress && progress.totalQuestions > 0 && 
          (progress.correct + progress.incorrect + progress.partial) === progress.totalQuestions;
        
        const handleLectureClick = () => {
          if (!canAccess) {
            setShowUpgradeDialog(true);
            return;
          }
          // Use nested route if specialtyId is available, otherwise fallback to old route
          if (specialtyId) {
            router.push(`/matieres/${specialtyId}/cours/${lecture.id}`);
          } else {
            router.push(`/lecture/${lecture.id}`);
          }
        };

        return (
          <motion.div
            key={lecture.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={canAccess ? { y: -2 } : {}}
            className="group"
          >
            <Card 
              className={`relative overflow-hidden backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl ${
                canAccess ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600' : 'cursor-not-allowed opacity-75'
              }`}
              onClick={handleLectureClick}
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-white/20 to-blue-50/30 dark:from-blue-900/10 dark:via-gray-800/30 dark:to-blue-900/10" />
              
              <CardContent className="relative z-10 p-6">
                <div className="flex items-center gap-4">
                  {/* Lecture Icon */}
                  <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm group-hover:shadow-md transition-all duration-300 ${
                    isCompleted ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <FileText className="w-6 h-6" />
                    )}
                  </div>
                  
                  {/* Lecture Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-200">
                        {lecture.title}
                      </h3>
                      {isLocked && (
                        <div className="flex items-center justify-center w-6 h-6 bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-700 rounded-full">
                          <LockIcon className="text-amber-600 dark:text-amber-400" size={12} />
                        </div>
                      )}
                    </div>
                    
                    {lecture.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 mb-3">
                        {lecture.description}
                      </p>
                    )}
                    
                    {/* Progress Bar */}
                    <div className="flex items-center gap-3">
                      {isLoadingProgress ? (
                        <Skeleton className="h-2 w-20" />
                      ) : (
                        renderProgressBar(lecture.id)
                      )}
                      
                      {progress && progress.totalQuestions > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>{progress.totalQuestions} questions</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <div className="flex items-center gap-2">
                    {isCompleted && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Complete</span>
                      </div>
                    )}
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-10 w-10 p-0 bg-white/80 dark:bg-gray-700/80 hover:bg-blue-50 dark:hover:bg-blue-900/50 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm"
                      disabled={!canAccess}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canAccess) {
                          setShowUpgradeDialog(true);
                          return;
                        }
                        // Use nested route if specialtyId is available, otherwise fallback to old route
                        if (specialtyId) {
                          router.push(`/matieres/${specialtyId}/cours/${lecture.id}`);
                        } else {
                          router.push(`/lecture/${lecture.id}`);
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="sr-only">{t('lectures.openLecture')}</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
              
              {/* Hover Overlay */}
              {canAccess && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-600/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:via-blue-600/5 group-hover:to-blue-500/5 transition-all duration-300 rounded-xl" />
              )}
            </Card>
          </motion.div>
        );
      })}
      
      <UpgradeDialog
        isOpen={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        onUpgrade={() => {
          setShowUpgradeDialog(false);
          // Handle upgrade logic here
        }}
      />
    </motion.div>
  );
}
