
import React, { useEffect } from 'react';
import i18n from './index';

interface I18nProviderProps {
  children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  useEffect(() => {
    // Ensure i18next is initialized
    if (!i18n.isInitialized) {
      i18n.init();
    }
  }, []);
  
  return <>{children}</>;
}
