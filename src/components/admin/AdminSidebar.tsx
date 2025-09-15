'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
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
import { 
  LayoutDashboard, 
  Users, 
  LogOut, 
  X, 
  Menu, 
  BookOpen, 
  FileText, 
  Upload, 
  AlertTriangle,
  ArrowLeft,
  GraduationCap,
  Brain,
  CheckCircle
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
// Removed Tooltip around sign-out to prevent ref update loops
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export function AdminSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { state, setOpen, setOpenMobile, isMobile: sidebarIsMobile, open, openMobile, toggleSidebar } = useSidebar();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  
  // Memoize stable values to prevent re-renders
  const iconSize = React.useMemo(() => 
    state === 'expanded' ? 'h-5 w-5' : 'h-6 w-6', 
    [state]
  );
  
  const studentPanelItem = React.useMemo(() => ({
    label: t('admin.studentPanel') || 'Student Panel',
    icon: GraduationCap,
    href: '/dashboard',
    description: 'Go to student dashboard'
  }), [t]);
  
  const isAdmin = user?.role === 'admin';
  const isMaintainer = user?.role === 'maintainer';

  const adminMenuItems = React.useMemo(() => [
    { label: t('admin.dashboard'), icon: LayoutDashboard, href: '/admin/dashboard', description: t('admin.manageContent') },
    { label: t('admin.management') || 'Management', icon: BookOpen, href: '/admin/management', description: 'Manage specialties, courses, and questions' },
    { label: 'Validation', icon: CheckCircle, href: '/admin/validation', description: 'AI validation system' },
    { label: 'Sessions', icon: FileText, href: '/admin/sessions', description: 'Manage/import sessions' },
    { label: t('admin.users'), icon: Users, href: '/admin/users', description: 'Manage users' },
    { label: t('admin.importQuestions'), icon: Upload, href: '/admin/import', description: 'Import QROC questions' },
    { label: t('admin.reports'), icon: AlertTriangle, href: '/admin/reports', description: 'View reports' },
    studentPanelItem
  ], [t, studentPanelItem]);

  const maintainerMenuItems = React.useMemo(() => [
    { label: 'Sessions', icon: FileText, href: '/maintainer/sessions', description: 'Créer des sessions' },
    { label: t('admin.reports'), icon: AlertTriangle, href: '/maintainer/reports', description: 'Rapports par niveau' },
    studentPanelItem
  ], [t, studentPanelItem]);

  const menuItems = React.useMemo(() => 
    isAdmin ? adminMenuItems : isMaintainer ? maintainerMenuItems : [studentPanelItem],
    [isAdmin, isMaintainer, adminMenuItems, maintainerMenuItems, studentPanelItem]
  );

  const handleSignOut = React.useCallback(async () => {
    try {
      await logout();
      router.push('/auth');
    } catch (err) {
      console.error('Unexpected sign out error:', err);
      toast.error(t('auth.signOutError'), {
        description: t('auth.unexpectedError'),
      });
    }
  }, [logout, router, t]);

  const handleCloseSidebar = React.useCallback(() => {
    if (sidebarIsMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  }, [sidebarIsMobile, setOpenMobile, setOpen]);

  const handleToggleSidebar = React.useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  return (
    <>
      <Sidebar className="border-r border-border bg-background shadow-lg max-w-[80vw] sm:max-w-none" collapsible="icon">
        <SidebarHeader className={`border-b border-border py-3 sm:py-4 ${state === 'expanded' ? 'px-4 sm:px-6' : 'px-2'}`}>
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-3">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseSidebar}
                  className="md:hidden hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close sidebar</span>
                </Button>
              )}
              {state === "expanded" ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-base sm:text-lg bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                      MedQ
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Admin Panel</span>
                  </div>
                </div>
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                  <Brain className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <ScrollArea className="h-full">
            <SidebarGroup className="mt-3 sm:mt-4">
              <SidebarGroupContent>
                <SidebarMenu className={`space-y-2 ${state === 'expanded' ? 'px-2 sm:px-3' : 'px-0'}`}>
                  {menuItems.slice(0, -1).map((item) => {
                    // Active logic: root '/admin' should NOT stay active on all sub-routes
                    // Other items remain active on their nested paths
                    let isActive: boolean;
                    if (item.href === '/admin/dashboard') {
                      isActive = pathname === '/admin/dashboard';
                    } else {
                      isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    }
                    
                    const buttonClassName = `group transition-all duration-200 font-medium rounded-xl ${
                      state === 'expanded' 
                        ? 'px-3 py-3 min-h-[44px] flex items-center' 
                        : 'p-0 min-h-[44px] w-full flex items-center justify-center'
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/25'
                        : 'hover:bg-muted/80 text-foreground hover:text-blue-600'
                    }`;

                    const iconClassName = `${iconSize} ${isActive ? 'text-white' : 'text-blue-500 group-hover:text-blue-600'} transition-all flex-shrink-0`;
                    
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton 
                          className={buttonClassName}
                          onClick={() => router.push(item.href)}
                        >
                          <item.icon className={iconClassName} />
                          {state === 'expanded' && (
                            <span className="font-medium text-sm">{item.label}</span>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                  
                  {/* Separator */}
                  <div className={`${state === 'expanded' ? 'mx-2 sm:mx-3' : 'mx-0'} my-3 sm:my-4`}>
                    <div className="h-px bg-border"></div>
                  </div>
                  
                  {/* Student Panel - Last item */}
                  {
                    (() => {
                      const item = menuItems[menuItems.length - 1];
                      const isStudentPanel = item.href === '/dashboard' && pathname.startsWith('/dashboard');
                      
                      const buttonClassName = `group transition-all duration-200 font-medium rounded-xl ${
                        state === 'expanded' 
                          ? 'px-3 py-3 min-h-[44px] flex items-center' 
                          : 'p-0 min-h-[44px] w-full flex items-center justify-center'
                      } ${
                        isStudentPanel
                          ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-500/25'
                          : 'hover:bg-muted/80 text-foreground hover:text-green-600'
                      }`;

                      const iconClassName = `${iconSize} ${isStudentPanel ? 'text-white' : 'text-green-500 group-hover:text-green-600'} transition-all flex-shrink-0`;
                      
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton 
                            className={buttonClassName}
                            onClick={() => router.push(item.href)}
                          >
                            <item.icon className={iconClassName} />
                            {state === 'expanded' && (
                              <span className="font-medium text-sm">{item.label}</span>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })()
                  }
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </ScrollArea>
        </SidebarContent>
        
        <SidebarFooter className={`border-t border-border py-2.5 sm:py-3 bg-background ${state === 'expanded' ? 'px-3 sm:px-4' : 'px-2'}`}>
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className={`text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl ${
                state === 'expanded' 
                  ? 'w-full justify-start px-3 py-3 min-h-[44px]' 
                  : 'w-full h-[44px] p-0 flex items-center justify-center'
              }`}
              onClick={handleSignOut}
              title={t('auth.signOut')}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {state === "expanded" && <span className="ml-3 font-medium text-sm">{t('auth.signOut')}</span>}
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarRail />
    </>
  );
}

export function AdminSidebarProvider({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false} className="w-full">
      <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
        {children}
      </div>
    </SidebarProvider>
  );
}