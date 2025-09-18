'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { CompactAuthLoader } from './CompactAuthLoader';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        // Store the current path to redirect back after login
        sessionStorage.setItem('redirectAfterLogin', pathname);
        router.replace('/auth');
        return;
      }
      
      if (!isAdmin) {
        router.replace('/dashboard');
        return;
      }
    }
  }, [user, isAdmin, isLoading, router, pathname]);

  if (isLoading) return <CompactAuthLoader />;

  if (!user || !isAdmin) {
    return null;
  }

  return <>{children}</>;
} 