import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Calendar, Info, Key } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PasswordInfoProps {
  passwordUpdatedAt?: string | null;
  hasPassword: boolean;
}

export function PasswordInfo({ passwordUpdatedAt, hasPassword }: PasswordInfoProps) {
  const { t } = useTranslation();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInDays > 0) {
      return t('settings.daysAgo', { count: diffInDays });
    } else if (diffInHours > 0) {
      return t('settings.hoursAgo', { count: diffInHours });
    } else if (diffInMinutes > 0) {
      return t('settings.minutesAgo', { count: diffInMinutes });
    } else {
      return t('settings.justNow');
    }
  };

  return (
    <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Shield className="h-5 w-5" />
          {t('settings.passwordInfo')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('settings.passwordStatus')}</span>
          </div>
          <span className={`text-sm px-2 py-1 rounded-full ${
            hasPassword 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}>
            {hasPassword ? t('settings.passwordSet') : t('settings.noPassword')}
          </span>
        </div>

        {hasPassword && passwordUpdatedAt && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('settings.lastPasswordChange')}</span>
            </div>
            <div className="ml-6 space-y-1">
              <div className="text-sm text-muted-foreground">
                {formatDate(passwordUpdatedAt)}
              </div>
              <div className="text-xs text-muted-foreground">
                {getTimeAgo(passwordUpdatedAt)}
              </div>
            </div>
          </div>
        )}

        {!hasPassword && (
          <div className="text-sm text-muted-foreground">
            {t('settings.noPasswordSetMessage')}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 