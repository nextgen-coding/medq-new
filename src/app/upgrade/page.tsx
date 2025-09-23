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

  const handleInitiatePayment = async () => {
    if (!state.method) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner une méthode de paiement',
        variant: 'destructive'
      })
      return
    }

    if (state.method === 'voucher_code' && !state.voucherCode.trim()) {
      toast({
        title: 'Erreur',
        description: 'Veuillez entrer un code de bon',
        variant: 'destructive'
      })
      return
    }

    if (state.method === 'custom_payment' && !state.customPaymentDetails.trim()) {
      toast({
        title: 'Erreur',
        description: 'Veuillez entrer les détails du paiement',
        variant: 'destructive'
      })
      return
    }

    setState(prev => ({ ...prev, isLoading: true, status: 'processing' }))

    try {
      const response = await fetch('/api/payments/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: state.method,
          subscriptionType: state.subscriptionType,
          voucherCode: state.voucherCode,
          customPaymentDetails: state.customPaymentDetails
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'initialisation du paiement')
      }

      if (data.success) {
        setState(prev => ({
          ...prev,
          paymentId: data.paymentId,
          paymentUrl: data.paymentUrl,
          requiresProof: data.requiresProof || false
        }))

        if (data.paymentUrl) {
          // Redirect to Konnect payment page
          window.location.href = data.paymentUrl
        } else if (data.requiresProof) {
          // Show proof upload form
          setState(prev => ({ ...prev, status: 'awaiting_proof' }))
        } else {
          // Voucher payment completed
          setState(prev => ({ ...prev, status: 'completed' }))
          toast({
            title: 'Succès',
            description: data.message,
            variant: 'default'
          })
          // Refresh user data and redirect
          if (refreshUser) await refreshUser()
          router.push('/dashboard')
        }
      }

    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur inattendue',
        variant: 'destructive'
      })
      // Keep status as 'selecting' to maintain UI visibility
      setState(prev => ({ ...prev, status: 'selecting' }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const handleProofUpload = async () => {
    if (!state.proofFileUrl || !state.paymentId) {
      toast({
        title: 'Erreur',
        description: 'Veuillez téléverser un fichier',
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
        <div className="flex w-full h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
          <AppSidebar />
          <SidebarInset className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
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

            <main className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                
                {/* Header */}
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Mise à niveau de votre compte
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Débloquez l'accès complet à tous les contenus MedQ
                  </p>
                </div>

                {/* Subscription Type Selection */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-yellow-500" />
                      Choisissez votre abonnement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={state.subscriptionType}
                      onValueChange={handleSubscriptionTypeChange}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      <Label 
                        htmlFor="semester" 
                        className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <RadioGroupItem value="semester" id="semester" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-4 w-4" />
                            <span className="font-medium">Semestriel</span>
                          </div>
                          <div className="text-2xl font-bold text-blue-600">
                            {pricing.isDiscountActive ? (
                              <div className="space-y-1">
                                <div className="text-sm text-gray-500 line-through">
                                  {pricing.semester.originalPrice} {pricing.currency}
                                </div>
                                <div className="text-2xl font-bold text-green-600">
                                  {pricing.semester.finalPrice} {pricing.currency}
                                </div>
                              </div>
                            ) : (
                              `${pricing.semester.finalPrice} ${pricing.currency}`
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            Pour {pricing.semester.duration}
                          </div>
                        </div>
                      </Label>

                      <Label 
                        htmlFor="annual" 
                        className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 relative"
                      >
                        <RadioGroupItem value="annual" id="annual" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CalendarDays className="h-4 w-4" />
                            <span className="font-medium">Annuel</span>
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              {pricing.isDiscountActive ? (
                                `Remise ${pricing.discountPercentage}%`
                              ) : (
                                `Économisez ${pricing.annual.savings} ${pricing.currency}`
                              )}
                            </Badge>
                          </div>
                          <div className="text-2xl font-bold text-blue-600">
                            {pricing.isDiscountActive ? (
                              <div className="space-y-1">
                                <div className="text-sm text-gray-500 line-through">
                                  {pricing.annual.originalPrice} {pricing.currency}
                                </div>
                                <div className="text-2xl font-bold text-green-600">
                                  {pricing.annual.finalPrice} {pricing.currency}
                                </div>
                              </div>
                            ) : (
                              `${pricing.annual.finalPrice} ${pricing.currency}`
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            Pour {pricing.annual.duration}
                          </div>
                        </div>
                      </Label>
                    </RadioGroup>
                  </CardContent>
                </Card>

                {state.status === 'selecting' && (
                  <>
                    {/* Payment Methods */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      
                      {/* Konnect Gateway */}
                      <Card 
                        className={`cursor-pointer transition-all ${
                          state.method === 'konnect_gateway' 
                            ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' 
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => handleMethodSelect('konnect_gateway')}
                      >
                        <CardHeader className="text-center">
                          <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-2">
                            <CreditCard className="h-6 w-6 text-blue-600" />
                          </div>
                          <CardTitle className="text-lg">Paiement en ligne</CardTitle>
                          <CardDescription>
                            Carte bancaire via Konnect
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="text-sm space-y-2">
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500" />
                              Paiement sécurisé
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500" />
                              Activation immédiate
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500" />
                              Cartes Visa/Mastercard
                            </li>
                          </ul>
                        </CardContent>
                      </Card>

                      {/* Voucher Code */}
                      <Card 
                        className={`cursor-pointer transition-all ${
                          state.method === 'voucher_code' 
                            ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950' 
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => handleMethodSelect('voucher_code')}
                      >
                        <CardHeader className="text-center">
                          <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-2">
                            <Gift className="h-6 w-6 text-green-600" />
                          </div>
                          <CardTitle className="text-lg">Code de bon</CardTitle>
                          <CardDescription>
                            Utilisez un code de bon
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="text-sm space-y-2">
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500" />
                              Activation immédiate
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500" />
                              Gratuit avec le code
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500" />
                              Code fourni par l'admin
                            </li>
                          </ul>
                        </CardContent>
                      </Card>

                      {/* Custom Payment */}
                      <Card 
                        className={`cursor-pointer transition-all ${
                          state.method === 'custom_payment' 
                            ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950' 
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => handleMethodSelect('custom_payment')}
                      >
                        <CardHeader className="text-center">
                          <div className="mx-auto w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mb-2">
                            <Upload className="h-6 w-6 text-orange-600" />
                          </div>
                          <CardTitle className="text-lg">Paiement personnalisé</CardTitle>
                          <CardDescription>
                            Virement ou D17
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="text-sm space-y-2">
                            <li className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                              Validation manuelle
                            </li>
                            <li className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                              Justificatif requis
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500" />
                              Virement bancaire
                            </li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Payment Details Form */}
                    {state.method && (
                      <Card className="mb-6">
                        <CardHeader>
                          <CardTitle>Détails du paiement</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          
                          {state.method === 'voucher_code' && (
                            <div>
                              <Label htmlFor="voucherCode">Code de bon</Label>
                              <Input
                                id="voucherCode"
                                placeholder="Entrez votre code de bon"
                                value={state.voucherCode}
                                onChange={(e) => setState(prev => ({ 
                                  ...prev, 
                                  voucherCode: e.target.value.toUpperCase() 
                                }))}
                              />
                            </div>
                          )}

                          {state.method === 'custom_payment' && (
                            <>
                              <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                  <strong>Instructions de paiement :</strong><br />
                                  • Virement bancaire : RIB {pricing.paymentDetails.ribNumber}<br />
                                  • D17 : {pricing.paymentDetails.d17PhoneNumber}<br />
                                  • Montant : {pricing[state.subscriptionType].finalPrice} {pricing.currency}<br />
                                  • Référence : Votre email d'inscription
                                </AlertDescription>
                              </Alert>
                              
                              <div>
                                <Label htmlFor="paymentDetails">Détails du paiement</Label>
                                <Textarea
                                  id="paymentDetails"
                                  placeholder="Décrivez votre méthode de paiement (numéro de transaction, référence, etc.)"
                                  value={state.customPaymentDetails}
                                  onChange={(e) => setState(prev => ({ 
                                    ...prev, 
                                    customPaymentDetails: e.target.value 
                                  }))}
                                  rows={3}
                                />
                              </div>
                            </>
                          )}

                          <Button
                            onClick={handleInitiatePayment}
                            disabled={state.isLoading}
                            className="w-full"
                            size="lg"
                          >
                            {state.isLoading ? (
                              'Traitement en cours...'
                            ) : (
                              <>
                                {state.method === 'konnect_gateway' && 'Payer maintenant'}
                                {state.method === 'voucher_code' && 'Utiliser le code'}
                                {state.method === 'custom_payment' && 'Soumettre le paiement'}
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Proof Upload Form */}
                {state.status === 'awaiting_proof' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Téléverser le justificatif</CardTitle>
                      <CardDescription>
                        Veuillez téléverser une photo ou un PDF de votre justificatif de paiement
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Justificatif de paiement</Label>
                        {state.isUploading && (
                          <div className="mb-2">
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                              <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-sm text-blue-800">Téléversement en cours...</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <UploadDropzone
                          endpoint="imageUploader"
                          onClientUploadComplete={(res: any) => {
                            console.log("Upload completed:", res);
                            setState(prev => ({ ...prev, isUploading: false }))
                            if (res && res[0]) {
                              setState(prev => ({ 
                                ...prev, 
                                proofFileUrl: res[0].url,
                                proofFileName: res[0].name || 'Fichier téléversé'
                              }))
                              toast({
                                title: 'Succès',
                                description: 'Fichier téléversé avec succès',
                                variant: 'default'
                              })
                            }
                          }}
                          onUploadError={(error: Error) => {
                            console.error("Upload error:", error);
                            setState(prev => ({ ...prev, isUploading: false }))
                            toast({
                              title: 'Erreur de téléversement',
                              description: error.message || 'Erreur lors du téléversement du fichier',
                              variant: 'destructive'
                            })
                          }}
                          onUploadBegin={(name: string) => {
                            console.log("Upload beginning for:", name);
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
                  <Card className="border-green-200 bg-green-50 dark:bg-green-950">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                          <Check className="h-6 w-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                          {state.method === 'voucher_code' ? 'Abonnement activé !' : 'Demande soumise !'}
                        </h3>
                        <p className="text-green-700 dark:text-green-300 mb-4">
                          {state.method === 'voucher_code' 
                            ? 'Votre abonnement a été activé avec succès. Vous avez maintenant accès à tous les contenus.'
                            : 'Votre justificatif a été soumis. Un administrateur va vérifier votre paiement dans les plus brefs délais.'
                          }
                        </p>
                        <Button onClick={() => router.push('/dashboard')}>
                          Retour au tableau de bord
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

              </div>
            </main>
          </SidebarInset>
        </div>
      </AppSidebarProvider>
    </ProtectedRoute>
  )
}
