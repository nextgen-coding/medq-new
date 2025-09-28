import React from 'react';

interface Props {
  firstName?: string | null;
  verificationUrl: string;
}

export function VerificationEmail({ firstName, verificationUrl }: Props) {
  const name = firstName || 'Étudiant(e)';

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="x-ua-compatible" content="ie=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Vérification de votre e‑mail</title>
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
                          Confirmez votre e‑mail
                        </h1>
                        <p style={{
                          margin: '0 0 16px',
                          fontSize: 16,
                          color: '#334155'
                        }}>
                          Bonjour {name},
                        </p>
                        <p style={{
                          margin: '0 0 16px',
                          fontSize: 16,
                          color: '#334155'
                        }}>
                          Bienvenue sur MedQ ! Pour finaliser votre inscription et accéder à toutes les fonctionnalités de la plateforme, veuillez vérifier votre adresse e-mail en cliquant sur le bouton ci-dessous.
                        </p>
                        <div style={{ textAlign: 'center', margin: '24px 0' }}>
                          <a
                            href={verificationUrl}
                            style={{
                              background: '#2563eb',
                              color: '#ffffff',
                              textDecoration: 'none',
                              padding: '12px 24px',
                              borderRadius: 9999,
                              display: 'inline-block',
                              fontWeight: 600
                            }}
                          >
                            Vérifier mon adresse e‑mail
                          </a>
                        </div>
                        <p style={{
                          margin: '0 0 8px',
                          fontSize: 14,
                          color: '#475569'
                        }}>
                          Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :
                        </p>
                        <p style={{
                          margin: 0,
                          fontSize: 12,
                          color: '#334155',
                          wordBreak: 'break-all'
                        }}>
                          {verificationUrl}
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
                          Ce lien expirera dans 24 heures pour des raisons de sécurité.
                        </p>
                        <p style={{
                          margin: 0,
                          fontSize: 12,
                          color: '#64748b'
                        }}>
                          Si vous n'avez pas créé de compte sur MedQ, vous pouvez ignorer cet e-mail en toute sécurité.
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
