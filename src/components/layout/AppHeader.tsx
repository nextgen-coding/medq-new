import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, User, Heart, Stethoscope, Menu, Bell, Moon, Sun, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function AppHeader() {
  const { user, isAdmin, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { setOpen, setOpenMobile, isMobile, open, openMobile } = useSidebar();

  const handleSignOut = async () => {
    try {
      await logout();
      router.push('/auth');
    } catch (err) {
      console.error('Unexpected sign out error:', err);
      toast({
        title: t('auth.signOutError'),
        description: t('auth.unexpectedError'),
        variant: "destructive",
      });
    }
  };

  const handleSidebarToggle = () => {
    if (isMobile) {
      setOpenMobile(!openMobile);
    } else {
      setOpen(!open);
    }
  };

  return (
    <header className="border-b border-border/40 bg-gradient-to-r from-background via-background to-muted/20 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 shadow-sm">
      <div className="flex h-16 items-center gap-2 sm:gap-4 px-3 sm:px-6">
        {/* Left Section: Sidebar toggle + Branding */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSidebarToggle}
            className="shrink-0 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 rounded-xl"
          >
            {open || openMobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">Toggle sidebar</span>
          </Button>
          <Button 
            variant="link" 
            className="font-bold text-lg sm:text-xl p-0 flex items-center gap-2 whitespace-nowrap hover:no-underline group" 
            onClick={() => router.push('/dashboard')}
          >
            <span className="flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl w-8 h-8 sm:w-9 sm:h-9 shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all duration-200">
              <Stethoscope className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <span className="hidden md:inline-block bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">{t('app.name')}</span>
          </Button>
        </div>

  {/* Center Section: (search removed) preserve flex spacing */}
  {user && <div className="hidden md:flex flex-1 items-center" />}

        {/* Right Section: Actions */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {user && (
            <>
              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 rounded-xl">
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Notifications</span>
                    {/* Notification badge */}
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-gradient-to-r from-red-500 to-red-600 rounded-full shadow-sm"></span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 border-border/50 bg-background/95 backdrop-blur-sm">
                  <div className="flex items-center justify-center p-4 text-muted-foreground text-sm">
                    <p>{t('common.noNotifications')}</p>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Theme Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 rounded-xl"
                  >
                    {theme === 'dark' ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                    <span className="sr-only">Toggle theme</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" className="bg-background/95 backdrop-blur-sm border-border/50">
                  <p>{theme === 'dark' ? t('settings.light') : t('settings.dark')}</p>
                </TooltipContent>
              </Tooltip>

              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/admin')}
                  className="font-medium bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 hidden sm:inline-flex rounded-xl px-3 sm:px-4 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200"
                >
                  {t('admin.adminPanel')}
                </Button>
              )}
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full h-9 w-9 border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-500/10 transition-all duration-200 bg-white/50 dark:bg-muted/30 backdrop-blur-sm">
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="sr-only">{t('common.edit')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 border-border/50 bg-background/95 backdrop-blur-sm">
                  <div className="flex flex-col space-y-1 p-3 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30 rounded-lg m-1">
                    <p className="text-sm font-medium leading-none truncate text-foreground">{user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {isAdmin ? t('profile.administrator') : t('profile.student')}
                    </p>
                  </div>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={() => router.push('/profile')} className="hover:bg-blue-500/10 focus:bg-blue-500/10 rounded-md mx-1">
                    <User className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span>{t('profile.title')}</span>
                  </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => router.push('/settings')} className="hover:bg-blue-500/10 focus:bg-blue-500/10 rounded-md mx-1">
                    <Settings className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span>{t('sidebar.settings')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={handleSignOut} className="hover:bg-red-500/10 focus:bg-red-500/10 text-red-600 dark:text-red-400 rounded-md mx-1">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('auth.signOut')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
