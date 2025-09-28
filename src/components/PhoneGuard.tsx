'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneDialog } from '@/components/PhoneDialog';

interface PhoneGuardProps {
  children: React.ReactNode;
}

export function PhoneGuard({ children }: PhoneGuardProps) {
  const { user, isLoading } = useAuth();
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEffect(() => {
    // Don't show dialog while auth is loading
    if (isLoading) {
      setShowPhoneDialog(false);
      return;
    }

    // Only check phone when we have user data and auth is not loading
    if (user !== null) {
      if (!user.phone || user.phone.trim() === '') {
        setShowPhoneDialog(true);
      } else {
        setShowPhoneDialog(false);
      }
    }
  }, [user, isLoading]);

  const handleSavePhone = async (phone: string) => {
    setPhoneLoading(true);
    try {
      const res = await fetch('/api/user/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
        credentials: 'include',
      });
      if (res.ok) {
        // Refresh the page to update user context
        if (typeof window !== 'undefined') window.location.reload();
      }
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <>
      <PhoneDialog open={showPhoneDialog} onSave={handleSavePhone} loading={phoneLoading} />
      {children}
    </>
  );
}
