
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeftIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { t, i18n } = useTranslation();

  // Force re-render when language changes
  useEffect(() => {
    // This will force the component to re-render when i18n is ready
  }, [i18n.language, i18n.isInitialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
        toast({
          title: t('auth.resetEmailSent', { email }),
          description: t('auth.checkEmail'),
        });
      } else {
        toast({
          title: t('auth.resetError'),
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t('auth.resetError'),
        description: t('auth.unexpectedError'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto animate-fade-in shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight">
          {isSubmitted ? t('auth.checkYourEmail') : t('auth.resetPassword')}
        </CardTitle>
        <CardDescription>
          {isSubmitted 
            ? t('auth.resetLinkSent') 
            : t('auth.enterEmailForReset')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  {t('auth.sending')}
                </>
              ) : (
                t('auth.sendResetLink')
              )}
            </Button>
          </form>
        ) : (
          <div className="text-center py-4">
            <p className="mb-4">
              {t('auth.resetEmailSent', { email })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('auth.checkSpamFolder')}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          variant="ghost" 
          className="w-full flex items-center justify-center gap-2" 
          onClick={onBack}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t('auth.backToSignIn')}
        </Button>
      </CardFooter>
    </Card>
  );
}
