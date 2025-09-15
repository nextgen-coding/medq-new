'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProfileCompletionGuardProps {
  children: React.ReactNode;
}

export function ProfileCompletionGuard({ children }: ProfileCompletionGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    // If user is authenticated but profile is not complete, redirect to profile completion
    if (user && !user.profileCompleted) {
      router.push('/profile/complete');
    }
  }, [user, isLoading, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, don't render children (let middleware handle redirect)
  if (!user) {
    return null;
  }

  // If profile is not complete, don't render children (redirecting to profile completion)
  if (!user.profileCompleted) {
    return null;
  }

  // Profile is complete, render children
  return <>{children}</>;
} 