import { Resend } from 'resend';
import { VerificationCodeEmail } from '@/components/email/VerificationCodeEmail';
import { VerificationEmail } from '@/components/email/VerificationEmail';
import { ResetPasswordEmail } from '@/components/email/ResetPasswordEmail';
import { PaymentLinkEmail } from '@/components/email/PaymentLinkEmail';
import { ActivationKeyEmail } from '@/components/email/ActivationKeyEmail';

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

export const sendPaymentLinkEmail = async (
  email: string,
  paymentLink: string,
  amount: number,
  currency: string,
  subscriptionType: string,
  name?: string
) => {
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@medq.tn';

    const result = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Lien de paiement personnalisé • MedQ',
      react: PaymentLinkEmail({
        firstName: name,
        paymentLink,
        amount,
        currency,
        subscriptionType
      }),
    });

    return result;
  } catch (error) {
    console.error('Error sending payment link email:', error);
    throw error;
  }
};

export const sendActivationKeyEmail = async (
  email: string,
  activationKey: string,
  amount: number,
  currency: string,
  subscriptionType: string,
  name?: string
) => {
  console.log('Sending activation key email to:', email, 'with key:', activationKey);
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@medq.tn';

    const result = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Votre clé d\'activation • MedQ',
      react: ActivationKeyEmail({
        firstName: name,
        activationKey,
        amount,
        currency,
        subscriptionType
      }),
    });

    console.log('Activation key email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending activation key email:', error);
    throw error;
  }
}; 