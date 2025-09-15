import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Specialty } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { DetailedProgressBar } from './DetailedProgressBar';
import { getMedicalIcon } from '@/lib/medical-icons';
import { motion } from 'framer-motion';

interface SpecialtyHeaderProps {
  specialty: Specialty | null;
  isLoading: boolean;
}

export function SpecialtyHeader({ specialty, isLoading }: SpecialtyHeaderProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-8 shadow-lg">
        <div className="space-y-6">
          <div className="flex items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="space-y-3 flex-1">
              <Skeleton className="h-8 w-1/3 rounded" />
              <Skeleton className="h-5 w-2/3 rounded" />
              <Skeleton className="h-4 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!specialty) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <div className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-12 shadow-lg max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Specialty not found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The specialty you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button 
            variant="outline" 
            className="bg-white/80 dark:bg-gray-700/80 hover:bg-blue-50 dark:hover:bg-blue-900/50 border-blue-200 dark:border-blue-700" 
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </motion.div>
    );
  }

  // Get medical icon for the specialty
  const medicalIcon = getMedicalIcon(specialty.icon || specialty.name);
  const IconComponent = medicalIcon.icon;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 sm:space-y-8"
    >
      {/* Main Header Card */}
      <div className="relative overflow-hidden backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white/30 to-blue-100/50 dark:from-blue-900/20 dark:via-gray-800/50 dark:to-blue-800/20" />
        
        {/* Header Content */}
        <div className="relative z-10 p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-4 sm:gap-6 mb-4 sm:mb-6">
            {/* Back Button */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push('/matieres')}
              className="h-9 w-9 sm:h-10 sm:w-10 p-0 bg-white/80 dark:bg-gray-700/80 hover:bg-blue-50 dark:hover:bg-blue-900/50 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            {/* Medical Icon */}
            <div className={`flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 border border-gray-200 dark:border-gray-600 shadow-md ${medicalIcon.color} ${medicalIcon.darkColor}`}>
              <IconComponent className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            
            {/* Title and Description */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                  {specialty.name}
                </h1>
                {specialty.niveau && (
                  <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-700">
                    {specialty.niveau.name}
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                {specialty.description || `Explore lectures and questions in ${specialty.name}`}
              </p>
            </div>
          </div>

          {/* Specialty Stats */}
          {specialty.progress && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="text-center p-3 sm:p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {specialty.progress.totalLectures || 0}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Lectures</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {specialty.progress.totalQuestions || 0}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Questions</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {Math.round(specialty.progress.questionProgress || 0)}%
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Completion</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Progress Bar */}
      {specialty.progress && specialty.progress.totalQuestions > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <DetailedProgressBar
            data={{
              totalQuestions: specialty.progress.totalQuestions,
              correct: specialty.progress.correctQuestions,
              incorrect: specialty.progress.incorrectQuestions,
              partial: specialty.progress.partialQuestions,
              incomplete: specialty.progress.incompleteQuestions
            }}
            title={`${specialty.name} Progress`}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
