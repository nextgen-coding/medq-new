'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import { ForceLightTheme } from '@/components/ForceLightTheme';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Disable static generation to prevent SSR issues with useAuth
export const dynamic = 'force-dynamic';

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  // const { t } = useTranslation();
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('register');

  useEffect(() => {
    if (!isLoading && user) {
      // Redirect based on user role
      if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, router, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="animate-pulse-subtle">
            <div className="h-4 w-24 bg-muted rounded mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

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
        
        {/* Professional Device Mockups - Much Bigger */}
        <div className="hidden xl:block absolute bottom-8 left-8">
          {/* Premium Laptop Mockup - Much Bigger */}
          <div className="relative transform -rotate-12">
            {/* Laptop Screen */}
            <div className="w-80 h-52 bg-gray-900 rounded-t-xl border border-gray-700 p-2">
              <div className="w-full h-full bg-white rounded-lg overflow-hidden">
                {/* Browser Chrome */}
                <div className="h-6 bg-gray-200 flex items-center px-3">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                </div>
                {/* App Interface */}
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
            {/* Laptop Base */}
            <div className="w-80 h-6 bg-gray-800 rounded-b-2xl -mt-1 relative">
              <div className="absolute inset-x-0 top-1 h-3 bg-gray-700 rounded-lg mx-4"></div>
            </div>
          </div>
        </div>
        
        {/* Premium Phone Mockup - Much Bigger */}
  <div className="hidden xl:block absolute top-16 right-12">
          <div className="w-32 h-64 bg-gray-900 rounded-3xl border-2 border-gray-700 p-2 transform rotate-12">
            <div className="w-full h-full bg-white rounded-2xl overflow-hidden">
              {/* Status Bar */}
              <div className="h-3 bg-black flex items-center justify-between px-2">
                <div className="flex items-center">
                  <div className="w-2 h-1 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-1 bg-white rounded"></div>
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
              </div>
              {/* App Header */}
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
              {/* Content Area */}
              <div className="flex-1 p-2 bg-gray-50">
                {/* Question Card */}
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
                {/* Progress Bar */}
                <div className="w-full h-1 bg-gray-200 rounded">
                  <div className="w-1/3 h-full bg-medblue-500 rounded"></div>
                </div>
              </div>
              {/* Bottom Navigation */}
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

    {/* Right Panel - Auth Forms */}
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
           {/* Home Link - exactly above form title */}
           <div className="mb-2 flex">
             <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-medblue-700 font-medium group">
               <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-700 group-hover:bg-medblue-50 group-hover:text-medblue-700 transition-colors">
                 <ArrowLeft className="h-4 w-4" />
               </span>
               <span>Retour à l’accueil</span>
             </Link>
           </div>
           {authMode === 'login' && (
             <LoginForm
               onToggleForm={() => setAuthMode('register')}
               onForgotPassword={() => setAuthMode('forgot')}
             />
           )}
           {authMode === 'register' && (
             <RegisterForm onToggleForm={() => setAuthMode('login')} />
           )}
           {authMode === 'forgot' && (
             <ForgotPasswordForm onBack={() => setAuthMode('login')} />
           )}
           {authMode === 'reset' && (
             <ResetPasswordForm />
           )}
         </div>

         {/* reCAPTCHA placeholder */}
         {/* Inline on mobile */}
         <div className="md:hidden mt-6">
          <div className="bg-gray-200 dark:bg-gray-800 p-2 rounded text-xs text-gray-500 dark:text-gray-400 border dark:border-gray-700">
            reCAPTCHA
          </div>
        </div>
        {/* Fixed on desktop */}
        <div className="hidden md:block fixed bottom-4 right-4">
          <div className="bg-gray-200 dark:bg-gray-800 p-2 rounded text-xs text-gray-500 dark:text-gray-400 border dark:border-gray-700">
            reCAPTCHA
          </div>
        </div>
       </div>
     </div>
    </>
  );
}