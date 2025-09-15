import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, FileText, Users, HelpCircle, AlertTriangle } from 'lucide-react';
// i18n removed for admin pages – static French labels
import { toast } from '@/hooks/use-toast';
import { RecentActivity } from './RecentActivity';
import { QuickActions } from './QuickActions';
import { EngagementMetrics } from './EngagementMetrics';

// Legacy interface was larger; new stats endpoint returns compact shape (see /api/admin/stats)
// Provide optional recent* arrays for compatibility with <RecentActivity/>
interface AdminStatsData {
  specialties?: number;
  lectures?: number;
  questions: number;
  users: number;
  pendingReports?: number;
  // activity feed (optional)
  recentUsers?: Array<{ id: string; email: string; name?: string; createdAt: string; role: string; }>;
  recentQuestions?: Array<{ id: string; text: string; type: string; createdAt: string; lecture: { id: string; title: string; specialty: { id: string; name: string; }; }; }>;
  recentLectures?: Array<{ id: string; title: string; createdAt: string; specialty: { id: string; name: string; }; _count: { questions: number }; }>;
  recentReports?: Array<{ id: string; message: string; status: string; createdAt: string; question: { id: string; text: string }; lecture: { id: string; title: string }; user: { id: string; email: string }; }>;
  // engagement metrics (optional or computed elsewhere)
  totalProgressEntries?: number;
  recentProgressEntries?: number;
  averageCompletionRate?: number;
  usersThisWeek?: number;
  questionsThisWeek?: number;
  lecturesThisWeek?: number;
  reportsThisWeek?: number;
}

export function AdminStats() {
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      
      try {
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          throw new Error('Failed to fetch admin stats');
        }
      } catch (error) {
        console.error('Error fetching admin stats:', error);
    toast({ title: 'Erreur', description: 'Veuillez réessayer.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);
  
  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* tighter gaps on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse border-0 shadow-lg bg-card hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="h-4 bg-muted rounded w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse border-0 shadow-lg bg-card hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-32" />
              </CardHeader>
              <CardContent>
                <div className="h-48 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-20">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/20 dark:to-red-800/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Impossible de charger les données</h3>
          <p className="text-muted-foreground">Erreur inattendue.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-12 animate-fade-in">
      {/* Basic Stats Cards - Modern Design with Dark Mode */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-card shadow-md transform hover:scale-105">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
              <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Spécialités
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-foreground">{stats.specialties}</div>
          </CardContent>
        </Card>
        
        <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-card shadow-md transform hover:scale-105">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Cours
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-foreground">{stats.lectures}</div>
          </CardContent>
        </Card>
        
        <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-card shadow-md transform hover:scale-105">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
              <HelpCircle className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-foreground">{stats.questions}</div>
          </CardContent>
        </Card>
        
        <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-card shadow-md transform hover:scale-105">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Utilisateurs
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-foreground">{stats.users}</div>
          </CardContent>
        </Card>
        
        <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-card shadow-md transform hover:scale-105">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
              <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Signalements en attente
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-foreground">{stats.pendingReports}</div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Metrics */}
      {stats.totalProgressEntries !== undefined && (
        <EngagementMetrics
          totalProgressEntries={stats.totalProgressEntries}
          recentProgressEntries={stats.recentProgressEntries}
          averageCompletionRate={stats.averageCompletionRate}
          usersThisWeek={stats.usersThisWeek}
          questionsThisWeek={stats.questionsThisWeek}
          lecturesThisWeek={stats.lecturesThisWeek}
          reportsThisWeek={stats.reportsThisWeek}
        />
      )}

      {/* Quick Actions */}
      <QuickActions />

      {/* Recent Activity */}
      <RecentActivity
        recentUsers={stats.recentUsers}
        recentQuestions={stats.recentQuestions}
        recentLectures={stats.recentLectures}
        recentReports={stats.recentReports}
      />
    </div>
  );
}
