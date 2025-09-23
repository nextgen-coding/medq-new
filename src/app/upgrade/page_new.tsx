'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'
import { UploadDropzone } from '@/utils/uploadthing'
import { 
  CreditCard, 
  Gift, 
  Upload, 
  Check, 
  AlertCircle,
  ArrowLeft,
  Crown,
  Calendar,
  CalendarDays,
  Eye
} from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar'
import { SidebarInset } from '@/components/ui/sidebar'
import { UniversalHeader } from '@/components/layout/UniversalHeader'

type PaymentMethod = 'konnect_gateway' | 'voucher_code' | 'custom_payment'
type SubscriptionType = 'semester' | 'annual'

interface PaymentState {
  method: PaymentMethod | null
  subscriptionType: SubscriptionType
  voucherCode: string
  customPaymentDetails: string
  proofFileUrl: string | null
  proofFileName: string | null
  isUploading: boolean
  isLoading: boolean
  paymentId: string | null
  paymentUrl: string | null
  requiresProof: boolean
  status: 'selecting' | 'processing' | 'awaiting_proof' | 'completed'
}

interface PricingData {
  semester: {
    originalPrice: number
    finalPrice: number
    discountAmount: number
    duration: string
  }
  annual: {
    originalPrice: number
    finalPrice: number
    discountAmount: number
    duration: string
    savings: number
  }
  currency: string
  isDiscountActive: boolean
  discountPercentage: number | null
  paymentDetails: {
    ribNumber: string
    d17PhoneNumber: string
  }
}

