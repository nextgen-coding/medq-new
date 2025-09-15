
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Specialty } from '@/types';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { LockIcon } from '@/components/ui/lock-icon';
import { UpgradeDialog } from '@/components/subscription/UpgradeDialog';
import { getMedicalIcon } from '@/lib/medical-icons';

interface SpecialtyCardProps {
  specialty: Specialty;
}

export function SpecialtyCard({ specialty }: SpecialtyCardProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { canAccessContent, isContentLocked } = useSubscription();
  const { user } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const isLocked = isContentLocked(specialty.isFree || false);
  const canAccess = canAccessContent(specialty.isFree || false);

  // Get the medical icon for this specialty
  const medicalIcon = getMedicalIcon(specialty.icon);
  const IconComponent = medicalIcon.icon;

  const handleClick = () => {
    if (!canAccess) {
      setShowUpgradeDialog(true);
      return;
    }
    router.push(`/matieres/${specialty.id}`);
  };

  const handleUpgrade = async () => {
    // Here you would integrate with your payment provider
    // For now, we&apos;ll just close the dialog
    setShowUpgradeDialog(false);
    // You could redirect to a payment page or handle the upgrade flow
  };

  const renderDetailedProgressBar = () => {
    if (!specialty.progress) return null;

    const { totalQuestions, completedQuestions, totalLectures, completedLectures, lectureProgress, questionProgress, averageScore } = specialty.progress;
    
    if (totalQuestions === 0) return null;

    const completedPercent = questionProgress;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('progress.overallProgress')}</span>
          <span className="font-medium">{Math.round(completedPercent)}%</span>
        </div>
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          {/* Completed (Green) */}
          {completedPercent > 0 && (
            <div 
              className="absolute h-full bg-green-500 transition-all duration-300"
              style={{ 
                left: '0%', 
                width: `${completedPercent}%` 
              }}
            />
          )}
          {/* Incomplete (Gray) */}
          {(100 - completedPercent) > 0 && (
            <div 
              className="absolute h-full bg-gray-400 transition-all duration-300"
              style={{ 
                left: `${completedPercent}%`, 
                width: `${100 - completedPercent}%` 
              }}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{completedQuestions} / {totalQuestions} {t('progress.questions')}</span>
          <span>{completedLectures} / {totalLectures} {t('progress.lectures')}</span>
        </div>
        {averageScore > 0 && (
          <div className="text-xs text-muted-foreground">
            {t('progress.averageScore')}: {Math.round(averageScore * 100)}%
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      whileHover={canAccess ? { y: -8, scale: 1.02 } : {}}
      whileTap={canAccess ? { scale: 0.98 } : {}}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group"
    >
      <Card 
        className={`relative overflow-hidden h-full backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 shadow-lg hover:shadow-2xl transition-all duration-300 rounded-2xl ${
          canAccess ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600' : 'cursor-not-allowed opacity-75'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        {/* Header with Icon */}
        <div className="relative p-6 pb-4">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white/30 to-blue-50/50 dark:from-blue-900/20 dark:via-gray-800/50 dark:to-blue-900/20" />
          
          {/* Top-right badge for lock status */}
          {isLocked && (
            <div className="absolute top-4 right-4 z-10">
              <div className="flex items-center justify-center w-8 h-8 bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-700 rounded-full">
                <LockIcon className="text-amber-600 dark:text-amber-400" size={16} />
              </div>
            </div>
          )}
          
          {/* Medical Icon */}
          <div className="relative z-10 flex items-center gap-4">
            <div className={`flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm group-hover:shadow-md transition-all duration-300 ${medicalIcon.color} ${medicalIcon.darkColor}`}>
              <IconComponent className="w-8 h-8" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 line-clamp-1 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-200">
                {specialty.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {specialty.description || `Explore lectures and questions in ${specialty.name}`}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="px-6 pb-6">
          {specialty.progress && specialty.progress.totalQuestions > 0 ? (
            <div className="space-y-3">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">{t('progress.overallProgress')}</span>
                  <span className="font-bold text-blue-700 dark:text-blue-300">
                    {Math.round(specialty.progress.questionProgress)}%
                  </span>
                </div>
                
                {/* Modern Progress Bar */}
                <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="absolute h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${specialty.progress.questionProgress}%` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="text-center p-2 bg-gray-50/50 dark:bg-gray-700/30 rounded-lg border border-gray-200/50 dark:border-gray-600/50">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('progress.questions')}</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {specialty.progress.completedQuestions} / {specialty.progress.totalQuestions}
                  </div>
                </div>
                <div className="text-center p-2 bg-gray-50/50 dark:bg-gray-700/30 rounded-lg border border-gray-200/50 dark:border-gray-600/50">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('progress.lectures')}</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {specialty.progress.completedLectures} / {specialty.progress.totalLectures}
                  </div>
                </div>
              </div>

              {/* Average Score */}
              {specialty.progress.averageScore > 0 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('progress.averageScore')}:</span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">
                    {Math.round(specialty.progress.averageScore * 100)}%
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {t('progress.startLearning')}
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div className="h-full bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-500 rounded-full w-0" />
              </div>
            </div>
          )}
        </div>

        {/* Hover Overlay */}
        {canAccess && (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-600/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:via-blue-600/5 group-hover:to-blue-500/5 transition-all duration-300 rounded-2xl" />
        )}
      </Card>
      
      <UpgradeDialog
        isOpen={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        onUpgrade={handleUpgrade}
      />
    </motion.div>
  );
}
