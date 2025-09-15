import React from 'react';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from 'react-i18next';
import { 
  validatePassword, 
  getPasswordStrengthColor, 
  getPasswordStrengthText
} from '@/lib/password-validation';

interface PasswordStrengthProps {
  password: string;
  showDetails?: boolean;
}

export function PasswordStrength({ 
  password, 
  showDetails = true 
}: PasswordStrengthProps) {
  const { t } = useTranslation();
  
  if (!password) return null;

  const validation = validatePassword(password);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>Password strength:</span>
        <span className={`font-medium ${getPasswordStrengthColor(validation.strength)}`}>
          {getPasswordStrengthText(validation.strength)}
        </span>
      </div>
      
      <Progress 
        value={validation.score} 
        className="h-2"
        style={{
          '--progress-background': validation.strength === 'weak' ? '#ef4444' : 
                                  validation.strength === 'medium' ? '#eab308' : '#22c55e'
        } as React.CSSProperties}
      />
      
      {showDetails && validation.errors.length > 0 && (
        <div className="text-sm text-red-500 space-y-1">
          {validation.errors.map((error, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs">•</span>
              <span>{t(error)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 