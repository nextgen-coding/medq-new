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
          <div className="flex min-h-screen w-full max-h-screen overflow-hidden flex-col md:flex-row">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col overflow-hidden">
              {/* Universal Header */}
              <UniversalHeader
                title={t('dashboard.title', { defaultValue: 'Tableau de bord' })}
              />

              {/* Main Content (single natural scroll, no nested scroll area) */}
              <div className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-3 sm:pt-4 md:pt-6 pb-6 sm:pb-8">
                  {/* Welcome Text (inline, inside container) */}
                  {user && (
                    <div className="mb-4 sm:mb-6">
                      <h1 className="text-sm sm:text-base md:text-lg font-normal text-blue-900 dark:text-blue-200">
                        Bonjour {user.name}! MedQ vous souhaite un bon travail.
                      </h1>
                    </div>
                  )}
                  <div className="space-y-3 sm:space-y-4 md:space-y-6">
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
            <div className="hidden xl:grid gap-4 md:gap-6" style={{gridTemplateColumns: 'minmax(300px, 330px) 1fr'}}>
              {/* Left column stacked */}
              <div className="flex flex-col gap-4 md:gap-6">
                <ContinueLearning lastLecture={stats?.lastLecture} isLoading={isLoading} />
                <SpecialtyAverageSlider />
                <QuickCommentBox />
              </div>
              {/* Right column stacked */}
              <div className="flex flex-col gap-4 md:gap-6">
                <PerformancePie />
                <DailyLearningChart data={activityPoints} isLoading={isLoading} streak={stats?.learningStreak} />
                <CoursesToReview />
              </div>
            </div>

            {/* Responsive layout (< xl) */}
            <div className="xl:hidden grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-max">
              {/* Continue Learning - Full width on mobile, 2 cols on sm */}
              <div className="sm:col-span-2 lg:col-span-1 order-1 min-h-0">
                <ContinueLearning lastLecture={stats?.lastLecture} isLoading={isLoading} />
              </div>
              {/* Performance Pie - 1 col on sm, 1 col on lg */}
              <div className="sm:col-span-1 lg:col-span-1 order-2 min-h-0">
                <PerformancePie />
              </div>
              {/* Daily Learning Chart - Full width on mobile, 2 cols on sm, 2 cols on lg */}
              <div className="col-span-1 sm:col-span-2 lg:col-span-2 order-3 min-h-0 px-0 sm:px-0">
                <div className="w-full flex justify-center">
                  <div className="w-full max-w-none">
                    <DailyLearningChart data={activityPoints} isLoading={isLoading} streak={stats?.learningStreak} />
                  </div>
                </div>
              </div>
              {/* Specialty Average Slider - 1 col on sm, 1 col on lg */}
              <div className="sm:col-span-1 lg:col-span-1 order-4 min-h-0">
                <SpecialtyAverageSlider />
              </div>
              {/* Quick Comment Box - 1 col on sm, 1 col on lg */}
              <div className="sm:col-span-1 lg:col-span-1 order-5 min-h-0">
                <QuickCommentBox />
              </div>
              {/* Courses to Review - 2 cols on sm, 1 col on lg */}
              <div className="sm:col-span-2 lg:col-span-1 order-6 min-h-0">
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