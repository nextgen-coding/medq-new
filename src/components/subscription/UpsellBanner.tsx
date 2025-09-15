'use client';

import { Crown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface UpsellBannerProps {
  onUpgrade: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function UpsellBanner({ onUpgrade, onDismiss, className }: UpsellBannerProps) {
  const { t } = useTranslation();

  return (
    <div className={cn(
      "relative bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 shadow-sm",
      "dark:from-yellow-950/20 dark:to-orange-950/20 dark:border-yellow-800",
      className
    )}>
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t('subscription.close')}</span>
        </Button>
      )}
      
      <div className="flex items-start gap-3 pr-8">
        <div className="flex-shrink-0">
          <Crown className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
            {t('subscription.upsellTitle')}
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
            {t('subscription.upsellDescription')}
          </p>
          <Button
            onClick={onUpgrade}
            size="sm"
            className="bg-yellow-600 hover:bg-yellow-700 text-white border-0"
          >
            {t('subscription.upgradeToAccessAll')}
          </Button>
        </div>
      </div>
    </div>
  );
} 