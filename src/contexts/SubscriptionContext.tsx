'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  hasActiveSubscription: boolean;
  isLoading: boolean;
  canAccessContent: (isFree: boolean) => boolean;
  isContentLocked: (isFree: boolean) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Check if subscription is still active
      const hasActiveSubscription = user.hasActiveSubscription && 
        (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) > new Date());
      
      setHasActiveSubscription(hasActiveSubscription || false);
      setIsLoading(false);
    } else {
      setHasActiveSubscription(false);
      setIsLoading(false);
    }
  }, [user]);

  const canAccessContent = (isFree: boolean): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (isFree) return true;
    return hasActiveSubscription;
  };

  const isContentLocked = (isFree: boolean): boolean => {
    return !canAccessContent(isFree);
  };

  return (
    <SubscriptionContext.Provider
      value={{
        hasActiveSubscription,
        isLoading,
        canAccessContent,
        isContentLocked,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
} 