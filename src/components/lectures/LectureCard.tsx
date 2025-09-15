
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lecture } from '@/types';
import { BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { DetailedProgressBar } from '@/components/specialties/DetailedProgressBar';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface LectureCardProps {
  lecture: Lecture;
}

interface LectureProgressData {
  totalQuestions: number;
  correct: number;
  incorrect: number;
  partial: number;
  incomplete: number;
}

export function LectureCard({ lecture }: LectureCardProps) {
  const router = useRouter();
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
            
            setDetailedProgress({
              totalQuestions,
              correct,
              incorrect,
              partial,
              incomplete
            });
          }
        }
      } catch (error) {
        console.error('Error fetching lecture progress:', error);
      } finally {
        setIsLoadingProgress(false);
      }
    };

    fetchLectureProgress();
  }, [lecture?.id, user]);

  const handleClick = () => {
    if (lecture.specialtyId) {
      router.push(`/matieres/${lecture.specialtyId}/cours/${lecture.id}`);
    } else {
      // Fallback to old route if specialtyId is not available
      router.push(`/lecture/${lecture.id}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="h-full flex flex-col">
        <CardContent className="flex-grow pt-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">{lecture.title}</h3>
              <p className="text-muted-foreground text-sm">
                {lecture.description || t('lectures.noDescription')}
              </p>
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
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button onClick={handleClick} className="w-full">
            {t('lectures.startLecture')}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
