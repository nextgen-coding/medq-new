import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { EyeIcon, EyeOffIcon, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { validatePassword } from '@/lib/password-validation';
import { PasswordStrength } from '@/components/ui/password-strength';

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordValidation, setPasswordValidation] = useState<any>(null);
  const { t } = useTranslation();

  // Check if we have a valid reset token by looking at the URL
  useEffect(() => {
    // Log current URL parameters for debugging
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const type = params.get('type');
    const accessToken = params.get('access_token');
    
    console.log('Reset password URL parameters:', { 
      type,
      hasAccessToken: !!accessToken,
      fullUrl: window.location.href 
    });
    
    // If we don't have the right parameters, the reset link might be invalid
    if (!type || type !== 'recovery') {
      console.log('Not a valid recovery flow');
    }
  }, []);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    
    if (newPassword) {
      const validation = validatePassword(newPassword);
      setPasswordValidation(validation);
    } else {
      setPasswordValidation(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.passwordsNotMatch'));
      return;
    }

    // Validate password
    const validation = validatePassword(password);
    if (!validation.isValid) {
      setError(t(validation.errors[0]));
      return;
    }

    setIsLoading(true);

    try {
      console.log('Submitting password reset');
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: '', // For reset, we don't have current password
          newPassword: password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Password update failed:', data.error);
        setError(data.error || t('auth.passwordResetFailed'));
        toast({
          title: t('auth.passwordResetFailed'),
          description: data.error || t('auth.passwordResetFailed'),
          variant: "destructive",
        });
      } else {
        console.log('Password updated successfully');
        toast({
          title: t('auth.passwordUpdated'),
          description: t('auth.passwordUpdatedSuccess'),
        });
        // Redirect to dashboard after successful password reset
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError(t('auth.passwordResetFailed'));
      toast({
        title: t('auth.passwordResetFailed'),
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
          {t('auth.createNewPassword')}
        </CardTitle>
        <CardDescription>
          {t('auth.enterNewPassword')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.newPassword')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                required
                className="pr-10"
                minLength={8}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOffIcon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <EyeIcon className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {passwordValidation && (
              <PasswordStrength 
                password={password}
              />
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                {t('auth.updating')}
              </>
            ) : (
              t('auth.resetPassword')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
