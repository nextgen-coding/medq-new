import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { LogOut, Settings, User, Heart, Stethoscope, Menu, Bell, Moon, Sun, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSidebar } from '@/components/ui/sidebar';
import { NotificationsDialog } from '@/components/notifications/NotificationsDialog';
import { useState, useEffect, useCallback } from 'react';

export function AppHeader() {
  const { user, isAdmin, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { setOpen, setOpenMobile, isMobile, open, openMobile } = useSidebar();
  const [notificationCount, setNotificationCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [focusedNotificationId, setFocusedNotificationId] = useState<string | undefined>();

  const handleSignOut = async () => {
    try {
      await logout();
      router.push('/auth');
    } catch (err) {
      console.error('Unexpected sign out error:', err);
      toast.error(t('auth.unexpectedError'));
    }
  };

  const handleSidebarToggle = () => {
    if (isMobile) {
      setOpenMobile(!openMobile);
    } else {
      setOpen(!open);
    }
  };

  const formatTime = (d: string | Date) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff/60)}m`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h`;
    return date.toLocaleDateString();
  };

  const stripAdmin = (s: string) => s?.replace(/^\[ADMIN\]\s*/i, '') ?? s;

  const reloadNotifications = useCallback(async () => {
    try {
      if (!user) {
        setNotificationCount(0);
        setRecentNotifications([]);
        return;
      }
      const res = await fetch('/api/notifications?limit=5', { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      const list = (json.notifications || []).map((n: any) => ({
        id: n.id,
        title: stripAdmin(n.title),
        time: n.createdAt ? formatTime(n.createdAt) : '',
        read: !!n.isRead,
      }));
      setRecentNotifications(list);
      setNotificationCount(list.filter((n: any) => !n.read).length);
    } catch {
      // ignore transient failures
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        if (!user) {
          if (isMounted) {
            setNotificationCount(0);
            setRecentNotifications([]);
          }
          return;
        }
        const res = await fetch('/api/notifications?limit=5', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        const list = (json.notifications || []).map((n: any) => ({
          id: n.id,
          title: stripAdmin(n.title),
          time: n.createdAt ? formatTime(n.createdAt) : '',
          read: !!n.isRead,
        }));
        if (isMounted) {
          setRecentNotifications(list);
          setNotificationCount(list.filter((n: any) => !n.read).length);
        }
      } catch {
        // ignore transient failures
      }
    };
    load();
    return () => { isMounted = false; };
  }, [user]);

  return (
    <header className="border-b border-border/40 bg-gradient-to-r from-background via-background to-muted/20 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 shadow-sm">
      <div className="flex h-16 items-center gap-2 sm:gap-4 px-3 sm:px-6">
        {/* Left Section: Sidebar toggle only */}
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
                  <Button variant="ghost" size="icon" className="relative shrink-0">
                    <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                    {notificationCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-xs"
                      >
                        {notificationCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 sm:w-80 lg:w-96">
                  <DropdownMenuLabel className="text-base font-semibold">Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {recentNotifications.length > 0 ? (
                    recentNotifications.map((n) => (
                      <DropdownMenuItem key={n.id} className="p-4 cursor-pointer" onClick={() => {
                        setFocusedNotificationId(n.id);
                        setNotificationsOpen(true);
                      }}>
                        <div className="flex flex-col space-y-1 w-full min-w-0">
                          <p className="text-sm font-medium truncate">{n.title}</p>
                          <p className="text-xs text-muted-foreground">{n.time}</p>
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground text-center">No new notifications</div>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="p-0">
                    <div
                      className="w-full p-3 text-center bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors rounded-b-lg cursor-pointer"
                      onClick={() => setNotificationsOpen(true)}
                    >
                      <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">
                        View all notifications
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Theme Toggle (tooltip removed to avoid ref loops) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 rounded-xl"
                aria-label={theme === 'dark' ? t('settings.light') : t('settings.dark')}
                title={theme === 'dark' ? t('settings.light') : t('settings.dark')}
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>
              
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

      {/* Notifications Dialog */}
      <NotificationsDialog
        open={notificationsOpen}
        onOpenChange={(open) => {
          setNotificationsOpen(open);
          if (!open) setFocusedNotificationId(undefined);
        }}
        onNotificationsUpdated={reloadNotifications}
        focusNotificationId={focusedNotificationId}
      />
    </header>
  );
}
