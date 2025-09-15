import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  averageScore: number;
  totalQuestions: number;
  completedQuestions: number;
  learningStreak: number;
  totalLectures: number;
  lastLecture?: {
    id: string;
    title: string;
    specialtyId: string;
    specialty: {
      name: string;
    };
    progress: number;
    totalQuestions: number;
    completedQuestions: number;
    lastAccessed: string;
  };
}

interface DailyActivity {
  date: string;
  questions: number;
}

interface RecentResult {
  id: string;
  lectureTitle: string;
  specialtyName: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
  isImprovement?: boolean;
}

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
  specialtyId?: string; // optional for compatibility (present in courses-to-review endpoint)
}

interface PerformanceSummary { correct: number; wrong: number; partial: number; total: number; windowDays?: number; percentCorrect?: number; percentPartial?: number; percentWrong?: number; }
interface SpecialtyAverage { id: string; name: string; average: number; pinned?: boolean; }

interface DashboardData {
  stats: DashboardStats | null;
  dailyActivity: DailyActivity[];
  recentResults: RecentResult[];
  popularCourses: PopularCourse[];
  coursesToReview: PopularCourse[]; // courses with low score (needs review)
  performance: PerformanceSummary | null;
  specialtyAverages: SpecialtyAverage[];
  isLoading: boolean;
  error: string | null;
}

export function useDashboardData(): DashboardData {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    stats: null,
    dailyActivity: [],
    recentResults: [],
    popularCourses: [],
    coursesToReview: [],
    performance: null,
    specialtyAverages: [],
    isLoading: true,
    error: null
  });

  useEffect(() => {
    if (!user) {
      setData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setData(prev => ({ ...prev, isLoading: true, error: null }));

        // Fetch all data in parallel (added performance endpoint)
        const [statsRes, dailyRes, resultsRes, coursesRes, reviewCoursesRes, performanceRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/dashboard/daily-activity?days=14'),
          fetch('/api/dashboard/recent-results'),
          fetch('/api/dashboard/popular-courses'),
          fetch('/api/dashboard/courses-to-review'),
          fetch('/api/dashboard/performance')
        ]);

        if (!statsRes.ok || !dailyRes.ok || !resultsRes.ok || !coursesRes.ok || !reviewCoursesRes.ok || !performanceRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

  const [stats, dailyActivityRaw, recentResults, popularCourses, coursesToReview, performance] = await Promise.all([
          statsRes.json(),
          dailyRes.json(),
          resultsRes.json(),
          coursesRes.json(),
          reviewCoursesRes.json(),
          performanceRes.json()
        ]);

        // coursesToReview now fetched directly (already filtered by API)

        // Specialty averages from popular courses
        const specialtyMap: Record<string, { name: string; scores: number[] }> = {};
        popularCourses.forEach((c: PopularCourse) => {
          if (!specialtyMap[c.specialty.name]) specialtyMap[c.specialty.name] = { name: c.specialty.name, scores: [] };
          specialtyMap[c.specialty.name].scores.push(c.averageScore);
        });
        const specialtyAverages = Object.entries(specialtyMap).map(([name, v], i) => ({
          id: `spec-${i}`,
          name,
          average: v.scores.reduce((a,b)=>a+b,0)/v.scores.length
        })).sort((a,b)=> b.average - a.average).slice(0,15);

        // Normalize daily activity (API may return array OR an object { dailyData:[], metrics:... })
        const normalizedDailyActivity = Array.isArray(dailyActivityRaw)
          ? dailyActivityRaw
          : (dailyActivityRaw && Array.isArray((dailyActivityRaw as any).dailyData)
              ? (dailyActivityRaw as any).dailyData
              : []);

        setData({
          stats,
          dailyActivity: normalizedDailyActivity,
          recentResults,
          popularCourses,
          coursesToReview: (coursesToReview || []).slice(0,10),
          performance: performance.total ? performance : null,
          specialtyAverages,
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'An error occurred'
        }));
      }
    };

    fetchDashboardData();
  }, [user]);

  return data;
}