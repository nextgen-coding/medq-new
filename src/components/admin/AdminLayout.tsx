import React from 'react';
import { AdminSidebar, AdminSidebarProvider } from './AdminSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { AppHeader } from '@/components/layout/AppHeader';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const isMobile = useIsMobile();
  
  return (
    <AdminSidebarProvider>
      {/* Custom animations matching landing page */}
      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 1s ease-out;
        }
        
        /* Ensure consistent background with dark mode support */
        .admin-content {
          background-color: rgb(255 255 255) !important;
        }
        
        .dark .admin-content {
          background-color: rgb(3 7 18) !important;
        }
      `}</style>
      
      <AdminSidebar />
      {/* Modern main area with theme-aware background and proper sticky positioning */}
      <main className="relative flex min-h-screen flex-1 flex-col bg-background admin-content peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow">
        {/* Sticky header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <AppHeader />
        </header>
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Clean container with consistent spacing like landing page */}
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 lg:py-12">
            {/* Enhanced content wrapper with modern styling */}
            <div className="space-y-8 animate-fade-in">
              {children}
            </div>
          </div>
        </div>
      </main>
    </AdminSidebarProvider>
  );
}