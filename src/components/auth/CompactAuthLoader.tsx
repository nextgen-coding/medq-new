"use client";
import React from "react";

/**
 * CompactAuthLoader
 * A lightweight, distraction-free loader used while the auth state initializes.
 * - Theme-aware
 * - Small MedQ logo in a soft card
 * - Accessible spinner and copy
 */
export function CompactAuthLoader() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
      <div className="w-[280px] sm:w-[320px] rounded-2xl border border-border/50 bg-card shadow-xl p-5 sm:p-6">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
          {/* Logo card */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-xl flex items-center justify-center shadow-md border border-gray-100">
            <img
              src="https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcraFSYUmbide7MKPVFpROQi36XnZbchzSA1G4ax"
              alt="MedQ"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
            />
          </div>

          {/* Title */}
          <h2 className="text-base sm:text-lg font-semibold tracking-tight">Chargement…</h2>

          {/* Spinner */}
          <div className="relative h-8 w-8 sm:h-10 sm:w-10">
            <div className="absolute inset-0 rounded-full border-2 sm:border-[3px] border-muted animate-spin" />
            <div className="absolute inset-0 rounded-full border-2 sm:border-[3px] border-transparent border-t-blue-600 dark:border-t-blue-400 animate-spin" />
            <span className="sr-only">Chargement</span>
          </div>

          {/* Helper text */}
          <p className="text-xs sm:text-sm text-muted-foreground">Initialisation de votre session…</p>
        </div>
      </div>
    </div>
  );
}

export default CompactAuthLoader;
