'use client';

import { Crown, X, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface UpsellBannerProps {
  onUpgrade?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function UpsellBanner({ onUpgrade, onDismiss, className }: UpsellBannerProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    }
    router.push('/upgrade');
  };

  return (
    <div className={cn(
      "relative bg-gradient-to-br from-medblue-500 to-purple-600 text-white rounded-xl shadow-lg overflow-hidden",
      "hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1",
      // Responsive padding
      "p-4 sm:p-6 lg:p-8",
      className
    )}>
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-medblue-500/90 to-purple-600/90"></div>
      <div className="absolute -top-4 -right-4 w-16 h-16 sm:w-24 sm:h-24 bg-white/10 rounded-full blur-2xl"></div>
      <div className="absolute -bottom-6 -left-6 w-20 h-20 sm:w-32 sm:h-32 bg-white/5 rounded-full blur-3xl"></div>

      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 h-7 w-7 sm:h-8 sm:w-8 p-0 text-white/70 hover:text-white hover:bg-white/20 rounded-full z-10"
        >
          <X className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="sr-only">{t('subscription.close')}</span>
        </Button>
      )}

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
          <div className="flex-shrink-0">
            <div className="relative">
              <Crown className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-300" />
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-200 absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>

          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2 sm:mb-3">
              <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white">
                {t('subscription.upsellTitle')}
              </h3>
              <div className="px-2 py-0.5 sm:py-1 bg-yellow-400 text-yellow-900 text-xs font-semibold rounded-full self-start sm:self-auto">
                PREMIUM
              </div>
            </div>

            <p className="text-white/90 mb-3 sm:mb-4 leading-relaxed text-sm sm:text-base">
              {t('subscription.upsellDescription')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleUpgrade}
                size="sm"
                className="bg-white text-medblue-600 hover:bg-gray-50 font-semibold shadow-lg flex items-center justify-center gap-2 group w-full sm:w-auto"
              >
                <span className="text-sm sm:text-base">{t('subscription.upgradeToAccessAll')}</span>
                <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
              </Button>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-white/80 text-xs sm:text-sm">
                <Crown className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="text-center sm:text-left">Accès illimité • Sans engagement</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 