'use client';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { UsersTab } from '@/components/admin/UsersTab';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';

export default function AdminUsersPage() {
  const { t } = useTranslation();
  
  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          <div className="space-y-8">
            {/* Modern Page Header */}
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4">{t('admin.users')}</h1>
              <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                Manage user accounts and roles
              </p>
            </div>
            <UsersTab />
          </div>
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}
