'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Bell, User, LogOut, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  showSearch = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  actions
}: PageHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; time: string; read?: boolean }>>([]);

  useEffect(() => {
    let isMounted = true;
    const formatTime = (d: string | Date) => {
      const date = typeof d === 'string' ? new Date(d) : d;
      const diff = (Date.now() - date.getTime()) / 1000;
      if (diff < 60) return `${Math.floor(diff)}s`;
      if (diff < 3600) return `${Math.floor(diff/60)}min`;
      if (diff < 86400) return `${Math.floor(diff/3600)}h`;
      return date.toLocaleDateString();
    };
    const load = async () => {
      try {
        const res = await fetch('/api/notifications?limit=5', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        const stripAdmin = (s: string) => s?.replace(/^\[ADMIN\]\s*/i, '') ?? s;
        const list = (json.notifications || []).map((n: any) => ({
          id: n.id,
          title: stripAdmin(n.title),
          time: n.createdAt ? formatTime(n.createdAt) : '',
          read: !!n.isRead,
        }));
        if (isMounted) setNotifications(list);
      } catch {}
    };
    // Only try if logged in
    if (user) load();
    return () => { isMounted = false; };
  }, [user]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const handleSignOut = async () => {
    try {
      await logout();
      router.push('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4 min-w-0">
      <div className="max-w-7xl mx-auto min-w-0">
        {/* Top Bar with Notifications and Profile */}
        <div className="flex items-center justify-between mb-6 min-w-0">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {title}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative flex-shrink-0">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-blue-600 rounded-full text-[10px] text-white flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 sm:w-80">
                <div className="p-2 font-semibold text-sm border-b">
                  Notifications
                </div>
                {notifications.map((notification) => (
                  <DropdownMenuItem key={notification.id} className="p-3 cursor-pointer">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{notification.title}</div>
                      <div className="text-xs text-muted-foreground">{notification.time}</div>
                    </div>
                  </DropdownMenuItem>
                ))}
                {notifications.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    No new notifications
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="flex-shrink-0">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 sm:w-56">
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  {t('profile.title')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('auth.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between min-w-0">
          <div className="flex-1 min-w-0">
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center min-w-0">
            {/* Search Bar */}
            {showSearch && (
              <div className="relative flex-1 sm:flex-none min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="pl-9 w-full sm:w-72 lg:w-80 h-10 rounded-xl border-border focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-2 flex-wrap sm:flex-nowrap min-w-0">
              {actions}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
