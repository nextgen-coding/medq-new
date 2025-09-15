'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
          setError(`OAuth error: ${error}`);
          setIsLoading(false);
          return;
        }

        if (!code) {
          setError('No authorization code received');
          setIsLoading(false);
          return;
        }

        // Determine which OAuth provider to use based on the state parameter
        const state = searchParams.get('state');
        const isFacebook = state === 'facebook';
        
        // Exchange code for tokens and user info
        const endpoint = isFacebook ? '/api/auth/facebook/callback' : '/api/auth/google/callback';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (response.ok) {
          // Refresh the authentication context to get the updated user info
          await refreshUser();
          
          toast({
            title: t('auth.loginSuccess'),
            description: t('auth.welcomeBack'),
          });
          router.push('/dashboard');
        } else {
          setError(data.error || 'Authentication failed');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Callback error:', err);
        setError('An unexpected error occurred');
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, router, t]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Authenticating...</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Please wait while we complete your authentication.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Authentication Failed</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => router.push('/auth')}
              className="text-primary hover:underline"
            >
              Return to login
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
} 