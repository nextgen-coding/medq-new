import { useState, useMemo } from 'react';
import { Lecture } from '@/types';
import { LecturesListView } from '@/components/specialties/LecturesListView';
import { LectureSearch } from '@/components/specialties/LectureSearch';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Search } from 'lucide-react';

interface LecturesListProps {
  lectures: Lecture[];
  isLoading: boolean;
}

export function LecturesList({ lectures, isLoading }: LecturesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { t } = useTranslation();
  
  // Filter lectures based on search term
  const filteredLectures = useMemo(() => {
    if (!searchTerm.trim()) return lectures;
    
    const term = searchTerm.toLowerCase();
    return lectures.filter(
      lecture => 
        lecture.title.toLowerCase().includes(term) || 
        (lecture.description && lecture.description.toLowerCase().includes(term))
    );
  }, [lectures, searchTerm]);
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
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
    
    if (filteredLectures.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center p-12 text-center"
        >
          <Card className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg max-w-md mx-auto">
            <CardContent className="p-8">
              <div className="flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl mb-4 mx-auto">
                {searchTerm ? (
                  <Search className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                ) : (
                  <BookOpen className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {searchTerm 
                  ? t('lectures.noSearchResults') 
                  : t('lectures.noLecturesAvailable')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm 
                  ? t('lectures.tryDifferentSearch')
                  : t('lectures.noLecturesDescription')}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      );
    }
    
    return <LecturesListView lectures={filteredLectures} isLoading={false} />;
  };
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="space-y-4 sm:space-y-6"
    >
      {/* Section Header */}
      <Card className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                  {t('lectures.title') || 'Lectures'}
                </CardTitle>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {lectures.length} {lectures.length === 1 ? 'lecture' : 'lectures'} available
                </p>
              </div>
            </div>
            
            {/* Search Component */}
            <div className="w-full sm:w-80">
              <LectureSearch onSearch={setSearchTerm} />
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* Lectures Content */}
      {renderContent()}
    </motion.div>
  );
}
