'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Search, 
  User, 
  Settings, 
  LogOut,
  UserCircle,
  Menu,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { useSidebar } from '@/components/ui/sidebar';
import { NotificationsDialog } from '@/components/notifications/NotificationsDialog';

interface UniversalHeaderProps {
  title?: string;
  actions?: React.ReactNode;
  leftActions?: React.ReactNode; // New prop for left-side actions like return button
  rightActions?: React.ReactNode; // New prop for actions next to notifications
  hideSeparator?: boolean;
  // Optional search props (used on exercises page). Completely optional so other pages remain unaffected.
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAlign?: 'left' | 'right';
  graySearch?: boolean; // apply gray background styling to input
  searchWidthClass?: string; // tailwind max-width utility for search input
}

export function UniversalHeader({
  title,
  actions,
  leftActions,
  rightActions,
  hideSeparator = false,
  showSearch = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  searchAlign = 'left',
  graySearch = false,
  searchWidthClass = 'max-w-xs',
}: UniversalHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [notificationCount] = useState(3); // Mock notification count
  const { toggleSidebar, open, openMobile, isMobile } = useSidebar();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    // Rolled back to earlier gray background scheme
    <div className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-40 pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left Section: Mobile button + LeftActions + Title (search if left-aligned) */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="lg:hidden shrink-0"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            {leftActions && (
              <div className="shrink-0">
                {leftActions}
              </div>
            )}
            {title && (
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {title}
              </h1>
            )}
            {showSearch && searchAlign === 'left' && (
              <div className={`hidden md:block w-full ${searchWidthClass}`}>
                <Input
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={`h-9 ${graySearch ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:ring-0 focus:ring-0' : ''}`}
                />
              </div>
            )}
          </div>

          {/* Right Section: (search if right aligned) + rightActions + notifications + profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {showSearch && searchAlign === 'right' && (
              <div className="block w-72 sm:w-80 lg:w-96 xl:w-[28rem]">
                <Input
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={`h-9 w-full ${graySearch ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:ring-0 focus:ring-0' : ''}`}
                />
              </div>
            )}
            
            {/* Right Actions - appears before notifications */}
            {rightActions && (
              <div className="flex items-center space-x-1 sm:space-x-2">
                {rightActions}
              </div>
            )}
            
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
              <DropdownMenuContent align="end" className="w-80 sm:w-96">
                <DropdownMenuLabel className="text-base font-semibold">Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="p-4">
                  <div className="flex flex-col space-y-1 w-full">
                    <p className="text-sm font-medium">New question added</p>
                    <p className="text-xs text-muted-foreground">Cardiology - 2 minutes ago</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="p-4">
                  <div className="flex flex-col space-y-1 w-full">
                    <p className="text-sm font-medium">Progress updated</p>
                    <p className="text-xs text-muted-foreground">General Surgery - 1 hour ago</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="p-4">
                  <div className="flex flex-col space-y-1 w-full">
                    <p className="text-sm font-medium">New lecture available</p>
                    <p className="text-xs text-muted-foreground">Endocrinology - 3 hours ago</p>
                  </div>
                </DropdownMenuItem>
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

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full shrink-0">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                    <AvatarImage src={user?.image} alt={user?.name || user?.email || 'User'} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                      {user?.name ? getInitials(user.name) : <UserCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      
      {/* Actions Row - Below Header */}
      {actions && (
        <div className={`bg-gray-50 dark:bg-gray-900 ${hideSeparator ? '' : 'border-t border-gray-200 dark:border-gray-700'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
              {/* Right actions - typically other action buttons */}
              {actions && (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 ml-auto">
                  {actions}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile search (only when enabled) */}
  {showSearch && (
        <div className="px-4 pb-4 md:hidden">
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
    className={`h-10 ${graySearch ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:ring-0 focus:ring-0' : ''}`}
          />
        </div>
      )}
      
      {/* Notifications Dialog */}
      <NotificationsDialog 
        open={notificationsOpen} 
        onOpenChange={setNotificationsOpen} 
      />
    </div>
  );
}
