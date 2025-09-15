
import { Progress } from '@/components/ui/progress';
import { Lecture } from '@/types';
import { useTranslation } from 'react-i18next';
import { DetailedProgressBar } from '@/components/specialties/DetailedProgressBar';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface LectureProgressProps {
  lecture: Lecture | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  progress: number;
}

interface LectureProgressData {
  totalQuestions: number;
  correct: number;
  incorrect: number;
  partial: number;
  incomplete: number;
}

export function LectureProgress({
  lecture,
  currentQuestionIndex,
  totalQuestions,
  progress
}: LectureProgressProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [detailedProgress, setDetailedProgress] = useState<LectureProgressData | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  // Fetch detailed progress for this lecture
  useEffect(() => {
    if (!lecture?.id || !user) return;

    const fetchLectureProgress = async () => {
      setIsLoadingProgress(true);
      try {
        const response = await fetch(`/api/progress?lectureId=${lecture.id}`);
        if (response.ok) {
          const progressData = await response.json();
          
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
          
          setDetailedProgress({
            totalQuestions,
            correct,
            incorrect,
            partial,
            incomplete
          });
        }
      } catch (error) {
        console.error('Error fetching lecture progress:', error);
      } finally {
        setIsLoadingProgress(false);
      }
    };

    fetchLectureProgress();
  }, [lecture?.id, user, totalQuestions]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{lecture?.title}</h2>
        <div className="mt-4 mb-6">
          <div className="flex justify-between text-sm mb-1 dark:text-gray-300 text-foreground">
            <span>{currentQuestionIndex + 1} {t('common.of')} {totalQuestions}</span>
            <span>{Math.round(progress)}% {t('common.complete')}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Detailed Progress Bar */}
      {detailedProgress && !isLoadingProgress && (
        <DetailedProgressBar
          data={detailedProgress}
          title="Lecture Progress"
          showIcons={false}
          compact={true}
        />
      )}
    </div>
  );
}
