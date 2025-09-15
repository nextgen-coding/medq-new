'use client'

import { useAuth } from '@/contexts/AuthContext'
import { UniversalHeader } from '@/components/layout/UniversalHeader';
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import { Moon, Sun, Settings as SettingsIcon, LogOut } from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PasswordChangeForm } from '@/components/settings/PasswordChangeForm'
import { PasswordInfo } from '@/components/settings/PasswordInfo'

export default function SettingsPageRoute() {
  const { logout, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col">
            {/* Universal Header */}
            <UniversalHeader
              title="Settings"
            />

            {/* Main Content */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-900">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-4 sm:space-y-6">

          <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <SettingsIcon className="h-5 w-5" />
                {t('settings.appearance')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{t('settings.theme')}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('settings.themeDescription')}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="h-4 w-4 mr-2" />
                      {t('settings.lightMode')}
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4 mr-2" />
                      {t('settings.darkMode')}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <PasswordInfo 
            passwordUpdatedAt={user?.passwordUpdatedAt}
            hasPassword={!!user?.password}
          />

          <PasswordChangeForm />

          <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <LogOut className="h-5 w-5" />
                {t('settings.account')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 dark:hover:border-red-500 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t('auth.signOut')}
              </Button>
            </CardContent>
          </Card>
                </div>
              </div>
            </div>
          </SidebarInset>
        </div>
      </AppSidebarProvider>
    </ProtectedRoute>
  )
}