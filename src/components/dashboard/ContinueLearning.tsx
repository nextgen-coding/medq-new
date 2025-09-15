"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { Play, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface ContinueLearningProps {
  lastLecture?: {
    id: string;
    title: string;
    specialtyId: string;
    specialty: { name: string };
    progress: number; // 0-100 number (already %)
    totalQuestions: number;
    completedQuestions: number;
    lastAccessed: string;
  };
  isLoading?: boolean;
}

export function ContinueLearning({ lastLecture, isLoading = false }: ContinueLearningProps) {
  const { t } = useTranslation();

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-4">
          <div className="h-6 w-48 bg-muted/50 dark:bg-muted/40 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="pt-1 pb-5 flex flex-col gap-3">
          <div className="h-4 w-40 bg-muted/50 rounded animate-pulse" />
          <div className="h-3 w-full bg-muted/50 rounded animate-pulse" />
          <div className="h-8 w-28 bg-muted/50 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!lastLecture) {
    return (
      <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 group">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
            <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            {t('dashboard.continueLearning.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-1 pb-6 flex flex-col items-center gap-5 text-center min-h-[220px]">
          <div className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-105 transition">
            <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px]">
              {t('dashboard.continueLearning.noProgress')}
            </p>
          <Link href="/specialty" className="w-full">
            <Button className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center justify-center gap-1">
              <Play className="h-4 w-4" />
              {t('dashboard.continueLearning.startLearning')}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Helpers
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return t('dashboard.continueLearning.yesterday');
    if (diffDays < 7) return t('dashboard.continueLearning.daysAgo', { days: diffDays });
    return date.toLocaleDateString();
  };

  const percent = Math.min(100, Math.max(0, Math.round(lastLecture.progress)));

  // Main card
  return (
    <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 group">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {t('dashboard.continueLearning.title')}
        </CardTitle>
      </CardHeader>
  <CardContent className="pt-1 pb-5 flex flex-col gap-4 min-h-[210px]">
        {/* Title line with specialty badge */}
        <div className="flex items-start gap-2 min-w-0">
          <h3 className="flex-1 font-semibold text-lg tracking-tight text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight line-clamp-2">
            {lastLecture.title}
          </h3>
          <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-0 px-3 py-0.5 rounded-md text-xs font-medium shrink-0 max-w-[42%] truncate">
            {lastLecture.specialty.name}
          </Badge>
        </div>
        {/* Date under title+badge */}
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {formatDate(lastLecture.lastAccessed)}
        </div>
        <div className="flex flex-col gap-1 mt-auto">
          <span className="text-lg font-semibold leading-none tracking-tight bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 bg-clip-text text-transparent">
            {percent}%
          </span>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${lastLecture.progress}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums min-w-fit">
              {lastLecture.completedQuestions}/{lastLecture.totalQuestions}
            </span>
          </div>
        </div>
        {/* Continue button full width bottom */}
        <Link href={`/matieres/${lastLecture.specialtyId}/cours/${lastLecture.id}`} className="mt-3">
          <Button className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center justify-center gap-2 shadow-sm">
            <Play className="h-4 w-4" />
            {t('dashboard.continueLearning.continue')}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}