import crypto from 'crypto';

export const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const generateExpiryDate = (hours: number = 24): Date => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
};

export const isTokenExpired = (expiryDate: Date): boolean => {
  return new Date() > expiryDate;
}; 