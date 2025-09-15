import { useState, useEffect } from 'react';

export function useVisibility() {
  const [isVisible, setIsVisible] = useState(true); // Default to true for SSR

  useEffect(() => {
    // Only run on client side
    if (typeof document === 'undefined') return;

    // Set initial state
    setIsVisible(!document.hidden);

    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
