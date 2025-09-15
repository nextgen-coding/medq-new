'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { I18nProvider } from '@/i18n/I18nProvider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Suspense } from 'react'

const queryClient = new QueryClient()

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center">
        <div className="animate-pulse-subtle">
          <div className="h-4 w-24 bg-muted rounded mx-auto"></div>
        </div>
      </div>
    </div>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<LoadingFallback />}>
        <AuthProvider>
          <SubscriptionProvider>
            <ThemeProvider>
              <I18nProvider>
                <TooltipProvider>
                  {children}
                  <Toaster />
                  <Sonner />
                </TooltipProvider>
              </I18nProvider>
            </ThemeProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </Suspense>
    </QueryClientProvider>
  )
} 