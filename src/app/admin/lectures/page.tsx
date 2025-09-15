'use client';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { LecturesTab } from '@/components/admin/LecturesTab';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';

export default function AdminLecturesPage() {
  const { t } = useTranslation();
  
  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          <div className="space-y-8">
            {/* Modern Page Header */}
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4">{t('admin.lectures')}</h1>
              <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                Manage lectures and their questions
              </p>
            </div>
            <LecturesTab />
          </div>
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}
