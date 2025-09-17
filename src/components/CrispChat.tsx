"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Crisp } from "crisp-sdk-web";
import { useAuth } from '@/contexts/AuthContext';

// Loads Crisp chat widget on the client. Reads website ID from env.
export default function CrispChat() {
  const { user } = useAuth();
  const pathname = usePathname();
  const configuredRef = useRef(false);

  const isCoursePage = pathname?.includes('/matieres/') && pathname?.includes('/cours/');
  const isAdminRoute = pathname?.includes('/admin');
  const isViewerPage = pathname?.includes('/viewer');

  // Any route where we want the chat visually hidden
  const shouldHide = isCoursePage || isAdminRoute || isViewerPage;

  // Configure Crisp once (only if not on a restricted page at first mount to avoid unnecessary script on initial load)
  useEffect(() => {
    if (configuredRef.current) return;
    if (shouldHide) return; // defer configuration until user hits a non-restricted route

    const id = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
    if (!id) {
      console.error("Crisp: NEXT_PUBLIC_CRISP_WEBSITE_ID is not set. Widget will not load.");
      return;
    }
    try {
      if (typeof window !== 'undefined') {
        (window as any).$crisp = (window as any).$crisp || [];
        Crisp.configure(id);
        configuredRef.current = true;
      }
    } catch (e) {
      console.warn("Crisp: failed to configure", e);
    }
  }, [shouldHide]);

  // Show / hide on every route change (and after potential lazy configuration)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    w.$crisp = w.$crisp || [];

    // If we navigated to a non-restricted page and never configured, do it now
    if (!configuredRef.current && !shouldHide) {
      const id = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
      if (id) {
        try {
          Crisp.configure(id);
          configuredRef.current = true;
        } catch (e) {
          console.warn('Crisp: late configure failed', e);
        }
      }
    }

    try {
      if (shouldHide) {
        w.$crisp.push(["do", "chat:hide"]);
      } else {
        w.$crisp.push(["do", "chat:show"]);
        if (window.innerWidth <= 768) {
          w.$crisp.push(["do", "chat:show"]);
        }
      }
    } catch (_) {}
  }, [shouldHide]);

  // Handle window resize to re-apply visibility intent
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      const w = window as any;
      w.$crisp = w.$crisp || [];
      try {
        if (shouldHide) {
          w.$crisp.push(["do", "chat:hide"]);
        } else {
          w.$crisp.push(["do", "chat:show"]);
        }
      } catch (_) {}
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [shouldHide]);

  // Sync user identity (only after configuration)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!configuredRef.current) return;
    const w = window as any;
    w.$crisp = w.$crisp || [];
    try {
      if (user) {
        const nickname = user.name || (user.email ? user.email.split('@')[0] : undefined);
        if (nickname) w.$crisp.push(["set", "user:nickname", [nickname]]);
        if (user.email) w.$crisp.push(["set", "user:email", [user.email]]);
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Crisp: failed to set user identity', e);
      }
    }
  }, [user]);

  return null;
}
