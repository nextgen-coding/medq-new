'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UpgradeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: () => void;
}

const features = [
  'subscription.unlimitedAccess',
  'subscription.premiumFeatures',
  'subscription.prioritySupport',
  'subscription.advancedProgressTracking',
  'subscription.offlineAccess',
  'subscription.earlyAccess'
];

export function UpgradeDialog({ isOpen, onOpenChange, onUpgrade }: UpgradeDialogProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      // Here you would integrate with your payment provider
      // For now, we&apos;ll just call the onUpgrade callback
      await onUpgrade();
    } catch (error) {
      console.error('Error during upgrade:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            {t('subscription.upgradeToPremium')}
          </DialogTitle>
          <DialogDescription>
            {t('subscription.upgradeDescription')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-3xl font-bold">{t('subscription.price')}</div>
            <div className="text-sm text-muted-foreground">{t('subscription.perMonth')}</div>
            <Badge variant="secondary" className="mt-2">
              <Star className="h-3 w-3 mr-1" />
              {t('subscription.mostPopular')}
            </Badge>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">{t('subscription.whatsIncluded')}</h4>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  {t(feature)}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleUpgrade} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? t('subscription.processing') : t('subscription.upgradeNow')}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              {t('subscription.maybeLater')}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {t('subscription.noCommitment')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
} 