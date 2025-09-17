'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type ColumnKey = 'mcq' | 'qroc' | 'clinical';

interface OrganizerEntry {
  id: string;
  type: string;
  text: string;
  number?: number;
  caseNumber?: number;
  originalIndex: number;
}

interface OrganizerContextValue {
  isOrganizerOpen: boolean;
  organizerState: Record<ColumnKey, OrganizerEntry[]> | null;
  setIsOrganizerOpen: (open: boolean) => void;
  setOrganizerState: (state: Record<ColumnKey, OrganizerEntry[]> | null) => void;
}

const OrganizerContext = createContext<OrganizerContextValue | undefined>(undefined);

export function OrganizerProvider({ children }: { children: ReactNode }) {
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(false);
  const [organizerState, setOrganizerState] = useState<Record<ColumnKey, OrganizerEntry[]> | null>(null);

  return (
    <OrganizerContext.Provider value={{
      isOrganizerOpen,
      organizerState,
      setIsOrganizerOpen,
      setOrganizerState,
    }}>
      {children}
    </OrganizerContext.Provider>
  );
}

export function useOrganizer() {
  const context = useContext(OrganizerContext);
  if (context === undefined) {
    // Return default values instead of throwing error
    return {
      isOrganizerOpen: false,
      organizerState: null,
      setIsOrganizerOpen: () => {},
      setOrganizerState: () => {},
    };
  }
  return context;
}