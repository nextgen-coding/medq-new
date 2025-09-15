'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Users, Star } from 'lucide-react';
import Link from 'next/link';

interface PopularCourse {
  id: string;
  title: string;
  specialty: {
    name: string;
  };
  questionCount: number;
  studentCount: number;
  averageScore: number;
  isFree: boolean;
}

interface PopularCoursesProps {
  courses: PopularCourse[];
  isLoading?: boolean;
}

export function PopularCourses({ courses, isLoading = false }: PopularCoursesProps) {
  const { t } = useTranslation();

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
          <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {t('dashboard.popularCourses.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        {courses.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {t('dashboard.popularCourses.noCourses')}
            </p>
          </div>
        ) : (
          courses.map((course, index) => (
            <div key={course.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">#{index + 1}</span>
                    <h3 className="font-semibold text-sm sm:text-base truncate">{course.title}</h3>
                    {course.isFree && (
                      <Badge variant="secondary" className="text-[10px] sm:text-xs">{t('dashboard.popularCourses.free')}</Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] sm:text-xs mb-2">{course.specialty.name}</Badge>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>{course.studentCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" />
                      <span>{course.averageScore.toFixed(1)}%</span>
                    </div>
                    <span>{course.questionCount} {t('dashboard.popularCourses.questions')}</span>
                  </div>
                </div>
                <Link href={`/lecture/${course.id}`}>
                  <Button size="sm" variant="outline" className="w-full sm:w-auto border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20">{t('dashboard.popularCourses.start')}</Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}