'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Forces the application theme to light while this component is mounted.
 * Restores the previous theme on unmount.
 */
export function ForceLightTheme() {
  const { theme, setTheme } = useTheme();
  const previousThemeRef = useRef<'light' | 'dark'>(theme);

  // Capture the real previous theme (from localStorage if available) and enforce light once on mount
  useEffect(() => {
    try {
      const stored = (localStorage.getItem('theme') as 'light' | 'dark' | null) ?? null;
      if (stored) previousThemeRef.current = stored;
    } catch {
      // ignore access issues
    }

    if (theme !== 'light') setTheme('light');

    return () => {
      const prev = previousThemeRef.current;
      if (prev && prev !== 'light') setTheme(prev);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If theme changes while mounted (e.g., system toggle), keep it light
  useEffect(() => {
    if (theme !== 'light') setTheme('light');
  }, [theme, setTheme]);

  return null;
}