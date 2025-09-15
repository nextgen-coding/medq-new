'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function GoogleOAuthDebug() {
  const [debugInfo, setDebugInfo] = useState<{
    clientId: string | undefined;
    googleLoaded: boolean;
    googleAccounts: boolean;
    errors: string[];
  }>({
    clientId: undefined,
    googleLoaded: false,
    googleAccounts: false,
    errors: [],
  });

  useEffect(() => {
    const checkGoogleStatus = () => {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const googleLoaded = typeof window !== 'undefined' && !!window.google;
      const googleAccounts = googleLoaded && !!window.google?.accounts?.id;
      
      setDebugInfo({
        clientId,
        googleLoaded,
        googleAccounts,
        errors: [],
      });
    };

    checkGoogleStatus();
    
    // Check again after a delay to see if Google loads
    const timer = setTimeout(checkGoogleStatus, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  const testGoogleSignIn = async () => {
    try {
      if (!window.google?.accounts?.id) {
        setDebugInfo(prev => ({
          ...prev,
          errors: [...prev.errors, 'Google Identity Services not available']
        }));
        return;
      }

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        setDebugInfo(prev => ({
          ...prev,
          errors: [...prev.errors, 'Google Client ID not configured']
        }));
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          console.log('Google sign-in response:', response);
          setDebugInfo(prev => ({
            ...prev,
            errors: [...prev.errors, `Success! Token received: ${response.credential.substring(0, 20)}...`]
          }));
        },
      });

      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed()) {
          setDebugInfo(prev => ({
            ...prev,
            errors: [...prev.errors, 'Google sign-in prompt not displayed']
          }));
        } else if (notification.isSkippedMoment()) {
          setDebugInfo(prev => ({
            ...prev,
            errors: [...prev.errors, 'Google sign-in prompt skipped']
          }));
        }
      });

    } catch (error) {
      setDebugInfo(prev => ({
        ...prev,
        errors: [...prev.errors, `Error: ${error}`]
      }));
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Google OAuth Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span>Client ID:</span>
            <Badge variant={debugInfo.clientId ? "default" : "destructive"}>
              {debugInfo.clientId ? "Configured" : "Missing"}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span>Google Script:</span>
            <Badge variant={debugInfo.googleLoaded ? "default" : "destructive"}>
              {debugInfo.googleLoaded ? "Loaded" : "Not Loaded"}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span>Google Accounts:</span>
            <Badge variant={debugInfo.googleAccounts ? "default" : "destructive"}>
              {debugInfo.googleAccounts ? "Available" : "Not Available"}
            </Badge>
          </div>
        </div>

        {debugInfo.clientId && (
          <div className="text-xs text-muted-foreground">
            Client ID: {debugInfo.clientId.substring(0, 20)}...
          </div>
        )}

        <Button onClick={testGoogleSignIn} className="w-full">
          Test Google Sign-In
        </Button>

        {debugInfo.errors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Debug Messages:</h4>
            <div className="space-y-1">
              {debugInfo.errors.map((error, index) => (
                <div key={index} className="text-xs p-2 bg-muted rounded">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 