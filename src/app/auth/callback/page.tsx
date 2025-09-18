'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ForceLightTheme } from '@/components/ForceLightTheme';

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
      <>
        <ForceLightTheme />
        <div className="min-h-screen flex flex-col md:flex-row overflow-x-hidden">
          {/* Left Panel - Marketing Content */}
          <div className="hidden md:flex w-full md:w-1/2 bg-gradient-to-br from-medblue-600 to-medblue-800 text-white p-8 lg:p-10 xl:p-12 flex-col justify-center relative overflow-hidden">
            <div className="relative z-10">
              <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4">
                La nouvelle plateforme de<br />
                <span className="text-medblue-200">Questions révolutionnaire !</span>
              </h1>
              
              <div className="flex items-center mb-8">
                <Image
                  src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                  alt="MedQ logo"
                  width={200}
                  height={48}
                  sizes="200px"
                  priority
                  className="h-9 lg:h-10 xl:h-12 w-auto object-contain transition-opacity duration-300"
                />
              </div>
              
              <p className="text-medblue-200 text-base lg:text-lg xl:text-2xl mb-10 xl:mb-12">
                Destinée aux étudiants en médecine
              </p>
            </div>
            
            {/* Professional Device Mockups */}
            <div className="hidden xl:block absolute bottom-8 left-8">
              <div className="relative transform -rotate-12">
                <div className="w-80 h-52 bg-gray-900 rounded-t-xl border border-gray-700 p-2">
                  <div className="w-full h-full bg-white rounded-lg overflow-hidden">
                    <div className="h-6 bg-gray-200 flex items-center px-3">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-medblue-500 to-medblue-700 h-32 p-4">
                      <div className="flex items-center mb-3">
                        <Image
                          src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                          alt="MedQ logo"
                          width={80}
                          height={24}
                          sizes="80px"
                          className="h-5 w-auto object-contain"
                          priority
                        />
                      </div>
                      <div className="bg-white bg-opacity-20 rounded-lg p-3">
                        <div className="w-24 h-2 bg-white rounded mb-2"></div>
                        <div className="w-20 h-2 bg-white bg-opacity-70 rounded mb-2"></div>
                        <div className="w-28 h-2 bg-white bg-opacity-50 rounded"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-80 h-6 bg-gray-800 rounded-b-2xl -mt-1 relative">
                  <div className="absolute inset-x-0 top-1 h-3 bg-gray-700 rounded-lg mx-4"></div>
                </div>
              </div>
            </div>
            
            {/* Premium Phone Mockup */}
            <div className="hidden xl:block absolute top-16 right-12">
              <div className="w-32 h-64 bg-gray-900 rounded-3xl border-2 border-gray-700 p-2 transform rotate-12">
                <div className="w-full h-full bg-white rounded-2xl overflow-hidden">
                  <div className="h-3 bg-black flex items-center justify-between px-2">
                    <div className="flex items-center">
                      <div className="w-2 h-1 bg-white rounded-full"></div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-1 bg-white rounded"></div>
                      <div className="w-1 h-1 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-medblue-600 flex items-center justify-center">
                    <Image
                      src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                      alt="MedQ logo"
                      width={40}
                      height={12}
                      sizes="40px"
                      className="h-3 w-auto object-contain"
                      priority
                    />
                  </div>
                  <div className="flex-1 p-2 bg-gray-50">
                    <div className="bg-white rounded shadow-sm p-2 mb-2">
                      <div className="w-12 h-1 bg-gray-300 rounded mb-1"></div>
                      <div className="w-8 h-1 bg-gray-300 rounded mb-2"></div>
                      <div className="space-y-1">
                        <div className="w-10 h-1 bg-medblue-200 rounded"></div>
                        <div className="w-8 h-1 bg-medblue-200 rounded"></div>
                        <div className="w-12 h-1 bg-medblue-200 rounded"></div>
                        <div className="w-6 h-1 bg-medblue-200 rounded"></div>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-gray-200 rounded">
                      <div className="w-1/3 h-full bg-medblue-500 rounded"></div>
                    </div>
                  </div>
                  <div className="h-4 bg-white border-t border-gray-200 flex items-center justify-center">
                    <div className="flex space-x-2">
                      <div className="w-1 h-1 bg-medblue-500 rounded-full"></div>
                      <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                      <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating Elements for Depth */}
            <div className="hidden xl:block absolute top-1/3 right-1/4">
              <div className="w-6 h-6 bg-white bg-opacity-10 rounded-full animate-pulse"></div>
            </div>
            <div className="hidden xl:block absolute bottom-1/3 right-1/3">
              <div className="w-4 h-4 bg-medblue-300 bg-opacity-20 rounded-full animate-pulse delay-1000"></div>
            </div>
            <div className="hidden xl:block absolute top-1/2 left-1/3">
              <div className="w-3 h-3 bg-white bg-opacity-5 rounded-full animate-pulse delay-500"></div>
            </div>
          </div>

          {/* Right Panel - Auth Content */}
          <div className="w-full md:w-1/2 bg-gray-50 dark:bg-gray-950 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
            {/* Mobile Hero (visible on small screens only) */}
            <div className="md:hidden bg-gradient-to-br from-medblue-600 to-medblue-800 text-white rounded-xl p-5 mb-6">
              <div className="flex items-center mb-3">
                <Image
                  src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                  alt="MedQ"
                  width={180}
                  height={40}
                  sizes="(max-width: 640px) 160px, 180px"
                  priority
                  className="h-8 w-auto object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
                />
                <span className="sr-only">MedQ</span>
              </div>
              <p className="text-medblue-100 text-sm">
                La nouvelle plateforme de questions destinée aux étudiants en médecine
              </p>
            </div>

            <div className="max-w-md lg:max-w-lg mx-auto w-full">
              <Card className="border-0 shadow-lg bg-white">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-bold">Authenticating...</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-6">
                  {/* Loading Spinner */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-medblue-200 rounded-full animate-spin">
                        <div className="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-t-medblue-600 rounded-full animate-spin"></div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-gray-600">Please wait while we complete your authentication.</p>
                  
                  {/* Progress Indicator */}
                  <div className="space-y-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-gradient-to-r from-medblue-500 to-medblue-600 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
                    </div>
                    <p className="text-sm text-gray-500">
                      Processing your login...
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <ForceLightTheme />
        <div className="min-h-screen flex flex-col md:flex-row overflow-x-hidden">
          {/* Left Panel - Marketing Content */}
          <div className="hidden md:flex w-full md:w-1/2 bg-gradient-to-br from-medblue-600 to-medblue-800 text-white p-8 lg:p-10 xl:p-12 flex-col justify-center relative overflow-hidden">
            <div className="relative z-10">
              <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4">
                La nouvelle plateforme de<br />
                <span className="text-medblue-200">Questions révolutionnaire !</span>
              </h1>
              
              <div className="flex items-center mb-8">
                <Image
                  src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                  alt="MedQ logo"
                  width={200}
                  height={48}
                  sizes="200px"
                  priority
                  className="h-9 lg:h-10 xl:h-12 w-auto object-contain transition-opacity duration-300"
                />
              </div>
              
              <p className="text-medblue-200 text-base lg:text-lg xl:text-2xl mb-10 xl:mb-12">
                Destinée aux étudiants en médecine
              </p>
            </div>
            
            {/* Floating Elements for Depth */}
            <div className="hidden xl:block absolute top-1/3 right-1/4">
              <div className="w-6 h-6 bg-white bg-opacity-10 rounded-full animate-pulse"></div>
            </div>
            <div className="hidden xl:block absolute bottom-1/3 right-1/3">
              <div className="w-4 h-4 bg-medblue-300 bg-opacity-20 rounded-full animate-pulse delay-1000"></div>
            </div>
            <div className="hidden xl:block absolute top-1/2 left-1/3">
              <div className="w-3 h-3 bg-white bg-opacity-5 rounded-full animate-pulse delay-500"></div>
            </div>
          </div>

          {/* Right Panel - Error Content */}
          <div className="w-full md:w-1/2 bg-gray-50 dark:bg-gray-950 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
            {/* Mobile Hero (visible on small screens only) */}
            <div className="md:hidden bg-gradient-to-br from-medblue-600 to-medblue-800 text-white rounded-xl p-5 mb-6">
              <div className="flex items-center mb-3">
                <Image
                  src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwEhDtvz72VxFcMaBkoOH8vYK05Zd6q4mGPySp"
                  alt="MedQ"
                  width={180}
                  height={40}
                  sizes="(max-width: 640px) 160px, 180px"
                  priority
                  className="h-8 w-auto object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
                />
                <span className="sr-only">MedQ</span>
              </div>
              <p className="text-medblue-100 text-sm">
                La nouvelle plateforme de questions destinée aux étudiants en médecine
              </p>
            </div>

            <div className="max-w-md lg:max-w-lg mx-auto w-full">
              <Card className="border-0 shadow-lg bg-white">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-bold text-red-600">Authentication Failed</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-6">
                  {/* Error Icon */}
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4">{error}</p>
                  
                  <Button
                    onClick={() => router.push('/auth')}
                    className="w-full bg-gradient-to-r from-medblue-600 to-medblue-700 hover:from-medblue-700 hover:to-medblue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
                  >
                    Return to Login
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
} 