import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Upload, 
  BookOpen, 
  FileText, 
  Users, 
  Settings,
  BarChart3,
  Download,
  ArrowRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';

export function QuickActions() {
  const { t } = useTranslation();
  const router = useRouter();

  const actions = [
    {
      title: t('admin.addSpecialty'),
      description: t('admin.addSpecialtyDesc'),
      icon: BookOpen,
      onClick: () => router.push('/admin?tab=specialties'),
      color: 'text-blue-500',
      bgColor: 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20',
      hoverColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/20'
    },
    {
      title: t('admin.addLecture'),
      description: t('admin.addLectureDesc'),
      icon: FileText,
      onClick: () => router.push('/admin?tab=lectures'),
      color: 'text-green-500',
      bgColor: 'from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20',
      hoverColor: 'hover:bg-green-50 dark:hover:bg-green-900/20'
    },
    {
      title: t('admin.importQuestions'),
      description: t('admin.importQuestionsDesc'),
      icon: Upload,
      onClick: () => router.push('/admin/import'),
      color: 'text-blue-500',
      bgColor: 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20',
      hoverColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/20'
    },
    {
      title: t('admin.manageUsers'),
      description: t('admin.manageUsersDesc'),
      icon: Users,
      onClick: () => router.push('/admin?tab=users'),
      color: 'text-orange-500',
      bgColor: 'from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20',
      hoverColor: 'hover:bg-orange-50 dark:hover:bg-orange-900/20'
    },
    {
      title: t('admin.viewReports'),
      description: t('admin.viewReportsDesc'),
      icon: BarChart3,
      onClick: () => router.push('/admin?tab=reports'),
      color: 'text-red-500',
      bgColor: 'from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20',
      hoverColor: 'hover:bg-red-50 dark:hover:bg-red-900/20'
    },
    {
      title: t('admin.systemSettings'),
      description: t('admin.systemSettingsDesc'),
      icon: Settings,
      onClick: () => router.push('/settings'),
      color: 'text-gray-500',
      bgColor: 'from-gray-100 to-gray-50 dark:from-gray-800/30 dark:to-gray-700/20',
      hoverColor: 'hover:bg-gray-50 dark:hover:bg-gray-800/20'
    }
  ];

  return (
    <Card className="border-0 shadow-lg bg-card hover:shadow-xl transition-all duration-300">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-foreground mb-2">{t('admin.quickActions')}</CardTitle>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t('admin.quickActionsDesc')}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {actions.map((action, index) => (
            <div
              key={index}
              onClick={action.onClick}
              className={`group cursor-pointer p-6 rounded-2xl border bg-card ${action.hoverColor} hover:shadow-lg hover:border-border/60 transition-all duration-300 transform hover:scale-105`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 bg-gradient-to-br ${action.bgColor} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <action.icon className={`w-7 h-7 ${action.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground mb-2 group-hover:text-foreground/80 transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    {action.description}
                  </p>
                  <div className="flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700 transition-colors">
                    Get started
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform duration-200" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 