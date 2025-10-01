import React from 'react';

interface Props {
  firstName?: string | null;
  activationKey: string;
  amount: number;
  currency: string;
  subscriptionType: string;
}

export function ActivationKeyEmail({ firstName, activationKey, amount, currency, subscriptionType }: Props) {
  const name = firstName || 'Cher utilisateur';

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="x-ua-compatible" content="ie=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Clé d'activation MedQ</title>
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
                          Votre clé d'activation
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
                          Félicitations ! Votre paiement a été validé. Voici votre clé d'activation pour l'abonnement {subscriptionType === 'annual' ? 'annuel' : 'semestriel'} :
                        </p>

                        {/* Activation Key */}
                        <div style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 20,
                          margin: '20px 0',
                          textAlign: 'center'
                        }}>
                          <h3 style={{
                            margin: '0 0 12px',
                            fontSize: 16,
                            color: '#0f172a',
                            fontWeight: 600
                          }}>
                            Clé d'activation
                          </h3>
                          <div style={{
                            backgroundColor: '#ffffff',
                            border: '2px solid #2563eb',
                            borderRadius: 6,
                            padding: '12px 16px',
                            display: 'inline-block',
                            fontFamily: 'monospace',
                            fontSize: 18,
                            fontWeight: 600,
                            color: '#2563eb',
                            letterSpacing: '1px'
                          }}>
                            {activationKey}
                          </div>
                        </div>

                        {/* Payment Details */}
                        <div style={{
                          backgroundColor: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          borderRadius: 8,
                          padding: 16,
                          margin: '20px 0'
                        }}>
                          <h3 style={{
                            margin: '0 0 8px',
                            fontSize: 16,
                            color: '#0f172a',
                            fontWeight: 600
                          }}>
                            Détails du paiement validé
                          </h3>
                          <p style={{
                            margin: '0 0 4px',
                            fontSize: 14,
                            color: '#334155'
                          }}>
                            <strong>Montant payé :</strong> {amount} {currency}
                          </p>
                          <p style={{
                            margin: 0,
                            fontSize: 14,
                            color: '#334155'
                          }}>
                            <strong>Type d'abonnement :</strong> {subscriptionType === 'annual' ? 'Annuel' : 'Semestriel'}
                          </p>
                        </div>

                        <div style={{ textAlign: 'center', margin: '24px 0' }}>
                          <a
                            href={`${process.env.NEXT_PUBLIC_APP_URL}/upgrade`}
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
                            Activer mon abonnement
                          </a>
                        </div>

                        <p style={{
                          margin: '0 0 8px',
                          fontSize: 14,
                          color: '#475569'
                        }}>
                          Pour activer votre abonnement, rendez-vous sur la page de mise à niveau et utilisez cette clé d'activation.
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
                          Cette clé d'activation est personnelle et ne peut être utilisée qu'une seule fois.
                        </p>
                        <p style={{
                          margin: 0,
                          fontSize: 12,
                          color: '#64748b'
                        }}>
                          Pour toute question, contactez notre équipe support.
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
