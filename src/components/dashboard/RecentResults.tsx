'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { Trophy, Target, TrendingUp, TrendingDown } from 'lucide-react';

interface RecentResult {
  id: string;
  lectureTitle: string;
  specialtyName: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
  isImprovement?: boolean;
}

interface RecentResultsProps {
  results: RecentResult[];
  isLoading?: boolean;
}

export function RecentResults({ results, isLoading = false }: RecentResultsProps) {
  const { t } = useTranslation();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 dark:bg-green-900/20';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-red-600 bg-red-50 dark:bg-red-900/20';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return Trophy;
    if (score >= 60) return Target;
    return TrendingDown;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((index) => (
            <div key={index} className="space-y-2">
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
          <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {t('dashboard.recentResults.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        {results.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {t('dashboard.recentResults.noResults')}
            </p>
          </div>
        ) : (
          results.map((result) => {
            const Icon = getScoreIcon(result.score);
            const scoreColor = getScoreColor(result.score);
            
            return (
              <div key={result.id} className="p-3 border rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm sm:text-base truncate">{result.lectureTitle}</h3>
                      {result.isImprovement && (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] sm:text-xs mb-2">
                      {result.specialtyName}
                    </Badge>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                      {new Date(result.completedAt).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <div className={`p-2 rounded-full ${scoreColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg">{result.score}%</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                        {result.totalQuestions} {t('dashboard.recentResults.questions')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}