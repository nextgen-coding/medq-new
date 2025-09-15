import { useState, useEffect } from 'react';

export function useOAuthLoading() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);

  // Reset loading states when user returns to the auth page
  useEffect(() => {
    const handleBeforeUnload = () => {
      setIsGoogleLoading(false);
      setIsFacebookLoading(false);
    };

    const handlePopState = () => {
      // Small delay to ensure the page has fully loaded
      setTimeout(() => {
        setIsGoogleLoading(false);
        setIsFacebookLoading(false);
      }, 100);
    };

    const handleVisibilityChange = () => {
      // Reset loading states when page becomes visible again
      if (!document.hidden) {
        setIsGoogleLoading(false);
        setIsFacebookLoading(false);
      }
    };

    // Reset loading states when component mounts (user returned to page)
    setIsGoogleLoading(false);
    setIsFacebookLoading(false);

    // Listen for page unload (user navigates away)
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Listen for browser back/forward navigation
    window.addEventListener('popstate', handlePopState);
    
    // Listen for page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const startGoogleLoading = () => setIsGoogleLoading(true);
  const stopGoogleLoading = () => setIsGoogleLoading(false);
  
  const startFacebookLoading = () => setIsFacebookLoading(true);
  const stopFacebookLoading = () => setIsFacebookLoading(false);

  return {
    isGoogleLoading,
    isFacebookLoading,
    startGoogleLoading,
    stopGoogleLoading,
    startFacebookLoading,
    stopFacebookLoading,
  };
} 