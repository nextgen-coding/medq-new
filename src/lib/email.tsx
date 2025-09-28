import { Resend } from 'resend';
import { VerificationCodeEmail } from '@/components/email/VerificationCodeEmail';
import { VerificationEmail } from '@/components/email/VerificationEmail';
import { ResetPasswordEmail } from '@/components/email/ResetPasswordEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailTemplate {
  to: string;
  subject: string;
  react?: React.ReactElement;
}

export const sendVerificationEmail = async (email: string, token: string, name?: string) => {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${token}`;

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@medq.tn';

    const result = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Vérifiez Votre Email - MedQ',
      react: VerificationEmail({ firstName: name, verificationUrl }),
    });

    return result;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};
  
export const sendPasswordResetEmail = async (email: string, token: string, name?: string) => {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@medq.tn';

    const result = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Réinitialiser Votre Mot de Passe - MedQ',
      react: ResetPasswordEmail({ firstName: name, resetUrl }),
    });

    return result;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

export const sendVerificationCodeEmail = async (email: string, code: string, name?: string) => {
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@medq.tn';

    const result = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Votre code de vérification • MedQ',
      react: VerificationCodeEmail({ firstName: name, code, purpose: 'email-verification' }),
    });

    return result;
  } catch (error) {
    console.error('Error sending verification code email:', error);
    throw error;
  }
};

export const sendPasswordChangeVerificationEmail = async (email: string, code: string, name?: string) => {
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@medq.tn';

    const result = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Code de vérification pour changement de mot de passe • MedQ',
      react: VerificationCodeEmail({ firstName: name, code, purpose: 'password-change' }),
    });

    return result;
  } catch (error) {
    console.error('Error sending password change verification email:', error);
    throw error;
  }
}; 