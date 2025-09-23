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
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
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
  Eye,
  Star,
  Zap,
  Shield,
  Clock,
  Users,
  Trophy,
  Sparkles
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
        <div className="flex w-full h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
          <AppSidebar />
          <SidebarInset className="flex flex-col h-full">
            <UniversalHeader
              title="Mise à niveau Premium"
              rightActions={
                <Button
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  className="gap-2 hover:bg-white/80 backdrop-blur-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </Button>
              }
            />

            <main className="flex-1 overflow-hidden">
              <div className="h-full max-w-7xl mx-auto p-6">
                
                {/* Enhanced Header with Progress */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 px-6 py-3 rounded-full border border-blue-200 dark:border-blue-700 mb-6 backdrop-blur-sm">
                    <Sparkles className="h-5 w-5 text-blue-600 animate-pulse" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Mise à niveau Premium</span>
                  </div>
                  <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent mb-4">
                    Débloquez votre potentiel
                  </h1>
                  <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
                    Accédez à tous les contenus premium, examens exclusifs et outils avancés pour exceller dans vos études médicales
                  </p>
                  
                  {/* Enhanced Progress Steps */}
                  <div className="flex justify-center mt-8">
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-3 transition-all duration-500 ${
                          state.status !== 'selecting' ? 'bg-green-500 border-green-500 text-white shadow-lg scale-110' : 'bg-blue-500 border-blue-500 text-white shadow-md'
                        }`}>
                          {state.status !== 'selecting' ? <Check className="h-5 w-5" /> : '1'}
                        </div>
                        <span className="ml-3 text-sm font-semibold">Choisir le plan</span>
                      </div>
                      <div className={`w-16 h-1 rounded-full transition-all duration-500 ${
                        state.method ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-3 transition-all duration-500 ${
                          state.method ? (state.status === 'completed' ? 'bg-green-500 border-green-500 text-white shadow-lg scale-110' : 'bg-blue-500 border-blue-500 text-white shadow-md') : 'bg-gray-300 border-gray-300 text-gray-500'
                        }`}>
                          {state.status === 'completed' ? <Check className="h-5 w-5" /> : '2'}
                        </div>
                        <span className="ml-3 text-sm font-semibold">Paiement</span>
                      </div>
                      <div className={`w-16 h-1 rounded-full transition-all duration-500 ${
                        state.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-3 transition-all duration-500 ${
                          state.status === 'completed' ? 'bg-green-500 border-green-500 text-white shadow-lg scale-110' : 'bg-gray-300 border-gray-300 text-gray-500'
                        }`}>
                          {state.status === 'completed' ? <Check className="h-5 w-5" /> : '3'}
                        </div>
                        <span className="ml-3 text-sm font-semibold">Confirmation</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100%-220px)]">
                  
                  {/* Left Column - Enhanced Subscription Plans */}
                  <div className="lg:col-span-2 space-y-8 overflow-y-auto pr-2">
                    
                    {/* Premium Features Highlight */}
                    <Card className="border-0 shadow-2xl bg-gradient-to-br from-white via-blue-50 to-indigo-50 dark:from-gray-800 dark:via-blue-950 dark:to-indigo-950">
                      <CardContent className="p-8">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl shadow-lg">
                            <Crown className="h-6 w-6 text-white" />
                          </div>
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Fonctionnalités Premium</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          {[
                            { icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'Contenu exclusif' },
                            { icon: Zap, color: 'text-orange-500', bg: 'bg-orange-100', label: 'Accès illimité' },
                            { icon: Trophy, color: 'text-green-500', bg: 'bg-green-100', label: 'Examens avancés' },
                            { icon: Shield, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Support prioritaire' }
                          ].map(({ icon: Icon, color, bg, label }, index) => (
                            <div key={index} className="flex flex-col items-center text-center group">
                              <div className={`p-4 ${bg} dark:bg-gray-700 rounded-xl shadow-sm border mb-3 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md`}>
                                <Icon className={`h-7 w-7 ${color}`} />
                              </div>
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Enhanced Subscription Plans */}
                    <Card className="shadow-2xl border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                      <CardHeader className="pb-6">
                        <CardTitle className="flex items-center gap-3 text-2xl">
                          <Calendar className="h-6 w-6 text-blue-500" />
                          Choisissez votre plan d'abonnement
                        </CardTitle>
                        <CardDescription className="text-lg">Sélectionnez la durée qui correspond le mieux à vos besoins d'études</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <RadioGroup
                          value={state.subscriptionType}
                          onValueChange={handleSubscriptionTypeChange}
                          className="grid grid-cols-1 gap-6"
                        >
                          {/* Semester Plan */}
                          <Label 
                            htmlFor="semester" 
                            className={`relative group cursor-pointer transition-all duration-500 ${
                              state.subscriptionType === 'semester' 
                                ? 'scale-105 shadow-xl' 
                                : 'hover:scale-102 hover:shadow-lg'
                            }`}
                          >
                            <div className={`relative border-3 rounded-2xl p-8 transition-all duration-500 ${
                              state.subscriptionType === 'semester'
                                ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600'
                            }`}>
                              <RadioGroupItem value="semester" id="semester" className="absolute top-6 right-6 scale-125" />
                              
                              <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
                                    <Calendar className="h-6 w-6 text-blue-600" />
                                  </div>
                                  <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Plan Semestriel</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Parfait pour un semestre d'études</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-3xl font-bold text-blue-600">
                                    {pricing.isDiscountActive ? (
                                      <div className="space-y-1">
                                        <div className="text-lg line-through text-gray-400">
                                          {pricing.semester.originalPrice} {pricing.currency}
                                        </div>
                                        <div className="text-3xl font-bold text-green-600">
                                          {pricing.semester.finalPrice} {pricing.currency}
                                        </div>
                                      </div>
                                    ) : (
                                      <span>{pricing.semester.finalPrice} {pricing.currency}</span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500 font-medium">{pricing.semester.duration}</div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <Check className="h-4 w-4 text-green-500" />
                                  <span>Accès complet 6 mois</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Check className="h-4 w-4 text-green-500" />
                                  <span>Support par email</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Check className="h-4 w-4 text-green-500" />
                                  <span>Mises à jour incluses</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Check className="h-4 w-4 text-green-500" />
                                  <span>Contenu premium</span>
                                </div>
                              </div>
                            </div>
                          </Label>

                          {/* Annual Plan */}
                          <Label 
                            htmlFor="annual" 
                            className={`relative group cursor-pointer transition-all duration-500 ${
                              state.subscriptionType === 'annual' 
                                ? 'scale-105 shadow-xl' 
                                : 'hover:scale-102 hover:shadow-lg'
                            }`}
                          >
                            <div className={`relative border-3 rounded-2xl p-8 transition-all duration-500 ${
                              state.subscriptionType === 'annual'
                                ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-300 dark:hover:border-green-600'
                            }`}>
                              <RadioGroupItem value="annual" id="annual" className="absolute top-6 right-6 scale-125" />
                              
                              {/* Recommended Badge */}
                              <div className="absolute -top-4 left-8">
                                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 text-sm font-semibold shadow-lg">
                                  <Star className="h-4 w-4 mr-1" />
                                  Recommandé
                                </Badge>
                              </div>
                              
                              <div className="flex items-start justify-between mb-6 mt-4">
                                <div className="flex items-center gap-4">
                                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-xl">
                                    <CalendarDays className="h-6 w-6 text-green-600" />
                                  </div>
                                  <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Plan Annuel</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Meilleure valeur pour l'année complète</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-3xl font-bold text-green-600">
                                    {pricing.isDiscountActive ? (
                                      <div className="space-y-1">
                                        <div className="text-lg line-through text-gray-400">
                                          {pricing.annual.originalPrice} {pricing.currency}
                                        </div>
                                        <div className="text-3xl font-bold text-green-600">
                                          {pricing.annual.finalPrice} {pricing.currency}
                                        </div>
                                      </div>
                                    ) : (
                                      <span>{pricing.annual.finalPrice} {pricing.currency}</span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500 font-medium">{pricing.annual.duration}</div>
                                  <div className="text-sm font-bold text-green-600">
                                    Économie: {pricing.annual.savings} {pricing.currency}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <Check className="h-4 w-4 text-green-500" />
                                  <span>Accès complet 12 mois</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Check className="h-4 w-4 text-green-500" />
                                  <span>Support prioritaire</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Check className="h-4 w-4 text-green-500" />
                                  <span>Mises à jour gratuites</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Check className="h-4 w-4 text-green-500" />
                                  <span>Contenu exclusif</span>
                                </div>
                              </div>
                            </div>
                          </Label>
                        </RadioGroup>

                        {pricing.isDiscountActive && (
                          <Alert className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-lg">
                            <Sparkles className="h-5 w-5 text-green-600 animate-pulse" />
                            <AlertDescription className="text-green-700 font-semibold text-lg">
                              🎉 <strong>Offre limitée:</strong> {pricing.discountPercentage}% de réduction sur tous les abonnements !
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column - Enhanced Payment Details */}
                  <div className="space-y-6 overflow-y-auto">
                    {/* Payment Summary */}
                    <Card className="sticky top-0 shadow-2xl border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-xl">
                          <Trophy className="h-6 w-6 text-yellow-500" />
                          Résumé de commande
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">Plan sélectionné:</span>
                            <span className="font-semibold capitalize">{state.subscriptionType === 'annual' ? 'Annuel' : 'Semestriel'}</span>
                          </div>
                          
                          {pricing.isDiscountActive && (
                            <div className="flex justify-between items-center text-red-600">
                              <span>Prix original:</span>
                              <span className="line-through">{pricing[state.subscriptionType].originalPrice} {pricing.currency}</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">Prix:</span>
                            <span className="font-semibold">{pricing[state.subscriptionType].finalPrice} {pricing.currency}</span>
                          </div>
                          
                          {state.subscriptionType === 'annual' && (
                            <div className="flex justify-between items-center text-green-600">
                              <span>Économie:</span>
                              <span className="font-semibold">{pricing.annual.savings} {pricing.currency}</span>
                            </div>
                          )}
                          
                          <Separator />
                          
                          <div className="flex justify-between items-center text-xl font-bold">
                            <span>Total:</span>
                            <span className="text-3xl text-green-600">{pricing[state.subscriptionType].finalPrice} {pricing.currency}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Enhanced Payment Methods */}
                    <Card className="shadow-xl border-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-xl">
                          <CreditCard className="h-6 w-6 text-green-500" />
                          Méthodes de paiement
                        </CardTitle>
                        <CardDescription>Choisissez votre méthode de paiement préférée</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 gap-4">
                          {[
                            {
                              id: 'konnect_gateway',
                              icon: CreditCard,
                              title: 'Konnect Gateway',
                              description: 'Paiement par carte bancaire sécurisé',
                              badges: [
                                { label: 'Instantané', icon: Zap, color: 'green' },
                                { label: 'Sécurisé', icon: Shield, color: 'blue' }
                              ],
                              gradient: 'from-blue-500 to-indigo-500',
                              selectedColor: 'blue'
                            },
                            {
                              id: 'voucher_code',
                              icon: Gift,
                              title: 'Code de bon',
                              description: 'Utilisez un code promotionnel',
                              badges: [
                                { label: 'Gratuit', icon: Gift, color: 'green' },
                                { label: 'Immédiat', icon: Zap, color: 'yellow' }
                              ],
                              gradient: 'from-green-500 to-emerald-500',
                              selectedColor: 'green'
                            },
                            {
                              id: 'custom_payment',
                              icon: Upload,
                              title: 'Virement ou D17',
                              description: 'Paiement traditionnel avec justificatif',
                              badges: [
                                { label: 'Validation manuelle', icon: Clock, color: 'orange' },
                                { label: 'Assistance', icon: Users, color: 'blue' }
                              ],
                              gradient: 'from-orange-500 to-red-500',
                              selectedColor: 'orange'
                            }
                          ].map((method) => {
                            const isSelected = state.method === method.id
                            return (
                              <div 
                                key={method.id}
                                className={`group cursor-pointer transition-all duration-500 ${
                                  isSelected 
                                    ? 'scale-105 shadow-xl' 
                                    : 'hover:scale-102 hover:shadow-lg'
                                }`}
                                onClick={() => handleMethodSelect(method.id as PaymentMethod)}
                              >
                                <div className={`relative border-3 rounded-2xl p-6 transition-all duration-500 ${
                                  isSelected
                                    ? `border-${method.selectedColor}-500 bg-${method.selectedColor}-50 dark:bg-${method.selectedColor}-950/20`
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                }`}>
                                  <div className="flex items-center gap-4">
                                    <div className={`p-4 bg-gradient-to-r ${method.gradient} rounded-2xl shadow-lg`}>
                                      <method.icon className="h-7 w-7 text-white" />
                                    </div>
                                    <div className="flex-1">
                                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{method.title}</h3>
                                      <p className="text-gray-600 dark:text-gray-400">{method.description}</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      {method.badges.map((badge, index) => (
                                        <Badge key={index} variant="outline" className={`bg-${badge.color}-50 text-${badge.color}-700 border-${badge.color}-200 text-xs`}>
                                          <badge.icon className="h-3 w-3 mr-1" />
                                          {badge.label}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Payment Details Form */}
                    {state.method && (
                      <Card className="shadow-xl border-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-xl">
                            {state.method === 'voucher_code' ? (
                              <>
                                <Gift className="h-6 w-6 text-green-500" />
                                Code de bon
                              </>
                            ) : state.method === 'custom_payment' ? (
                              <>
                                <Upload className="h-6 w-6 text-orange-500" />
                                Instructions de paiement
                              </>
                            ) : (
                              <>
                                <CreditCard className="h-6 w-6 text-blue-500" />
                                Finaliser le paiement
                              </>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-6">
                          
                          {state.method === 'konnect_gateway' && (
                            <div className="text-center py-8">
                              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-3xl p-8 mb-6">
                                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                                  <Shield className="h-10 w-10 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Paiement sécurisé</h3>
                                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                  Vous serez redirigé vers notre partenaire Konnect pour finaliser votre paiement en toute sécurité avec votre carte bancaire.
                                </p>
                              </div>
                              <Button
                                onClick={handlePayment}
                                disabled={state.isLoading}
                                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl text-lg"
                                size="lg"
                              >
                                {state.isLoading ? (
                                  <div className="flex items-center gap-3">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Redirection en cours...
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <CreditCard className="h-6 w-6" />
                                    Payer {pricing[state.subscriptionType].finalPrice} {pricing.currency}
                                  </div>
                                )}
                              </Button>
                            </div>
                          )}

                          {state.method === 'voucher_code' && (
                            <div className="space-y-6">
                              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-3xl p-8">
                                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                                  <Gift className="h-8 w-8 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Code promotionnel</h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                                  Entrez votre code de bon pour activer instantanément votre abonnement premium et accéder à tous les contenus exclusifs.
                                </p>
                                <div className="space-y-4">
                                  <Label htmlFor="voucherCode" className="text-sm font-semibold">Code de bon</Label>
                                  <Input
                                    id="voucherCode"
                                    placeholder="MEDQ-XXXXX"
                                    value={state.voucherCode}
                                    onChange={(e) => setState(prev => ({ 
                                      ...prev, 
                                      voucherCode: e.target.value.toUpperCase() 
                                    }))}
                                    className="font-mono text-center text-xl tracking-wider h-14 rounded-xl border-2 focus:border-green-500"
                                  />
                                </div>
                              </div>
                              <Button
                                onClick={handlePayment}
                                disabled={state.isLoading || !state.voucherCode.trim()}
                                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl text-lg"
                                size="lg"
                              >
                                {state.isLoading ? (
                                  <div className="flex items-center gap-3">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Activation en cours...
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <Zap className="h-6 w-6" />
                                    Activer l'abonnement
                                  </div>
                                )}
                              </Button>
                            </div>
                          )}

                          {state.method === 'custom_payment' && (
                            <div className="space-y-6">
                              <Alert className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200 rounded-2xl p-6">
                                <AlertCircle className="h-5 w-5 text-orange-600" />
                                <AlertDescription className="text-orange-700">
                                  <div className="space-y-3">
                                    <div className="font-bold text-lg">Instructions de paiement:</div>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-3 bg-white rounded-lg p-3">
                                        <span className="font-semibold">RIB:</span>
                                        <code className="bg-gray-100 px-3 py-2 rounded-lg font-mono text-sm">{pricing.paymentDetails.ribNumber}</code>
                                      </div>
                                      <div className="flex items-center gap-3 bg-white rounded-lg p-3">
                                        <span className="font-semibold">D17:</span>
                                        <code className="bg-gray-100 px-3 py-2 rounded-lg font-mono text-sm">{pricing.paymentDetails.d17PhoneNumber}</code>
                                      </div>
                                      <div className="flex items-center gap-3 bg-white rounded-lg p-3">
                                        <span className="font-semibold">Montant:</span>
                                        <code className="bg-green-100 px-3 py-2 rounded-lg font-mono text-sm font-bold text-green-700">
                                          {pricing[state.subscriptionType].finalPrice} {pricing.currency}
                                        </code>
                                      </div>
                                    </div>
                                  </div>
                                </AlertDescription>
                              </Alert>
                              
                              <div>
                                <Label htmlFor="customDetails" className="text-sm font-semibold">Détails du paiement</Label>
                                <Textarea
                                  id="customDetails"
                                  placeholder="Décrivez votre méthode de paiement (ex: Virement bancaire effectué le [date], référence [numéro])"
                                  value={state.customPaymentDetails}
                                  onChange={(e) => setState(prev => ({ 
                                    ...prev, 
                                    customPaymentDetails: e.target.value 
                                  }))}
                                  rows={4}
                                  className="mt-2 rounded-xl border-2 focus:border-orange-500"
                                />
                              </div>

                              <Button
                                onClick={handlePayment}
                                disabled={state.isLoading || !state.customPaymentDetails.trim()}
                                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl text-lg"
                                size="lg"
                              >
                                {state.isLoading ? (
                                  <div className="flex items-center gap-3">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Traitement en cours...
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <Upload className="h-6 w-6" />
                                    Soumettre la demande
                                  </div>
                                )}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Upload Proof Section - Enhanced */}
                    {state.status === 'awaiting_proof' && (
                      <Card className="shadow-2xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                        <CardHeader className="pb-6">
                          <CardTitle className="flex items-center gap-3 text-xl">
                            <Upload className="h-6 w-6 text-blue-500" />
                            Justificatif de paiement
                          </CardTitle>
                          <CardDescription className="text-lg">
                            Téléversez une preuve de votre paiement pour finaliser votre abonnement premium
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-6">
                          <Alert className="bg-blue-100 border-blue-300 rounded-2xl p-4">
                            <AlertCircle className="h-5 w-5 text-blue-600" />
                            <AlertDescription className="text-blue-800 font-semibold">
                              📸 Formats acceptés: captures d'écran, photos de reçus, confirmations de virement (JPG, PNG, PDF)
                            </AlertDescription>
                          </Alert>
                          
                          <div className="relative border-3 border-dashed border-blue-300 rounded-2xl p-8 transition-all hover:border-blue-400 hover:bg-blue-50/50">
                            <UploadDropzone
                              endpoint="imageUploader"
                              onClientUploadComplete={(res) => {
                                if (res?.[0]) {
                                  setState(prev => ({
                                    ...prev,
                                    proofFileUrl: res[0].url,
                                    proofFileName: res[0].name,
                                    isUploading: false
                                  }))
                                  toast({
                                    title: '✅ Téléversement réussi',
                                    description: `${res[0].name} a été téléversé avec succès`,
                                    variant: 'default'
                                  })
                                }
                              }}
                              onUploadError={(error: Error) => {
                                setState(prev => ({ ...prev, isUploading: false }))
                                toast({
                                  title: '❌ Erreur de téléversement',
                                  description: error.message,
                                  variant: 'destructive'
                                })
                              }}
                              onUploadBegin={(name) => {
                                setState(prev => ({ ...prev, isUploading: true }))
                                toast({
                                  title: '⏳ Téléversement en cours',
                                  description: `Téléversement de ${name}...`,
                                  variant: 'default'
                                })
                              }}
                            />
                            {state.proofFileUrl && (
                              <div className="mt-6 p-6 bg-green-100 border border-green-200 rounded-2xl">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
                                      <Check className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-green-800 text-lg">
                                        {state.proofFileName || 'Fichier téléversé'}
                                      </p>
                                      <p className="text-green-600">
                                        Prêt pour vérification par notre équipe
                                      </p>
                                    </div>
                                  </div>
                                  <a 
                                    href={state.proofFileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors shadow-lg"
                                  >
                                    <Eye className="h-5 w-5 mr-2" />
                                    Aperçu
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>

                          <Button
                            onClick={handleProofUpload}
                            disabled={state.isLoading || !state.proofFileUrl}
                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl text-lg"
                            size="lg"
                          >
                            {state.isLoading ? (
                              <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Enregistrement en cours...
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <Check className="h-6 w-6" />
                                Confirmer le justificatif
                              </div>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Success/Completion Message - Enhanced */}
                    {state.status === 'completed' && (
                      <Card className="shadow-2xl border-0 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-green-950 dark:via-emerald-950 dark:to-green-900">
                        <CardContent className="pt-10 pb-10">
                          <div className="text-center">
                            <div className="relative mb-8">
                              <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                                <Check className="h-12 w-12 text-white" />
                              </div>
                              <div className="absolute -top-2 -right-2 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                                <Sparkles className="h-5 w-5 text-yellow-800 animate-pulse" />
                              </div>
                            </div>
                            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                              {state.method === 'voucher_code' ? '🎉 Abonnement activé !' : '✅ Demande soumise !'}
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300 mb-8 text-xl leading-relaxed max-w-md mx-auto">
                              {state.method === 'voucher_code' 
                                ? 'Félicitations ! Votre abonnement premium est maintenant actif. Profitez de tous les contenus exclusifs et outils avancés.'
                                : 'Votre demande a été transmise à notre équipe. Vous recevrez une confirmation par email dès la validation de votre paiement.'
                              }
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                              <Button 
                                onClick={() => router.push('/dashboard')}
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl text-lg"
                              >
                                <Trophy className="h-6 w-6 mr-2" />
                                Accéder au contenu premium
                              </Button>
                              {state.method !== 'voucher_code' && (
                                <Button 
                                  variant="outline"
                                  onClick={() => router.push('/profile')}
                                  className="border-3 border-gray-300 hover:border-gray-400 py-4 px-8 rounded-2xl transition-all duration-300 font-semibold text-lg"
                                >
                                  <Users className="h-6 w-6 mr-2" />
                                  Mon profil
                                </Button>
                              )}
                            </div>
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
