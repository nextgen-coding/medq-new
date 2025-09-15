'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { AuthLoadingScreen } from './AuthLoadingScreen';

interface MaintainerRouteProps {
  children: React.ReactNode;
}

export function MaintainerRoute({ children }: MaintainerRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isMaintainerOrAdmin = !!user && (user.role === 'maintainer' || user.role === 'admin');

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        sessionStorage.setItem('redirectAfterLogin', pathname);
        router.replace('/auth');
        return;
      }
      if (!isMaintainerOrAdmin) {
        router.replace('/dashboard');
        return;
      }
    }
  }, [user, isLoading, isMaintainerOrAdmin, router, pathname]);

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!user || !isMaintainerOrAdmin) {
    return null;
  }

  return <>{children}</>;
}
