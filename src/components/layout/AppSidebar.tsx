import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  useSidebar
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, UserCircle, Settings, Users, LogOut, BookOpen, Moon, Sun, FileText, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function AppSidebar() {
  const { user, isAdmin, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { state, setOpen, setOpenMobile, isMobile: sidebarIsMobile, open, openMobile, toggleSidebar } = useSidebar();
  const { t } = useTranslation();
  // Internal smooth toggle handled by header button now (removed external floating arrow)
  
  const regularMenuItems = [
    { label: t('sidebar.dashboard'), icon: LayoutDashboard, href: '/dashboard' },
    { label: t('sidebar.exercices'), icon: BookOpen, href: '/matieres' },
    { label: t('sidebar.sessions'), icon: FileText, href: '/session' },
    { label: t('sidebar.profile'), icon: UserCircle, href: '/profile' },
    { label: t('sidebar.settings'), icon: Settings, href: '/settings' },
  ];

  const adminItem = isAdmin ? { label: t('sidebar.admin'), icon: Users, href: '/admin' } : null;
  const isMaintainer = user?.role === 'maintainer';
  const maintainerItems = isMaintainer
    ? [
        { label: t('sidebar.sessions'), icon: FileText, href: '/maintainer/sessions' },
        { label: t('admin.reports'), icon: AlertTriangle, href: '/maintainer/reports' },
      ]
    : [];

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

  // Icon size based on sidebar state
  const iconSize = state === 'expanded' ? 'h-5 w-5' : 'h-6 w-6';

  return (
    <>
  <Sidebar className="sticky top-0 h-screen border-r border-border/40 bg-gradient-to-b from-background to-muted/20" collapsible="icon">
        <SidebarHeader className="relative border-b border-border/40 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
          <div 
            className={`flex items-center justify-center transition-all duration-300 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/20 ${state === 'expanded' ? 'px-4 py-4' : 'px-2 py-4'}`}
            onClick={toggleSidebar}
          >
            {/* Logo/Brand */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl w-10 h-10 shadow-lg shadow-blue-500/25">
                <BookOpen className="h-5 w-5" />
              </div>
              {state === 'expanded' && (
                <div className="flex flex-col">
                  <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
                    MedQ
                  </span>
                  <span className="text-xs text-muted-foreground">Student Panel</span>
                </div>
              )}
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent className="bg-gradient-to-b from-background to-muted/10">
          <ScrollArea className="h-full">
            {/* Moved toggle button here to avoid covering logo */}
            <div className={`flex ${state==='expanded' ? 'justify-end pr-3 pt-3':'justify-center pt-3'} pb-1`}> 
              <button
                onClick={(e)=> { e.preventDefault(); e.stopPropagation(); toggleSidebar(); }}
                aria-label={state === 'expanded' ? t('sidebar.collapseSidebar') : t('sidebar.expandSidebar')}
                className={`relative flex items-center gap-2 rounded-lg border border-blue-400/30 dark:border-blue-300/20
                  bg-white/70 dark:bg-blue-950/40 backdrop-blur-sm px-2 ${state==='expanded'?'h-8':'h-9 w-9 justify-center'}
                  shadow-sm hover:shadow-md hover:bg-white/90 dark:hover:bg-blue-950/60 transition-all duration-300 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60`}
              >
                <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.25),transparent_70%)]" />
                {state === 'expanded' ? (
                  <>
                    <ChevronLeft className="h-4 w-4 text-blue-600 dark:text-blue-300 transition-transform duration-300 group-hover:-translate-x-0.5" />
                    <span className="sr-only">{t('sidebar.collapseSidebar')}</span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-300 transition-transform duration-300 group-hover:translate-x-0.5" />
                    <span className="sr-only">{t('sidebar.expandSidebar')}</span>
                  </>
                )}
              </button>
            </div>
            <SidebarGroup className="px-0">
              <SidebarGroupContent>
                <SidebarMenu className={`space-y-2 ${state === 'expanded' ? 'px-3' : 'px-2'}`}>
                  {regularMenuItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton 
                          asChild 
                          tooltip={item.label}
                          className={
                            `group transition-all duration-200 font-medium rounded-xl ${
                              state === 'expanded' 
                                ? 'px-4 py-3 min-h-[44px] flex items-center' 
                                : 'p-0 min-h-[44px] w-full flex items-center justify-center'
                            } ${
                              isActive
                                ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/25'
                                : 'hover:bg-muted/80 text-foreground hover:text-blue-600'
                            }`
                          }
                        >
                          <Link href={item.href} className={`${state === 'expanded' ? 'flex items-center gap-3 w-full' : 'flex items-center justify-center w-full h-full'}`}>
                            <item.icon className={`${iconSize} ${isActive ? 'text-white' : 'text-blue-500 group-hover:text-blue-600'} transition-all flex-shrink-0`} />
                            <span className={`${state === 'expanded' ? 'block' : 'sr-only'} font-medium`}>
                              {item.label}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                  
                  {/* Maintainer quick links into Admin space */}
                  {isMaintainer && (
                    <>
                      <div className={`${state === 'expanded' ? 'mx-3' : 'mx-2'} my-4`}>
                        <div className="h-px bg-border"></div>
                      </div>
                      {maintainerItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href);
                        return (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton 
                              asChild 
                              tooltip={item.label}
                              className={
                                `group transition-all duration-200 font-medium rounded-xl ${
                                  state === 'expanded' 
                                    ? 'px-4 py-3 min-h-[44px] flex items-center' 
                                    : 'p-0 min-h-[44px] w-full flex items-center justify-center'
                                } ${
                                  isActive
                                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/25'
                                    : 'hover:bg-muted/80 text-foreground hover:text-indigo-600'
                                }`
                              }
                            >
                              <Link href={item.href} className={`${state === 'expanded' ? 'flex items-center gap-3 w-full' : 'flex items-center justify-center w-full h-full'}`}>
                                <item.icon className={`${iconSize} ${isActive ? 'text-white' : 'text-indigo-500 group-hover:text-indigo-600'} transition-all flex-shrink-0`} />
                                <span className={`${state === 'expanded' ? 'block' : 'sr-only'} font-medium`}>
                                  {item.label}
                                </span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </>
                  )}

                  {/* Separator for admin item */}
                  {adminItem && (
                    <>
                      <div className={`${state === 'expanded' ? 'mx-3' : 'mx-2'} my-4`}>
                        <div className="h-px bg-border"></div>
                      </div>
                      
                      {/* Admin Panel - Special styling */}
                      <SidebarMenuItem key={adminItem.href}>
                        <SidebarMenuButton 
                          asChild 
                          tooltip={adminItem.label}
                          className={
                            `group transition-all duration-200 font-medium rounded-xl ${
                              state === 'expanded' 
                                ? 'px-4 py-3 min-h-[44px] flex items-center' 
                                : 'p-0 min-h-[44px] w-full flex items-center justify-center'
                            } ${
                              pathname.startsWith('/admin')
                                ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-500/25'
                                : 'hover:bg-muted/80 text-foreground hover:text-green-600'
                            }`
                          }
                        >
                          <Link href={adminItem.href} className={`${state === 'expanded' ? 'flex items-center gap-3 w-full' : 'flex items-center justify-center w-full h-full'}`}>
                            <adminItem.icon className={`${iconSize} ${pathname.startsWith('/admin') ? 'text-white' : 'text-green-500 group-hover:text-green-600'} transition-all flex-shrink-0`} />
                            <span className={`${state === 'expanded' ? 'block' : 'sr-only'} font-medium`}>
                              {adminItem.label}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </ScrollArea>
        </SidebarContent>
        
        <SidebarFooter className="border-t border-border/40 bg-gradient-to-r from-muted/50 to-muted/30 dark:from-muted/30 dark:to-muted/10 p-2">
          <div className="space-y-2">
            {/* Theme Toggle Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full font-medium rounded-xl transition-all duration-200 justify-center p-0 min-h-[44px] text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-300`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Theme toggle clicked, current theme:', theme);
                    const newTheme = theme === 'dark' ? 'light' : 'dark';
                    console.log('Setting theme to:', newTheme);
                    setTheme(newTheme);
                  }}
                  title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                >
                  {theme === 'dark' ? (
                    <Sun className={`${iconSize} flex-shrink-0`} />
                  ) : (
                    <Moon className={`${iconSize} flex-shrink-0`} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" align="center" className="bg-background/95 backdrop-blur-sm border-border/50">
                <p>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</p>
              </TooltipContent>
            </Tooltip>

            {/* Logout Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full font-medium rounded-xl transition-all duration-200 justify-center p-0 min-h-[44px] text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300`}
                  onClick={handleSignOut}
                  title={t('auth.signOut')}
                >
                  <LogOut className={`${iconSize} flex-shrink-0`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" align="center" className="bg-background/95 backdrop-blur-sm border-border/50">
                <p>{t('auth.signOut')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarRail />
    </>
  );
}

export function AppSidebarProvider({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="w-full">
      <div className="flex min-h-screen w-full">
        {children}
      </div>
    </SidebarProvider>
  );
}
