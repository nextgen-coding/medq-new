import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Users, Target, Activity, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface EngagementMetricsProps {
  totalProgressEntries?: number;
  recentProgressEntries?: number;
  averageCompletionRate?: number;
  usersThisWeek?: number;
  questionsThisWeek?: number;
  lecturesThisWeek?: number;
  reportsThisWeek?: number;
}

const t = (key: string) => {
  const map: Record<string,string> = {
    'admin.completionRate': 'Taux de complétion',
    'admin.completionRateDesc': 'Pourcentage moyen des questions complétées',
    'admin.totalProgress': 'Entrées de progression',
    'admin.totalProgressDesc': 'Total des enregistrements de progression',
    'admin.recentActivity': 'Activité récente',
    'admin.recentActivityDesc': 'Entrées de progression sur 7 jours',
    'admin.complete': 'complété',
    'admin.weeklyActivity': 'Activité hebdomadaire',
    'admin.weeklyActivityDesc': 'Nouveaux éléments ajoutés cette semaine',
    'admin.newUsers': 'Nouveaux utilisateurs',
    'admin.newQuestions': 'Nouvelles questions',
    'admin.newLectures': 'Nouveaux cours',
    'admin.newReports': 'Nouveaux signalements'
  }; return map[key] || key;
};

export function EngagementMetrics(props: EngagementMetricsProps) {
  const totalProgressEntries = props.totalProgressEntries ?? 0;
  const recentProgressEntries = props.recentProgressEntries ?? 0;
  const averageCompletionRate = props.averageCompletionRate ?? 0;
  const usersThisWeek = props.usersThisWeek ?? 0;
  const questionsThisWeek = props.questionsThisWeek ?? 0;
  const lecturesThisWeek = props.lecturesThisWeek ?? 0;
  const reportsThisWeek = props.reportsThisWeek ?? 0;

  const metrics = [
    {
      title: t('admin.completionRate'),
      value: `${averageCompletionRate.toFixed(2)}%`,
      description: t('admin.completionRateDesc'),
      icon: Target,
      color: 'text-green-500',
      bgColor: 'from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20',
      progress: averageCompletionRate
    },
    {
      title: t('admin.totalProgress'),
      value: totalProgressEntries.toLocaleString(),
      description: t('admin.totalProgressDesc'),
      icon: Activity,
      color: 'text-blue-500',
      bgColor: 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20',
      progress: null
    },
    {
      title: t('admin.recentActivity'),
      value: recentProgressEntries.toLocaleString(),
      description: t('admin.recentActivityDesc'),
      icon: TrendingUp,
      color: 'text-blue-500',
      bgColor: 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20',
      progress: null
    }
  ];

  const weeklyStats = [
    { label: t('admin.newUsers'), value: usersThisWeek, icon: Users, color: 'text-blue-500', bgColor: 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20' },
    { label: t('admin.newQuestions'), value: questionsThisWeek, icon: CheckCircle, color: 'text-green-500', bgColor: 'from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20' },
    { label: t('admin.newLectures'), value: lecturesThisWeek, icon: Clock, color: 'text-blue-500', bgColor: 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20' },
    { label: t('admin.newReports'), value: reportsThisWeek, icon: AlertCircle, color: 'text-orange-500', bgColor: 'from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20' }
  ];

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {metrics.map((metric, index) => (
          <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-0 bg-card shadow-md">
            <CardHeader className="text-center pb-4">
              <div className={`mx-auto w-14 h-14 sm:w-18 sm:h-18 bg-gradient-to-br ${metric.bgColor} rounded-2xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                <metric.icon className={`w-7 h-7 sm:w-9 sm:h-9 ${metric.color}`} />
              </div>
              <CardTitle className="text-base sm:text-lg font-bold text-foreground">{metric.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{metric.value}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {metric.description}
              </p>
              {metric.progress !== null && (
                <div className="mt-4">
                  <Progress value={metric.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    {metric.progress.toFixed(2)}% {t('admin.complete')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly Activity */}
      <Card className="border-0 shadow-lg bg-card hover:shadow-xl transition-all duration-300">
        <CardHeader className="text-center">
          <CardTitle className="text-xl sm:text-2xl font-bold text-foreground mb-2">{t('admin.weeklyActivity')}</CardTitle>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            {t('admin.weeklyActivityDesc')}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {weeklyStats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className={`inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br ${stat.bgColor} rounded-2xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className={`h-7 w-7 sm:h-8 sm:w-8 ${stat.color}`} />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}