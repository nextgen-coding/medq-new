"use client";
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { UniversalHeader } from '@/components/layout/UniversalHeader';
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { UpsellBanner } from '@/components/subscription/UpsellBanner';
import { UpgradeDialog } from '@/components/subscription/UpgradeDialog';
import { useTranslation } from 'react-i18next';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProfileCompletionGuard } from '@/components/ProfileCompletionGuard';
import { ContinueLearning } from '@/components/dashboard/ContinueLearning';
import { DailyLearningChart } from '@/components/dashboard/DailyLearningChart';
import { PerformancePie } from '@/components/dashboard/PerformancePie';
import { CoursesToReview } from '@/components/dashboard/CoursesToReview';
import { SpecialtyAverageSlider } from '@/components/dashboard/SpecialtyAverageSlider';
import { QuickCommentBox } from '@/components/dashboard/QuickCommentBox';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { hasActiveSubscription } = useSubscription();
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [isUpsellDismissed, setIsUpsellDismissed] = useState(false);
  const { t } = useTranslation();
  const { stats, dailyActivity, coursesToReview, isLoading, error } = useDashboardData();
  // Normalize daily activity ensuring we provide a 'total' number for the chart component
  const safeDaily = Array.isArray(dailyActivity) ? dailyActivity : [];
  const activityPoints = safeDaily.map((d: any) => ({
    date: d.date,
    total: typeof d.total === 'number' ? d.total : (typeof d.questions === 'number' ? d.questions : 0)
  }));

  const shouldShowUpsell = !hasActiveSubscription && !isAdmin && !isUpsellDismissed;
  const handleUpgrade = () => setIsUpgradeDialogOpen(true);
  const handleUpgradeComplete = () => setIsUpgradeDialogOpen(false);

  return (
    <ProtectedRoute>
      <ProfileCompletionGuard>
        <AppSidebarProvider>
          <div className="flex min-h-screen w-full max-h-screen overflow-hidden">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col overflow-hidden">
              {/* Universal Header */}
              <UniversalHeader
                title={t('dashboard.title', { defaultValue: 'Tableau de bord' })}
              />

              {/* Main Content (single natural scroll, no nested scroll area) */}
              <div className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
                  {/* Welcome Text (inline, inside container) */}
                  {user && (
                    <span className="block mb-6 text-xl font-bold text-blue-900 dark:text-blue-200">
                      Bonjour {user.name}! Medq vous souhaite un bon travail.
                    </span>
                  )}
                  <div className="space-y-4 sm:space-y-6">
            {/* Upsell Banner for Free Users */}
            {shouldShowUpsell && (
              <UpsellBanner
                onUpgrade={handleUpgrade}
                onDismiss={() => setIsUpsellDismissed(true)}
              />
            )}

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('dashboard.error', { defaultValue: 'Erreur lors du chargement des données', error })}
                </AlertDescription>
              </Alert>
            )}

            {/* Main Dashboard Grid */}
            <div className="hidden xl:grid gap-6" style={{gridTemplateColumns: '330px 1fr'}}>
              {/* Left column stacked */}
              <div className="flex flex-col gap-6">
                <ContinueLearning lastLecture={stats?.lastLecture} isLoading={isLoading} />
                <SpecialtyAverageSlider />
                <QuickCommentBox />
              </div>
              {/* Right column stacked */}
              <div className="flex flex-col gap-6">
                <PerformancePie />
                <div className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg rounded-lg">
                  <DailyLearningChart data={activityPoints} isLoading={isLoading} streak={stats?.learningStreak} />
                </div>
                <CoursesToReview />
              </div>
            </div>

            {/* Responsive layout (< xl) */}
            <div className="xl:hidden grid gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-max">
              {/* Full width stats already above */}
              <div className="sm:col-span-2 lg:col-span-1 order-10 sm:order-none">
                <ContinueLearning lastLecture={stats?.lastLecture} isLoading={isLoading} />
              </div>
              <div className="sm:col-span-1 order-20">
                <PerformancePie />
              </div>
              <div className="sm:col-span-2 lg:col-span-2 order-30">
                <DailyLearningChart data={activityPoints} isLoading={isLoading} streak={stats?.learningStreak} />
              </div>
              <div className="sm:col-span-1 order-40">
                <SpecialtyAverageSlider />
              </div>
              <div className="sm:col-span-1 order-50">
                <QuickCommentBox />
              </div>
              <div className="sm:col-span-2 lg:col-span-1 order-60">
                <CoursesToReview />
              </div>
            </div>

            <UpgradeDialog
              isOpen={isUpgradeDialogOpen}
              onOpenChange={setIsUpgradeDialogOpen}
              onUpgrade={handleUpgradeComplete}
            />
                  </div>
                </div>
              </div>
            </SidebarInset>
          </div>
        </AppSidebarProvider>
      </ProfileCompletionGuard>
    </ProtectedRoute>
  );
}