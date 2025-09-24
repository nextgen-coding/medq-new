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
  CheckCircle,
  Bell,
  CreditCard,
  Gift,
  DollarSign,
  ChevronDown,
  ChevronRight
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
  
  const [paymentMenuOpen, setPaymentMenuOpen] = React.useState(() => {
    // Initialize dropdown as open if user is on a payment-related page
    return ['/admin/payments', '/admin/vouchers', '/admin/pricing'].some(path => 
      pathname === path || pathname.startsWith(path + '/')
    );
  });

  const [contentMenuOpen, setContentMenuOpen] = React.useState(() => {
    // Initialize dropdown as open if user is on a content-related page
    return ['/admin/management', '/admin/sessions'].some(path => 
      pathname === path || pathname.startsWith(path + '/')
    );
  });

  const [importMenuOpen, setImportMenuOpen] = React.useState(() => {
    // Initialize dropdown as open if user is on an import-related page
    return ['/admin/import', '/admin/validation'].some(path => 
      pathname === path || pathname.startsWith(path + '/')
    );
  });

  const [userManagementMenuOpen, setUserManagementMenuOpen] = React.useState(() => {
    // Initialize dropdown as open if user is on a user management-related page
    return ['/admin/reports', '/admin/users'].some(path => 
      pathname === path || pathname.startsWith(path + '/')
    );
  });

  // Auto-open payment menu when navigating to payment pages (but don't force it if manually closed)
  React.useEffect(() => {
    const isOnPaymentPage = ['/admin/payments', '/admin/vouchers', '/admin/pricing'].some(path => 
      pathname === path || pathname.startsWith(path + '/')
    );
    // Only auto-open if we're on a payment page AND the menu is currently closed
    // This prevents forcing it open if user manually closed it
    if (isOnPaymentPage && !paymentMenuOpen) {
      setPaymentMenuOpen(true);
    }
  }, [pathname]); // Removed paymentMenuOpen from dependencies to prevent forcing open

  // Auto-open content menu when navigating to content pages
  React.useEffect(() => {
    const isOnContentPage = ['/admin/management', '/admin/sessions'].some(path => 
      pathname === path || pathname.startsWith(path + '/')
    );
    if (isOnContentPage && !contentMenuOpen) {
      setContentMenuOpen(true);
    }
  }, [pathname]);

  // Auto-open import menu when navigating to import pages
  React.useEffect(() => {
    const isOnImportPage = ['/admin/import', '/admin/validation'].some(path => 
      pathname === path || pathname.startsWith(path + '/')
    );
    if (isOnImportPage && !importMenuOpen) {
      setImportMenuOpen(true);
    }
  }, [pathname]);

  // Auto-open user management menu when navigating to user management pages
  React.useEffect(() => {
    const isOnUserManagementPage = ['/admin/reports', '/admin/users'].some(path => 
      pathname === path || pathname.startsWith(path + '/')
    );
    if (isOnUserManagementPage && !userManagementMenuOpen) {
      setUserManagementMenuOpen(true);
    }
  }, [pathname]);
  
  // Memoize stable values to prevent re-renders
  const iconSize = React.useMemo(() => 
    state === 'expanded' ? 'h-5 w-5' : 'h-6 w-6', 
    [state]
  );
  
  const studentPanelItem = React.useMemo(() => ({
    label: t('admin.studentPanel', { defaultValue: 'Tableau de bord étudiant' }),
    icon: GraduationCap,
    href: '/dashboard',
    description: 'Aller au tableau de bord étudiant'
  }), [t]);
  
  const isAdmin = user?.role === 'admin';
  const isMaintainer = user?.role === 'maintainer';

  const adminMenuItems = React.useMemo(() => [
    { label: t('admin.dashboard', { defaultValue: 'Tableau de bord' }), icon: LayoutDashboard, href: '/admin/dashboard', description: t('admin.manageContent', { defaultValue: 'Gérer le contenu' }) },
    { label: 'Notifications', icon: Bell, href: '/admin/inbox', description: 'Voir les notifications reçues' },
    studentPanelItem
  ], [t, studentPanelItem]);

  const paymentMenuItems = React.useMemo(() => [
    { label: 'Paiements', icon: CreditCard, href: '/admin/payments', description: 'Gérer les paiements et abonnements' },
    { label: 'Codes de Bon', icon: Gift, href: '/admin/vouchers', description: 'Créer et gérer les codes de bon' },
    { label: 'Prix et Remises', icon: DollarSign, href: '/admin/pricing', description: 'Configurer les prix et remises' }
  ], []);

  const contentMenuItems = React.useMemo(() => [
    { label: t('admin.management', { defaultValue: 'Gestion Cours' }), icon: BookOpen, href: '/admin/management', description: 'Gérer les spécialités, cours et questions' },
    { label: 'Gestion Sessions', icon: FileText, href: '/admin/sessions', description: 'Gérer/importer les sessions' }
  ], [t]);

  const importMenuItems = React.useMemo(() => [
    { label: t('admin.importQuestions', { defaultValue: 'Importation' }), icon: Upload, href: '/admin/import', description: 'Importer des questions QROC' },
    { label: 'Validation', icon: CheckCircle, href: '/admin/validation', description: 'Système de validation IA' }
  ], [t]);

  const userManagementMenuItems = React.useMemo(() => [
    { label: t('admin.reports', { defaultValue: 'Rapports' }), icon: AlertTriangle, href: '/admin/reports', description: 'Voir les signalements' },
    { label: t('admin.users', { defaultValue: 'Utilisateurs' }), icon: Users, href: '/admin/users', description: 'Gérer les utilisateurs' }
  ], [t]);

  const maintainerMenuItems = React.useMemo(() => [
    { label: 'Gestion Sessions', icon: FileText, href: '/maintainer/sessions', description: 'Créer des sessions' },
    { label: t('admin.reports', { defaultValue: 'Signalements' }), icon: AlertTriangle, href: '/maintainer/reports', description: 'Rapports par niveau' },
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
      toast.error(t('auth.signOutError', { defaultValue: 'Erreur de déconnexion' }), {
        description: t('auth.unexpectedError', { defaultValue: 'Une erreur inattendue s\'est produite' }),
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
                  <span className="sr-only">Fermer la barre latérale</span>
                </Button>
              )}
              {state === "expanded" ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg border border-gray-100">
                    <img 
                      src="https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcraFSYUmbide7MKPVFpROQi36XnZbchzSA1G4ax" 
                      alt="Medq Logo" 
                      className="w-6 h-6 object-contain"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-base sm:text-lg bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                      MedQ
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Panneau Admin</span>
                  </div>
                </div>
              ) : (
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg border border-gray-100">
                  <img 
                    src="https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcraFSYUmbide7MKPVFpROQi36XnZbchzSA1G4ax" 
                    alt="Medq Logo" 
                    className="w-7 h-7 object-contain"
                  />
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
                      state === 'expanded' || isMobile
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
                          title={item.description || item.label}
                        >
                          <div className="flex items-center">
                            <item.icon className={iconClassName} />
                            {(state === 'expanded' || isMobile) && (
                              <span className="font-medium text-sm ml-3">{item.label}</span>
                            )}
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}

                  {/* Content Management Dropdown */}
                  {isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        className={`group transition-all duration-200 font-medium rounded-xl ${
                          state === 'expanded' || isMobile
                            ? 'px-3 py-3 min-h-[44px] flex items-center justify-between' 
                            : 'p-0 min-h-[44px] w-full flex items-center justify-center'
                        } ${
                          contentMenuItems.some(contentItem => pathname === contentItem.href || pathname.startsWith(contentItem.href + '/'))
                            ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/25'
                            : 'hover:bg-muted/80 text-foreground hover:text-blue-600'
                        }`}
                        title="Gestion des Contenus"
                        onClick={() => {
                          if (state === 'expanded' || isMobile) {
                            // Always allow toggling regardless of active state on expanded or mobile
                            setContentMenuOpen(!contentMenuOpen);
                          } else {
                            // If collapsed on desktop, navigate to the first content item
                            router.push('/admin/management');
                          }
                        }}
                      >
                        <div className="flex items-center">
                          <BookOpen className={`${iconSize} ${
                            contentMenuItems.some(contentItem => pathname === contentItem.href || pathname.startsWith(contentItem.href + '/'))
                              ? 'text-white' 
                              : 'text-blue-500 group-hover:text-blue-600'
                          } transition-all flex-shrink-0`} />
                          {(state === 'expanded' || isMobile) && (
                            <span className="font-medium text-sm ml-3">Gestion des Contenus</span>
                          )}
                        </div>
                        {(state === 'expanded' || isMobile) && (
                          <div className="ml-auto">
                            {contentMenuOpen ? (
                              <ChevronDown className="h-4 w-4 transition-transform" />
                            ) : (
                              <ChevronRight className="h-4 w-4 transition-transform" />
                            )}
                          </div>
                        )}
                      </SidebarMenuButton>
                      
                      {/* Content Submenu */}
                      {(state === 'expanded' || isMobile) && contentMenuOpen && (
                        <div className="ml-6 mt-1 space-y-1">
                          {contentMenuItems.map((contentItem) => {
                            const isContentActive = pathname === contentItem.href || pathname.startsWith(contentItem.href + '/');
                            
                            return (
                              <SidebarMenuButton
                                key={contentItem.href}
                                className={`group transition-all duration-200 font-medium rounded-lg px-3 py-2 min-h-[36px] flex items-center ${
                                  isContentActive
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    : 'hover:bg-muted/60 text-muted-foreground hover:text-blue-700'
                                }`}
                                title={contentItem.description}
                                onClick={() => router.push(contentItem.href)}
                              >
                                <contentItem.icon className={`h-4 w-4 ${
                                  isContentActive ? 'text-blue-600' : 'text-blue-500 group-hover:text-blue-600'
                                } transition-all flex-shrink-0`} />
                                <span className="font-medium text-sm ml-3">{contentItem.label}</span>
                              </SidebarMenuButton>
                            );
                          })}
                        </div>
                      )}
                    </SidebarMenuItem>
                  )}

                  {/* Import Management Dropdown */}
                  {isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        className={`group transition-all duration-200 font-medium rounded-xl ${
                          state === 'expanded' || isMobile
                            ? 'px-3 py-3 min-h-[44px] flex items-center justify-between' 
                            : 'p-0 min-h-[44px] w-full flex items-center justify-center'
                        } ${
                          importMenuItems.some(importItem => pathname === importItem.href || pathname.startsWith(importItem.href + '/'))
                            ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/25'
                            : 'hover:bg-muted/80 text-foreground hover:text-blue-600'
                        }`}
                        title="Gestion d'Importation"
                        onClick={() => {
                          if (state === 'expanded' || isMobile) {
                            // Always allow toggling regardless of active state on expanded or mobile
                            setImportMenuOpen(!importMenuOpen);
                          } else {
                            // If collapsed on desktop, navigate to the first import item
                            router.push('/admin/import');
                          }
                        }}
                      >
                        <div className="flex items-center">
                          <Upload className={`${iconSize} ${
                            importMenuItems.some(importItem => pathname === importItem.href || pathname.startsWith(importItem.href + '/'))
                              ? 'text-white' 
                              : 'text-blue-500 group-hover:text-blue-600'
                          } transition-all flex-shrink-0`} />
                          {(state === 'expanded' || isMobile) && (
                            <span className="font-medium text-sm ml-3">Gestion d'Importation</span>
                          )}
                        </div>
                        {(state === 'expanded' || isMobile) && (
                          <div className="ml-auto">
                            {importMenuOpen ? (
                              <ChevronDown className="h-4 w-4 transition-transform" />
                            ) : (
                              <ChevronRight className="h-4 w-4 transition-transform" />
                            )}
                          </div>
                        )}
                      </SidebarMenuButton>
                      
                      {/* Import Submenu */}
                      {(state === 'expanded' || isMobile) && importMenuOpen && (
                        <div className="ml-6 mt-1 space-y-1">
                          {importMenuItems.map((importItem) => {
                            const isImportActive = pathname === importItem.href || pathname.startsWith(importItem.href + '/');
                            
                            return (
                              <SidebarMenuButton
                                key={importItem.href}
                                className={`group transition-all duration-200 font-medium rounded-lg px-3 py-2 min-h-[36px] flex items-center ${
                                  isImportActive
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    : 'hover:bg-muted/60 text-muted-foreground hover:text-blue-700'
                                }`}
                                title={importItem.description}
                                onClick={() => router.push(importItem.href)}
                              >
                                <importItem.icon className={`h-4 w-4 ${
                                  isImportActive ? 'text-blue-600' : 'text-blue-500 group-hover:text-blue-600'
                                } transition-all flex-shrink-0`} />
                                <span className="font-medium text-sm ml-3">{importItem.label}</span>
                              </SidebarMenuButton>
                            );
                          })}
                        </div>
                      )}
                    </SidebarMenuItem>
                  )}

                  {/* User Management Dropdown */}
                  {isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        className={`group transition-all duration-200 font-medium rounded-xl ${
                          state === 'expanded' || isMobile
                            ? 'px-3 py-3 min-h-[44px] flex items-center justify-between' 
                            : 'p-0 min-h-[44px] w-full flex items-center justify-center'
                        } ${
                          userManagementMenuItems.some(userItem => pathname === userItem.href || pathname.startsWith(userItem.href + '/'))
                            ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/25'
                            : 'hover:bg-muted/80 text-foreground hover:text-blue-600'
                        }`}
                        title="Gestion des Utilisateurs"
                        onClick={() => {
                          if (state === 'expanded' || isMobile) {
                            // Always allow toggling regardless of active state on expanded or mobile
                            setUserManagementMenuOpen(!userManagementMenuOpen);
                          } else {
                            // If collapsed on desktop, navigate to the first user management item
                            router.push('/admin/reports');
                          }
                        }}
                      >
                        <div className="flex items-center">
                          <Users className={`${iconSize} ${
                            userManagementMenuItems.some(userItem => pathname === userItem.href || pathname.startsWith(userItem.href + '/'))
                              ? 'text-white' 
                              : 'text-blue-500 group-hover:text-blue-600'
                          } transition-all flex-shrink-0`} />
                          {(state === 'expanded' || isMobile) && (
                            <span className="font-medium text-sm ml-3">Gestion des Utilisateurs</span>
                          )}
                        </div>
                        {(state === 'expanded' || isMobile) && (
                          <div className="ml-auto">
                            {userManagementMenuOpen ? (
                              <ChevronDown className="h-4 w-4 transition-transform" />
                            ) : (
                              <ChevronRight className="h-4 w-4 transition-transform" />
                            )}
                          </div>
                        )}
                      </SidebarMenuButton>
                      
                      {/* User Management Submenu */}
                      {(state === 'expanded' || isMobile) && userManagementMenuOpen && (
                        <div className="ml-6 mt-1 space-y-1">
                          {userManagementMenuItems.map((userItem) => {
                            const isUserActive = pathname === userItem.href || pathname.startsWith(userItem.href + '/');
                            
                            return (
                              <SidebarMenuButton
                                key={userItem.href}
                                className={`group transition-all duration-200 font-medium rounded-lg px-3 py-2 min-h-[36px] flex items-center ${
                                  isUserActive
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    : 'hover:bg-muted/60 text-muted-foreground hover:text-blue-700'
                                }`}
                                title={userItem.description}
                                onClick={() => router.push(userItem.href)}
                              >
                                <userItem.icon className={`h-4 w-4 ${
                                  isUserActive ? 'text-blue-600' : 'text-blue-500 group-hover:text-blue-600'
                                } transition-all flex-shrink-0`} />
                                <span className="font-medium text-sm ml-3">{userItem.label}</span>
                              </SidebarMenuButton>
                            );
                          })}
                        </div>
                      )}
                    </SidebarMenuItem>
                  )}

                  {/* Payment Management Dropdown */}
                  {isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        className={`group transition-all duration-200 font-medium rounded-xl ${
                          state === 'expanded' 
                            ? 'px-3 py-3 min-h-[44px] flex items-center justify-between' 
                            : 'p-0 min-h-[44px] w-full flex items-center justify-center'
                        } ${
                          paymentMenuItems.some(paymentItem => pathname === paymentItem.href || pathname.startsWith(paymentItem.href + '/'))
                            ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/25'
                            : 'hover:bg-muted/80 text-foreground hover:text-blue-600'
                        }`}
                        title="Gestion des Paiements"
                        onClick={() => {
                          if (state === 'expanded' || isMobile) {
                            // Always allow toggling regardless of active state on expanded or mobile
                            setPaymentMenuOpen(!paymentMenuOpen);
                          } else {
                            // If collapsed on desktop, navigate to the first payment item
                            router.push('/admin/payments');
                          }
                        }}
                      >
                        <div className="flex items-center">
                          <CreditCard className={`${iconSize} ${
                            paymentMenuItems.some(paymentItem => pathname === paymentItem.href || pathname.startsWith(paymentItem.href + '/'))
                              ? 'text-white' 
                              : 'text-blue-500 group-hover:text-blue-600'
                          } transition-all flex-shrink-0`} />
                          {(state === 'expanded' || isMobile) && (
                            <span className="font-medium text-sm ml-3">Gestion des Paiements</span>
                          )}
                        </div>
                        {(state === 'expanded' || isMobile) && (
                          <div className="ml-auto">
                            {paymentMenuOpen ? (
                              <ChevronDown className="h-4 w-4 transition-transform" />
                            ) : (
                              <ChevronRight className="h-4 w-4 transition-transform" />
                            )}
                          </div>
                        )}
                      </SidebarMenuButton>
                      
                      {/* Payment Submenu */}
                      {(state === 'expanded' || isMobile) && paymentMenuOpen && (
                        <div className="ml-6 mt-1 space-y-1">
                          {paymentMenuItems.map((paymentItem) => {
                            const isPaymentActive = pathname === paymentItem.href || pathname.startsWith(paymentItem.href + '/');
                            
                            return (
                              <SidebarMenuButton
                                key={paymentItem.href}
                                className={`group transition-all duration-200 font-medium rounded-lg px-3 py-2 min-h-[36px] flex items-center ${
                                  isPaymentActive
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    : 'hover:bg-muted/60 text-muted-foreground hover:text-blue-700'
                                }`}
                                title={paymentItem.description}
                                onClick={() => router.push(paymentItem.href)}
                              >
                                <paymentItem.icon className={`h-4 w-4 ${
                                  isPaymentActive ? 'text-blue-600' : 'text-blue-500 group-hover:text-blue-600'
                                } transition-all flex-shrink-0`} />
                                <span className="font-medium text-sm ml-3">{paymentItem.label}</span>
                              </SidebarMenuButton>
                            );
                          })}
                        </div>
                      )}
                    </SidebarMenuItem>
                  )}
                  
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
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                          : 'hover:bg-muted/80 text-foreground hover:text-blue-600'
                      }`;

                      const iconClassName = `${iconSize} ${isStudentPanel ? 'text-white' : 'text-green-500 group-hover:text-green-600'} transition-all flex-shrink-0`;
                      
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton 
                            className={buttonClassName}
                            onClick={() => router.push(item.href)}
                            title={item.description || item.label}
                          >
                            <div className="flex items-center">
                              <item.icon className={iconClassName} />
                              {state === 'expanded' && (
                                <span className="font-medium text-sm ml-3">{item.label}</span>
                              )}
                            </div>
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
              title={t('auth.signOut', { defaultValue: 'Se déconnecter' })}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {state === "expanded" && <span className="ml-3 font-medium text-sm">{t('auth.signOut', { defaultValue: 'Se déconnecter' })}</span>}
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