import React from 'react';
import { AdminSidebar, AdminSidebarProvider } from './AdminSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
      {/* Modern inset area with theme-aware background */}
      <SidebarInset className="bg-background min-h-screen flex flex-col admin-content">
        <AppHeader />
        <ScrollArea className="flex-1 overflow-x-hidden">
          {/* Clean container with consistent spacing like landing page */}
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 lg:py-12">
            {/* Enhanced content wrapper with modern styling */}
            <div className="space-y-8 animate-fade-in">
              {children}
            </div>
          </div>
        </ScrollArea>
      </SidebarInset>
    </AdminSidebarProvider>
  );
}