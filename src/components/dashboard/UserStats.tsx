'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Target, Calendar, Award } from 'lucide-react';

interface UserStatsProps {
  averageScore: number;
  totalQuestions: number;
  learningStreak: number;
  totalLectures: number;
  isLoading?: boolean;
}

export function UserStats({ 
  averageScore, 
  totalQuestions, 
  learningStreak, 
  totalLectures,
  isLoading = false 
}: UserStatsProps) {
  const { t } = useTranslation();

  const stats = [
    {
      title: t('dashboard.stats.averageScore'),
      value: `${averageScore.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30',
      shadowColor: 'shadow-emerald-500/20'
    },
    {
      title: t('dashboard.stats.totalQuestions'),
      value: totalQuestions.toString(),
      icon: Target,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30',
      shadowColor: 'shadow-blue-500/20'
    },
    {
      title: t('dashboard.stats.learningStreak'),
      value: learningStreak.toString(),
      icon: Calendar,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30',
      shadowColor: 'shadow-orange-500/20'
    },
    {
      title: t('dashboard.stats.totalLectures'),
      value: totalLectures.toString(),
      icon: Award,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30',
      shadowColor: 'shadow-blue-500/20'
    }
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:gap-6 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
        {stats.map((_, index) => (
          <Card key={index} className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="h-4 w-24 bg-muted/60 rounded-lg animate-pulse" />
              <div className="h-12 w-12 bg-muted/60 rounded-xl animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted/60 rounded-lg animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className={`border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg ${stat.shadowColor} hover:shadow-xl transition-all duration-300 group`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-[13px] sm:text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {stat.title}
              </CardTitle>
              <div className={`p-2.5 sm:p-3 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-all duration-300 shadow-lg`}>
                <Icon className="h-4 w-4 sm:h-5 sm:w-5 ${stat.color}" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-blue-800 dark:group-hover:from-blue-400 dark:group-hover:to-blue-600 transition-all duration-300">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}