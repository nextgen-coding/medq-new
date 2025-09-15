"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Crisp } from "crisp-sdk-web";
import { useAuth } from '@/contexts/AuthContext';

// Loads Crisp chat widget on the client. Reads website ID from env.
export default function CrispChat() {
  const { user } = useAuth();
  const pathname = usePathname();
  
  // Don't load Crisp on course pages and admin routes
  const isCoursePage = pathname?.includes('/matieres/') && pathname?.includes('/cours/');
  const isAdminRoute = pathname?.includes('/admin');
  const isViewerPage = pathname?.includes('/viewer');
  
  if (isCoursePage || isAdminRoute) {
    return null;
  }
  
  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
    if (!id) {
      // Log even in production so we can see it in Vercel logs/console
      console.error("Crisp: NEXT_PUBLIC_CRISP_WEBSITE_ID is not set. Widget will not load.");
      return;
    }
    
    try {
      // Ensure global queue exists before configuring
      if (typeof window !== 'undefined') {
        (window as any).$crisp = (window as any).$crisp || [];
      }
      Crisp.configure(id);
      
      // When SDK is ready, show/hide based on route
      const w = window as any;
      if (typeof window !== 'undefined') {
        try {
          w.$crisp.push(["on", "ready", () => {
            try {
              if (isViewerPage) {
                w.$crisp.push(["do", "chat:hide"]);
              } else {
                w.$crisp.push(["do", "chat:show"]);
                if (window.innerWidth <= 768) {
                  w.$crisp.push(["do", "chat:show"]);
                }
              }
            } catch (_) {
              // noop
            }
          }]);
        } catch (_) {
          // noop
        }
      }
    } catch (e) {
      console.warn("Crisp: failed to configure", e);
    }

  // Handle window resize to hide/show Crisp based on page
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const w = window as any;
        w.$crisp = w.$crisp || [];
        try {
      if (isViewerPage) {
            w.$crisp.push(["do", "chat:hide"]);
          } else {
            w.$crisp.push(["do", "chat:show"]);
          }
        } catch (_) {
          // noop
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isViewerPage]);

  // Hide/show Crisp immediately on route change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    w.$crisp = w.$crisp || [];
    try {
      if (isViewerPage) {
        w.$crisp.push(["do", "chat:hide"]);
      } else {
        w.$crisp.push(["do", "chat:show"]);
      }
    } catch (_) {
      // noop
    }
  }, [isViewerPage]);

  // When a user is logged in, set their name (and email) in Crisp
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    w.$crisp = w.$crisp || [];
    
    try {
      if (user) {
        const nickname = user.name || (user.email ? user.email.split('@')[0] : undefined);
        if (nickname) {
          w.$crisp.push(["set", "user:nickname", [nickname]]);
        }
        if (user.email) {
          w.$crisp.push(["set", "user:email", [user.email]]);
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Crisp: failed to set user identity', e);
      }
    }
  }, [user]);

  return null;
}
