'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneDialog } from '@/components/PhoneDialog';

interface PhoneGuardProps {
  children: React.ReactNode;
}

export function PhoneGuard({ children }: PhoneGuardProps) {
  const { user } = useAuth();
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEffect(() => {
    if (user && !user.phone) {
      setShowPhoneDialog(true);
    } else {
      setShowPhoneDialog(false);
    }
  }, [user]);

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
