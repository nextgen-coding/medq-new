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
      "relative bg-gradient-to-br from-medblue-500 to-purple-600 text-white rounded-xl p-6 shadow-lg overflow-hidden",
      "hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1",
      className
    )}>
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-medblue-500/90 to-purple-600/90"></div>
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
      <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
      
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="absolute top-3 right-3 h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/20 rounded-full z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t('subscription.close')}</span>
        </Button>
      )}
      
      <div className="relative z-10">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="relative">
              <Crown className="h-8 w-8 text-yellow-300" />
              <Sparkles className="h-4 w-4 text-yellow-200 absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-bold text-white">
                {t('subscription.upsellTitle')}
              </h3>
              <div className="px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-semibold rounded-full">
                PREMIUM
              </div>
            </div>
            
            <p className="text-white/90 mb-4 leading-relaxed">
              {t('subscription.upsellDescription')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleUpgrade}
                size="lg"
                className="bg-white text-medblue-600 hover:bg-gray-50 font-semibold shadow-lg flex items-center gap-2 group"
              >
                <span>{t('subscription.upgradeToAccessAll')}</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Crown className="h-4 w-4" />
                <span>Accès illimité • Sans engagement</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 