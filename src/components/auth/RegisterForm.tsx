import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { EyeIcon, EyeOffIcon, Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useOAuthLoading } from '@/hooks/use-oauth-loading';
import { validatePassword } from '@/lib/password-validation';
import { PasswordStrength } from '@/components/ui/password-strength';

interface Niveau {
  id: string;
  name: string;
  order: number;
}

export function RegisterForm({ onToggleForm }: { onToggleForm: () => void }) {
  const { register } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    faculty: '',
    level: '',
    acceptTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [isLoadingNiveaux, setIsLoadingNiveaux] = useState(true);
  const { t } = useTranslation();
  const {
    isGoogleLoading,
    startGoogleLoading,
    stopGoogleLoading,
  } = useOAuthLoading();

  // Load niveaux on component mount
  useEffect(() => {
    const fetchNiveaux = async () => {
      try {
        setIsLoadingNiveaux(true);
        const response = await fetch('/api/niveaux');
        if (response.ok) {
          const data = await response.json();
          // The API returns the array directly, not wrapped in an object
          setNiveaux(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching niveaux:', error);
      } finally {
        setIsLoadingNiveaux(false);
      }
    };

    fetchNiveaux();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordsMustMatch'));
      return;
    }

    if (!formData.acceptTerms) {
      setError('Vous devez accepter les termes et conditions');
      return;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors[0]);
      return;
    }

    setIsLoading(true);

    try {
      const result = await register(
        formData.email,
        formData.password
      );
      if (result.success) {
        toast({
          title: t('auth.registrationSuccess'),
          description: t('auth.welcomeMessage'),
        });
        // Redirect to dashboard after successful registration
        router.push('/dashboard');
      } else {
        setError(result.error || t('auth.registrationFailed'));
      }
    } catch (err) {
      setError(t('auth.unexpectedError'));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    startGoogleLoading();
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new Error('Google Client ID not configured');
      }

      // Redirect to Google OAuth page
      const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
      const scope = encodeURIComponent('openid email profile');
      const responseType = 'code';
      const accessType = 'offline';
      
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `response_type=${responseType}&` +
        `scope=${scope}&` +
        `access_type=${accessType}&` +
        `prompt=select_account`;

      window.location.href = googleAuthUrl;

    } catch (err) {
      console.error('Unexpected Google sign-in error:', err);
      setError('Google authentication is not properly configured. Please try again later.');
      stopGoogleLoading();
    }
  };

  // Facebook login removed

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Inscription</h2>
      
      <form onSubmit={handleRegister} className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            {error}
          </div>
        )}

        {/* Social Sign Up */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 hover:dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-medblue-500 disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuer avec Google
              </>
            )}
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">Ou</span>
          </div>
        </div>

        {/* Email Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-medblue-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
            placeholder="Votre email"
            required
          />
        </div>

        {/* Password Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Mot de passe
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-medblue-500 focus:border-transparent pr-12 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
              placeholder="Votre mot de passe"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {formData.password && <PasswordStrength password={formData.password} />}
        </div>

        {/* Confirm Password Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Confirmation mot de passe
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 pr-12 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm 
                ${formData.confirmPassword.length >= 4
                  ? (formData.password === formData.confirmPassword
                    ? 'border-emerald-500 dark:border-emerald-500 focus:ring-emerald-500'
                      : 'border-red-500 dark:border-red-500 focus:ring-red-500')
                  : 'border-gray-300 dark:border-gray-700 focus:ring-medblue-500'}`}
              placeholder="Confirmer le mot de passe"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {formData.confirmPassword.length >= 4 && (
            <div className="mt-2 flex items-center gap-2 text-sm" aria-live="polite">
              {formData.password === formData.confirmPassword ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Les mots de passe correspondent</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-700">Les mots de passe ne correspondent pas</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Faculty Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Faculté
          </label>
          <select
            name="faculty"
            value={formData.faculty}
            onChange={(e) => handleSelectChange('faculty', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-medblue-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
            required
          >
            <option value="">Sélectionner...</option>
            <option value="FMT">FMT</option>
            <option value="FMS">FMS</option>
            <option value="FMSf">FMSf</option>
            <option value="FMM">FMM</option>
          </select>
        </div>

        {/* Level Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Niveau d'étude
          </label>
          <select
            name="level"
            value={formData.level}
            onChange={(e) => handleSelectChange('level', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-medblue-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
            required
            disabled={isLoadingNiveaux}
          >
            <option value="">Sélectionner...</option>
            {niveaux.map((niveau) => (
              <option key={niveau.id} value={niveau.id}>
                {niveau.name}
              </option>
            ))}
          </select>
        </div>

        {/* Terms and Conditions */}
        <div className="flex items-start">
          <input
            type="checkbox"
            name="acceptTerms"
            checked={formData.acceptTerms}
            onChange={handleInputChange}
            className="mt-1 h-4 w-4 text-medblue-600 focus:ring-medblue-500 border-gray-300 dark:border-gray-600 rounded"
            required
          />
          <label className="ml-3 text-sm text-gray-600 dark:text-gray-300">
            Accepter les termes et conditions
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!formData.acceptTerms || isLoading || (formData.confirmPassword.length >= 4 && formData.password !== formData.confirmPassword)}
          className="w-full bg-medblue-600 text-white py-2.5 px-4 rounded-lg font-semibold hover:bg-medblue-700 focus:outline-none focus:ring-2 focus:ring-medblue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('auth.signingUp')}
            </>
          ) : (
            'Inscription'
          )}
        </button>

        {/* Login Link */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Déjà membre? {' '}
            <button
              type="button"
              className="text-medblue-600 hover:text-medblue-700 font-medium"
              onClick={onToggleForm}
            >
              Connectez-vous!
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}