export default function PaymentPage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()

  const [state, setState] = useState<PaymentState>({
    method: null,
    subscriptionType: 'semester',
    voucherCode: '',
    customPaymentDetails: '',
    proofFileUrl: null,
    proofFileName: null,
    isUploading: false,
    isLoading: false,
    paymentId: null,
    paymentUrl: null,
    requiresProof: false,
    status: 'selecting'
  })

  const [pricing, setPricing] = useState<PricingData | null>(null)
  const [isPricingLoading, setIsPricingLoading] = useState(true)

  // Fetch pricing data
  const fetchPricing = async () => {
    try {
      const response = await fetch('/api/pricing')
      const data = await response.json()
      
      if (data.success) {
        setPricing(data.data)
      } else {
        // Fallback to default pricing
        setPricing({
          semester: { originalPrice: 50, finalPrice: 50, discountAmount: 0, duration: '6 mois' },
          annual: { originalPrice: 120, finalPrice: 120, discountAmount: 0, duration: '12 mois', savings: 20 },
          currency: 'TND',
          isDiscountActive: false,
          discountPercentage: null,
          paymentDetails: {
            ribNumber: '1234567890',
            d17PhoneNumber: '+216 12 345 678'
          }
        })
      }
    } catch (error) {
      console.error('Error fetching pricing:', error)
      // Fallback to default pricing
      setPricing({
        semester: { originalPrice: 50, finalPrice: 50, discountAmount: 0, duration: '6 mois' },
        annual: { originalPrice: 120, finalPrice: 120, discountAmount: 0, duration: '12 mois', savings: 20 },
        currency: 'TND',
        isDiscountActive: false,
        discountPercentage: null,
        paymentDetails: {
          ribNumber: '1234567890',
          d17PhoneNumber: '+216 12 345 678'
        }
      })
    } finally {
      setIsPricingLoading(false)
    }
  }

  useEffect(() => {
    fetchPricing()
  }, [])

  // Redirect users with active subscriptions to dashboard
  useEffect(() => {
    if (user && user.hasActiveSubscription) {
      toast({
        title: "Abonnement actif",
        description: "Vous avez déjà un abonnement actif. Vous pouvez accéder à tous les contenus premium.",
        variant: "default"
      })
      router.push('/dashboard')
    }
  }, [user, router])

  // Show loading while pricing is being fetched
  if (isPricingLoading || !pricing) {
    return (
      <ProtectedRoute>
        <AppSidebarProvider>
          <div className="flex min-h-screen w-full bg-gray-50 dark:bg-gray-900">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col">
              <UniversalHeader
                title="Mise à niveau"
                rightActions={
                  <Button
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                  </Button>
                }
              />
              <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                </div>
              </main>
            </SidebarInset>
          </div>
        </AppSidebarProvider>
      </ProtectedRoute>
    )
  }

  // Don't show upgrade page if user already has an active subscription
  if (user && user.hasActiveSubscription) {
    return null // The useEffect will handle the redirect
  }

  const handleMethodSelect = (method: PaymentMethod) => {
    setState(prev => ({ ...prev, method }))
  }

  const handleSubscriptionTypeChange = (type: SubscriptionType) => {
    setState(prev => ({ ...prev, subscriptionType: type }))
  }

  const handlePayment = async () => {
    if (!state.method) return

    setState(prev => ({ ...prev, isLoading: true }))

    try {
      const response = await fetch('/api/payments/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: state.method,
          subscriptionType: state.subscriptionType,
          voucherCode: state.method === 'voucher_code' ? state.voucherCode : undefined,
          customPaymentDetails: state.method === 'custom_payment' ? state.customPaymentDetails : undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du traitement du paiement')
      }

      if (data.requiresProof) {
        setState(prev => ({ 
          ...prev, 
          status: 'awaiting_proof',
          paymentId: data.paymentId,
          requiresProof: true
        }))
        toast({
          title: 'Demande créée',
          description: 'Veuillez téléverser un justificatif de paiement.',
          variant: 'default'
        })
      } else if (data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        setState(prev => ({ ...prev, status: 'completed' }))
        await refreshUser()
        toast({
          title: 'Succès',
          description: 'Abonnement activé avec succès !',
          variant: 'default'
        })
      }

    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur inattendue',
        variant: 'destructive'
      })
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const handleProofUpload = async () => {
    if (!state.proofFileUrl || !state.paymentId) {
      toast({
        title: 'Erreur',
        description: 'Veuillez téléverser un justificatif avant de continuer.',
        variant: 'destructive'
      })
      return
    }

    setState(prev => ({ ...prev, isLoading: true }))

    try {
      // Update payment with proof image URL
      const response = await fetch(`/api/payments/${state.paymentId}/proof`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          proofImageUrl: state.proofFileUrl
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la mise à jour')
      }

      setState(prev => ({ ...prev, status: 'completed' }))
      toast({
        title: 'Succès',
        description: 'Justificatif téléversé avec succès. En attente de vérification par l\'administrateur.',
        variant: 'default'
      })

    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur inattendue',
        variant: 'destructive'
      })
      // Keep status as 'awaiting_proof' to maintain UI visibility
      setState(prev => ({ ...prev, status: 'awaiting_proof' }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <div className="flex w-full h-screen bg-gray-50 dark:bg-gray-900">
          <AppSidebar />
          <SidebarInset className="flex flex-col h-full">
            <UniversalHeader
              title="Mise à niveau"
              rightActions={
                <Button
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </Button>
              }
            />

            <main className="flex-1 overflow-hidden p-4">
              <div className="h-full max-w-7xl mx-auto">
                
                {/* Header - Compact */}
                <div className="text-center mb-4">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    Mise à niveau de votre compte
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Débloquez l'accès complet à tous les contenus MedQ
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100%-80px)]">
                  
                  {/* Left Column - Subscription Plans */}
                  <div className="space-y-4 overflow-y-auto">
                    {/* Subscription Type Selection - Compact */}
                    <Card className="h-fit">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Crown className="h-4 w-4 text-yellow-500" />
                          Choisissez votre abonnement
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <RadioGroup
                          value={state.subscriptionType}
                          onValueChange={handleSubscriptionTypeChange}
                          className="grid grid-cols-1 gap-3"
                        >
                          <Label 
                            htmlFor="semester" 
                            className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <RadioGroupItem value="semester" id="semester" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4" />
                                  <span className="font-medium">Semestriel</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-blue-600">
                                    {pricing.isDiscountActive ? (
                                      <div className="flex items-center gap-1">
                                        <span className="text-sm line-through text-gray-400">
                                          {pricing.semester.originalPrice} {pricing.currency}
                                        </span>
                                        <span>{pricing.semester.finalPrice} {pricing.currency}</span>
                                      </div>
                                    ) : (
                                      <span>{pricing.semester.finalPrice} {pricing.currency}</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500">{pricing.semester.duration}</div>
                                </div>
                              </div>
                            </div>
                          </Label>

                          <Label 
                            htmlFor="annual" 
                            className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <RadioGroupItem value="annual" id="annual" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CalendarDays className="h-4 w-4" />
                                  <span className="font-medium">Annuel</span>
                                  <Badge variant="secondary" className="text-xs">Recommandé</Badge>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-green-600">
                                    {pricing.isDiscountActive ? (
                                      <div className="flex items-center gap-1">
                                        <span className="text-sm line-through text-gray-400">
                                          {pricing.annual.originalPrice} {pricing.currency}
                                        </span>
                                        <span>{pricing.annual.finalPrice} {pricing.currency}</span>
                                      </div>
                                    ) : (
                                      <span>{pricing.annual.finalPrice} {pricing.currency}</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500">{pricing.annual.duration}</div>
                                  <div className="text-xs text-green-600">
                                    Économie: {pricing.annual.savings} {pricing.currency}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Label>
                        </RadioGroup>

                        {pricing.isDiscountActive && (
                          <Alert className="mt-3 bg-green-50 border-green-200">
                            <AlertCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-700 text-sm">
                              <strong>Promotion active:</strong> {pricing.discountPercentage}% de réduction sur tous les abonnements
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>

                    {/* Payment Method Selection - Compact */}
                    <Card className="h-fit">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Méthode de paiement</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 gap-3">
                          {/* Konnect Gateway */}
                          <div 
                            className={`cursor-pointer transition-all border rounded-lg p-3 ${
                              state.method === 'konnect_gateway' 
                                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' 
                                : 'hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            onClick={() => handleMethodSelect('konnect_gateway')}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                <CreditCard className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-sm">Konnect Gateway</div>
                                <div className="text-xs text-gray-500">Carte bancaire sécurisée</div>
                              </div>
                              <Badge variant="outline" className="text-xs">Instantané</Badge>
                            </div>
                          </div>

                          {/* Voucher Code */}
                          <div 
                            className={`cursor-pointer transition-all border rounded-lg p-3 ${
                              state.method === 'voucher_code' 
                                ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950' 
                                : 'hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            onClick={() => handleMethodSelect('voucher_code')}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                <Gift className="h-4 w-4 text-green-600" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-sm">Code de bon</div>
                                <div className="text-xs text-gray-500">Utilisez un code promo</div>
                              </div>
                              <Badge variant="outline" className="text-xs">Gratuit</Badge>
                            </div>
                          </div>

                          {/* Custom Payment */}
                          <div 
                            className={`cursor-pointer transition-all border rounded-lg p-3 ${
                              state.method === 'custom_payment' 
                                ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950' 
                                : 'hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            onClick={() => handleMethodSelect('custom_payment')}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                                <Upload className="h-4 w-4 text-orange-600" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-sm">Virement ou D17</div>
                                <div className="text-xs text-gray-500">Paiement traditionnel</div>
                              </div>
                              <Badge variant="outline" className="text-xs">Manuel</Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column - Payment Details & Instructions */}
                  <div className="space-y-4 overflow-y-auto">
                    {/* Payment Details Form */}
                    {state.method && (
                      <Card className="h-fit">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">
                            {state.method === 'voucher_code' ? 'Code de bon' : 
                             state.method === 'custom_payment' ? 'Instructions de paiement' : 'Finaliser le paiement'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                          
                          {state.method === 'konnect_gateway' && (
                            <div className="text-center py-4">
                              <p className="text-sm text-gray-600 mb-4">
                                Vous serez redirigé vers Konnect pour finaliser votre paiement de manière sécurisée.
                              </p>
                              <Button
                                onClick={handlePayment}
                                disabled={state.isLoading}
                                className="w-full"
                                size="lg"
                              >
                                {state.isLoading ? 'Redirection...' : `Payer ${pricing[state.subscriptionType].finalPrice} ${pricing.currency}`}
                              </Button>
                            </div>
                          )}

                          {state.method === 'voucher_code' && (
                            <div className="space-y-3">
                              <div>
                                <Label htmlFor="voucherCode" className="text-sm">Code de bon</Label>
                                <Input
                                  id="voucherCode"
                                  placeholder="Entrez votre code de bon"
                                  value={state.voucherCode}
                                  onChange={(e) => setState(prev => ({ 
                                    ...prev, 
                                    voucherCode: e.target.value.toUpperCase() 
                                  }))}
                                  className="mt-1"
                                />
                              </div>
                              <Button
                                onClick={handlePayment}
                                disabled={state.isLoading || !state.voucherCode.trim()}
                                className="w-full"
                                size="lg"
                              >
                                {state.isLoading ? 'Activation...' : 'Activer l\'abonnement'}
                              </Button>
                            </div>
                          )}

                          {state.method === 'custom_payment' && (
                            <div className="space-y-3">
                              <Alert className="bg-orange-50 border-orange-200">
                                <AlertCircle className="h-4 w-4 text-orange-600" />
                                <AlertDescription className="text-orange-700 text-sm">
                                  <strong>Instructions de paiement</strong><br/>
                                  • RIB: {pricing.paymentDetails.ribNumber}<br/>
                                  • D17: {pricing.paymentDetails.d17PhoneNumber}<br/>
                                  • Montant: {pricing[state.subscriptionType].finalPrice} {pricing.currency}
                                </AlertDescription>
                              </Alert>
                              
                              <div>
                                <Label htmlFor="customDetails" className="text-sm">Détails du paiement</Label>
                                <Textarea
                                  id="customDetails"
                                  placeholder="Décrivez votre méthode de paiement (ex: Virement bancaire du [date])"
                                  value={state.customPaymentDetails}
                                  onChange={(e) => setState(prev => ({ 
                                    ...prev, 
                                    customPaymentDetails: e.target.value 
                                  }))}
                                  rows={3}
                                  className="mt-1"
                                />
                              </div>

                              <Button
                                onClick={handlePayment}
                                disabled={state.isLoading || !state.customPaymentDetails.trim()}
                                className="w-full"
                                size="lg"
                              >
                                {state.isLoading ? 'Traitement...' : 'Soumettre la demande'}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Upload Proof Section - Compact */}
                    {state.status === 'awaiting_proof' && (
                      <Card className="h-fit">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Justificatif de paiement</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                          <Alert className="bg-blue-50 border-blue-200">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700 text-sm">
                              Téléversez une capture d'écran ou photo de votre justificatif de paiement
                            </AlertDescription>
                          </Alert>
                          
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                            <UploadDropzone
                              endpoint="proofUploader"
                              onClientUploadComplete={(res) => {
                                if (res?.[0]) {
                                  setState(prev => ({
                                    ...prev,
                                    proofFileUrl: res[0].url,
                                    proofFileName: res[0].name,
                                    isUploading: false
                                  }))
                                  toast({
                                    title: 'Téléversement réussi',
                                    description: `${res[0].name} téléversé avec succès`,
                                    variant: 'default'
                                  })
                                }
                              }}
                              onUploadError={(error: Error) => {
                                setState(prev => ({ ...prev, isUploading: false }))
                                toast({
                                  title: 'Erreur de téléversement',
                                  description: error.message,
                                  variant: 'destructive'
                                })
                              }}
                              onUploadBegin={({ name }) => {
                                setState(prev => ({ ...prev, isUploading: true }))
                                toast({
                                  title: 'Téléversement démarré',
                                  description: `Téléversement de ${name} en cours...`,
                                  variant: 'default'
                                })
                              }}
                            />
                            {state.proofFileUrl && (
                              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-green-800">
                                      ✓ {state.proofFileName || 'Fichier téléversé'}
                                    </p>
                                    <p className="text-xs text-green-600">
                                      Fichier prêt pour vérification
                                    </p>
                                  </div>
                                  <a 
                                    href={state.proofFileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full hover:bg-blue-200 transition-colors"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Voir
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>

                          <Button
                            onClick={handleProofUpload}
                            disabled={state.isLoading || !state.proofFileUrl}
                            className="w-full"
                            size="lg"
                          >
                            {state.isLoading ? 'Enregistrement...' : 'Confirmer le justificatif'}
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Success/Completion Message */}
                    {state.status === 'completed' && (
                      <Card className="border-green-200 bg-green-50 dark:bg-green-950 h-fit">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                              <Check className="h-6 w-6 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                              {state.method === 'voucher_code' ? 'Abonnement activé !' : 'Demande soumise !'}
                            </h3>
                            <p className="text-green-700 dark:text-green-300 mb-4 text-sm">
                              {state.method === 'voucher_code' 
                                ? 'Votre abonnement a été activé avec succès. Vous avez maintenant accès à tous les contenus.'
                                : 'Votre justificatif a été soumis. Un administrateur va vérifier votre paiement dans les plus brefs délais.'
                              }
                            </p>
                            <Button onClick={() => router.push('/dashboard')} size="sm">
                              Retour au tableau de bord
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>

              </div>
            </main>
          </SidebarInset>
        </div>
      </AppSidebarProvider>
    </ProtectedRoute>
  )
}
