import React from 'react';

interface Props {
  firstName?: string | null;
  code: string;
  purpose?: 'email-verification' | 'password-change';
}

export function VerificationCodeEmail({ firstName, code, purpose = 'email-verification' }: Props) {
  const name = firstName && firstName.trim().length > 0 ? firstName : 'Étudiant(e)';

  const getPurposeText = () => {
    switch (purpose) {
      case 'password-change':
        return 'Utilisez le code de vérification ci-dessous pour confirmer le changement de votre mot de passe sur MedQ.';
      case 'email-verification':
      default:
        return 'Utilisez le code de vérification ci-dessous pour confirmer votre adresse e-mail et finaliser votre inscription sur MedQ.';
    }
  };

  const getTitle = () => {
    switch (purpose) {
      case 'password-change':
        return 'Code de vérification pour changement de mot de passe';
      case 'email-verification':
      default:
        return 'Votre code de vérification';
    }
  };

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="x-ua-compatible" content="ie=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{getTitle()}</title>
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        backgroundColor: '#f5f7fb',
        color: '#0f172a',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji'
      }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: 0, padding: 0 }}>
          <tbody>
            <tr>
              <td style={{ padding: '24px 16px' }}>
                <table role="presentation" width="100%" style={{
                  maxWidth: 640,
                  margin: '0 auto',
                  background: '#ffffff',
                  borderRadius: 16,
                  boxShadow: '0 10px 25px rgba(2,6,23,0.07)',
                  overflow: 'hidden'
                }}>
                  <tbody>
                    {/* Header with Logo */}
                    <tr>
                      <td style={{ padding: 24, backgroundColor: '#0A527F', textAlign: 'center' }}>
                        <img
                          src="https://hbc9duawsb.ufs.sh/f/0SaNNFzuRrLwc6JmYDs7xU9KRorsOPBFM3XfQgEkDm2yuiLj"
                          width={200}
                          alt="MedQ"
                          style={{ display: 'inline-block', width: '200px', height: 'auto' }}
                        />
                      </td>
                    </tr>

                    {/* Main Content */}
                    <tr>
                      <td style={{ padding: 24 }}>
                        <h1 style={{
                          margin: '0 0 8px',
                          fontSize: 24,
                          lineHeight: '28px',
                          color: '#0f172a'
                        }}>
                          Votre code de vérification
                        </h1>
                        <p style={{
                          margin: '0 0 16px',
                          fontSize: 16,
                          color: '#334155'
                        }}>
                          Bonjour {name},
                        </p>
                        <p style={{
                          margin: '0 0 24px',
                          fontSize: 16,
                          color: '#334155'
                        }}>
                          {getPurposeText()}
                        </p>

                        {/* Verification Code Display */}
                        <div style={{ textAlign: 'center', margin: '32px 0' }}>
                          <div style={{
                            display: 'inline-block',
                            letterSpacing: '8px',
                            fontWeight: 700,
                            fontSize: 32,
                            padding: '16px 24px',
                            borderRadius: 12,
                            background: '#f1f5f9',
                            color: '#0f172a',
                            border: '2px solid #e2e8f0',
                            fontFamily: 'monospace'
                          }}>
                            {code}
                          </div>
                        </div>

                        <p style={{
                          margin: '24px 0 8px',
                          fontSize: 14,
                          color: '#475569',
                          textAlign: 'center'
                        }}>
                          Ce code expirera dans 15 minutes.
                        </p>

                        <hr style={{
                          border: 0,
                          borderTop: '1px solid #e2e8f0',
                          margin: '24px 0'
                        }} />

                        <p style={{
                          margin: 0,
                          fontSize: 12,
                          color: '#64748b'
                        }}>
                          Si vous n'avez pas demandé ce code de vérification, vous pouvez ignorer cet e-mail en toute sécurité.
                        </p>
                        <p style={{
                          margin: 0,
                          fontSize: 12,
                          color: '#64748b'
                        }}>
                          Pour votre sécurité, ne partagez jamais ce code avec qui que ce soit.
                        </p>
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td style={{
                        padding: 20,
                        textAlign: 'center',
                        background: '#f8fafc',
                        color: '#64748b',
                        fontSize: 12
                      }}>
                        © 2025 MedQ. Tous droits réservés.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
