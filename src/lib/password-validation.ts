export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
  score: number; // 0-100
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  // Check minimum length (8 characters)
  if (password.length < 8) {
    errors.push('auth.passwordTooShort');
  } else {
    score += 30; // Base score for meeting minimum length
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('auth.passwordRequiresUppercase');
  } else {
    score += 25;
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('auth.passwordRequiresLowercase');
  } else {
    score += 25;
  }

  // Additional scoring based on length
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong';
  if (score < 60) strength = 'weak';
  else if (score < 80) strength = 'medium';
  else strength = 'strong';

  return {
    isValid: errors.length === 0,
    errors,
    strength,
    score: Math.min(score, 100)
  };
}

// Helper function to get password strength color
export function getPasswordStrengthColor(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak': return 'text-red-500';
    case 'medium': return 'text-yellow-500';
    case 'strong': return 'text-green-500';
    default: return 'text-gray-500';
  }
}

// Helper function to get password strength text
export function getPasswordStrengthText(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak': return 'Weak';
    case 'medium': return 'Medium';
    case 'strong': return 'Strong';
    default: return 'Unknown';
  }
} 