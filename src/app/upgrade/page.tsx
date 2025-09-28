'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { UploadDropzone } from '@/utils/uploadthing'
import { 
  CreditCard, 
  Gift, 
  Upload, 
  Check, 
  ArrowLeft,
  Crown,
  Calendar,
  CalendarDays,
  Sparkles,
  Star,
  Shield,
  CheckCircle,
  RefreshCcw,
  Clock,
  ChevronLeft,
  ChevronRight,
  Banknote,
  FileText,
  Target
} from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar'
import { SidebarInset } from '@/components/ui/sidebar'
import { UniversalHeader } from '@/components/layout/UniversalHeader'

type PaymentMethod = 'konnect_gateway' | 'voucher_code' | 'custom_payment'
type SubscriptionType = 'semester' | 'annual'
type WizardStep = 'plan' | 'method' | 'details' | 'confirmation'

interface PaymentState {
  method: PaymentMethod | null
  subscriptionType: SubscriptionType
  voucherCode: string
  couponCode: string
  couponDiscount: number
  couponError: string | null
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
  discountEndDate: string | null
  paymentDetails: {
    ribNumber: string
    d17PhoneNumber: string
  }
}

const steps = [
  { key: 'plan', title: 'Choisir un plan', icon: Target, description: 'Sélectionnez votre abonnement' },
  { key: 'method', title: 'Méthode de paiement', icon: CreditCard, description: 'Comment souhaitez-vous payer ?' },
  { key: 'details', title: 'Détails', icon: FileText, description: 'Détails et justificatifs requis' },
  { key: 'confirmation', title: 'Confirmation', icon: CheckCircle, description: 'Finaliser votre commande' },
]

export default function UpgradePage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [currentStep, setCurrentStep] = useState<WizardStep>('plan')
  const [state, setState] = useState<PaymentState>({
    method: null,
    subscriptionType: 'semester',
    voucherCode: '',
    couponCode: '',
    couponDiscount: 0,
    couponError: null,
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

  const [countdown, setCountdown] = useState<number | null>(null)
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
          discountEndDate: null,
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
        discountEndDate: null,
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

  // Handle payment success/failure from URL parameters
  useEffect(() => {
    const paymentStatus = searchParams.get('payment')
    const subscriptionType = searchParams.get('type')
    const paymentMethod = searchParams.get('method')
    
    if (paymentStatus === 'success') {
      setCurrentStep('confirmation')
      setState(prev => ({ ...prev, status: 'completed' }))
      
      let title = "🎉 Paiement réussi !"
      let description = `Votre abonnement ${subscriptionType === 'annual' ? 'annuel' : 'semestriel'} a été activé avec succès. Profitez de tous les contenus premium !`
      
      if (paymentMethod === 'voucher_code') {
        title = "🎉 Code de bon validé !"
        description = `Votre code de bon a été appliqué avec succès ! Votre abonnement ${subscriptionType === 'annual' ? 'annuel' : 'semestriel'} est maintenant actif.`
      } else if (paymentMethod === 'custom_payment') {
        title = "🎉 Paiement personnalisé validé !"
        description = `Votre paiement personnalisé a été validé par nos équipes. Votre abonnement ${subscriptionType === 'annual' ? 'annuel' : 'semestriel'} est maintenant actif.`
      }
      
      toast({
        title,
        description,
        variant: "default"
      })
      refreshUser()
      
      setCountdown(10)
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev && prev > 1) {
            return prev - 1
          } else {
            clearInterval(countdownInterval)
            router.push('/dashboard')
            return null
          }
        })
      }, 1000)
      
      return () => clearInterval(countdownInterval)
    } else if (paymentStatus === 'failed') {
      setCurrentStep('confirmation')
      let title = "❌ Paiement échoué"
      let description = "Le paiement n'a pas pu être traité. Veuillez réessayer ou contactez le support."
      
      if (paymentMethod === 'voucher_code') {
        title = "❌ Code de bon invalide"
        description = "Le code de bon fourni n'est pas valide ou a déjà été utilisé. Veuillez vérifier le code ou contactez le support."
      } else if (paymentMethod === 'custom_payment') {
        title = "❌ Paiement personnalisé refusé"
        description = "Votre paiement personnalisé n'a pas pu être validé. Veuillez vérifier vos informations ou contactez le support."
      }
      
      toast({
        title,
        description,
        variant: "destructive"
      })
    }
  }, [searchParams, refreshUser, router])

  const handleApplyCoupon = async () => {
    if (!state.couponCode.trim()) {
      setState(prev => ({ ...prev, couponError: 'Veuillez entrer un code de réduction' }))
      return
    }

    setState(prev => ({ ...prev, isLoading: true, couponError: null }))

    try {
      const response = await fetch('/api/payments/validate-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          couponCode: state.couponCode,
          subscriptionType: state.subscriptionType
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Code de réduction invalide')
      }

      const data = await response.json()
      setState(prev => ({
        ...prev,
        couponDiscount: data.discountAmount,
        couponError: null
      }))

      toast({
        title: 'Succès',
        description: `Code de réduction appliqué: -${data.discountAmount} TND`,
        variant: 'default'
      })
    } catch (error) {
      console.error('Coupon validation error:', error)
      setState(prev => ({
        ...prev,
        couponError: error instanceof Error ? error.message : 'Erreur lors de la validation du code',
        couponDiscount: 0
      }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
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

    if (state.method === 'custom_payment' && !state.proofFileUrl) {
      toast({
        title: 'Erreur',
        description: 'Veuillez téléverser une preuve de paiement',
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
          couponCode: state.couponCode,
          couponDiscount: state.couponDiscount,
          customPaymentDetails: state.customPaymentDetails,
          proofFileUrl: state.proofFileUrl
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
          window.location.href = data.paymentUrl
        } else if (data.requiresProof) {
          setState(prev => ({ ...prev, status: 'awaiting_proof' }))
        } else {
          setCurrentStep('confirmation')
          setState(prev => ({ ...prev, status: 'completed' }))
          
          let title = 'Succès'
          let enhancedDescription = data.message
          
          if (state.method === 'voucher_code') {
            title = '🎉 Code de bon validé !'
            enhancedDescription = `Votre code de bon a été appliqué avec succès ! ${data.message}`
          } else if (state.method === 'custom_payment') {
            title = '🎉 Paiement enregistré !'
            enhancedDescription = `Votre demande de paiement personnalisé a été enregistrée. ${data.message}`
          }
          
          toast({
            title,
            description: enhancedDescription,
            variant: 'default'
          })
          
          if (refreshUser) await refreshUser()
          setCountdown(10)
          const countdownInterval = setInterval(() => {
            setCountdown(prev => {
              if (prev && prev > 1) {
                return prev - 1
              } else {
                clearInterval(countdownInterval)
                router.push('/dashboard')
                return null
              }
            })
          }, 1000)
        }
      }

    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur inattendue',
        variant: 'destructive'
      })
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

      setCurrentStep('confirmation')
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
      setState(prev => ({ ...prev, status: 'awaiting_proof' }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const canGoNext = () => {
    switch (currentStep) {
      case 'plan':
        return true // Plan is always selected (default to semester)
      case 'method':
        return state.method !== null
      case 'details':
        if (state.method === 'voucher_code') {
          return state.voucherCode.trim().length > 0
        }
        if (state.method === 'custom_payment') {
          // Require both payment details and proof upload for custom payments
          return state.customPaymentDetails.trim().length > 0 && state.proofFileUrl !== null
        }
        return true
      default:
        return true
    }
  }

  const goNext = () => {
    const stepOrder: WizardStep[] = ['plan', 'method', 'details', 'confirmation']
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1])
    }
  }

  const goBack = () => {
    const stepOrder: WizardStep[] = ['plan', 'method', 'details', 'confirmation']
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1])
    }
  }

  const getStepIndex = (step: WizardStep): number => {
    return ['plan', 'method', 'details', 'confirmation'].indexOf(step)
  }

  if (isPricingLoading || !pricing) {
    return (
      <ProtectedRoute>
        <AppSidebarProvider>
          <div className="flex min-h-screen w-full bg-gradient-to-br from-medblue-50 to-medblue-100 dark:from-gray-900 dark:to-gray-800">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col relative z-0">
              <UniversalHeader
                title="Mise à niveau premium"
                rightActions={
                  <Button
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                    className="gap-2 hover:bg-white/80 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                  </Button>
                }
              />
              <main className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                  <div className="flex items-center justify-center min-h-[400px] sm:min-h-[500px]">
                    <div className="text-center px-4">
                      <div className="relative mb-6 sm:mb-8">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-medblue-500 to-medblue-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 animate-pulse">
                          <Crown className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                        </div>
                        <div className="absolute inset-0 w-16 h-16 sm:w-20 sm:h-20 mx-auto border-3 sm:border-4 border-medblue-200 dark:border-medblue-800 rounded-full animate-spin border-t-transparent"></div>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Chargement des offres
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                        Préparation de vos options d'abonnement...
                      </p>
                      <div className="flex justify-center mt-6">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-medblue-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-medblue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-medblue-700 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
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

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <div className="flex w-full h-screen bg-gradient-to-br from-medblue-50 via-white to-medblue-100 dark:from-gray-950 dark:via-gray-900 dark:to-medblue-950 overflow-hidden">
          <AppSidebar />
          <SidebarInset className="flex flex-col h-full relative z-0">
            <UniversalHeader
              title="MedQ Premium"
              rightActions={
                <Button
                  variant="ghost"
                  onClick={() => router.push('/dashboard')}
                  className="gap-1 sm:gap-2 hover:bg-white/20 text-gray-600 dark:text-gray-300 transition-all duration-200 text-sm sm:text-base px-2 sm:px-4"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden xs:inline">Retour au tableau de bord</span>
                  <span className="xs:hidden">Retour</span>
                </Button>
              }
            />

            <main className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
                
                {/* Progress Steps */}
                <div className="mb-6 sm:mb-8 lg:mb-12">
                  <div className="flex items-center justify-center sm:justify-between relative px-1 sm:px-0 max-w-2xl mx-auto">
                    {/* Progress line */}
                    <div className="absolute top-1/2 left-8 right-8 sm:left-0 sm:right-0 h-1 bg-medblue-200 dark:bg-gray-700 rounded-full -translate-y-1/2 z-0">
                      <div 
                        className="h-full bg-gradient-to-r from-medblue-500 to-medblue-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${(getStepIndex(currentStep) / (steps.length - 1)) * 100}%` }}
                      />
                    </div>
                    
                    {steps.map((step, index) => {
                      const isCompleted = getStepIndex(currentStep) > index
                      const isCurrent = step.key === currentStep
                      const Icon = step.icon
                      
                      return (
                        <div key={step.key} className="flex flex-col items-center group relative z-10 flex-1 sm:flex-initial">
                          <div className={`
                            relative w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 sm:border-3 flex items-center justify-center transition-all duration-300 mb-2 sm:mb-3 bg-white dark:bg-gray-800
                            ${isCompleted 
                              ? 'border-medblue-500 bg-medblue-500 text-white shadow-lg' 
                              : isCurrent 
                                ? 'border-medblue-500 text-medblue-600 dark:text-medblue-400 shadow-lg ring-2 sm:ring-4 ring-medblue-500/20' 
                                : 'border-medblue-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                            }
                          `}>
                            {isCompleted ? (
                              <Check className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                            ) : (
                              <Icon className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                            )}
                          </div>
                          <div className="text-center px-1 min-w-0 w-full">
                            <div className={`text-xs sm:text-sm font-medium transition-colors leading-tight ${
                              isCompleted || isCurrent 
                                ? 'text-medblue-700 dark:text-medblue-400' 
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              <span className="hidden sm:inline whitespace-nowrap">{step.title}</span>
                              <span className="sm:hidden text-center block truncate">{step.title.split(' ')[0]}</span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden lg:block">
                              {step.description}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Step Content */}
                <div className="relative">
                  {/* Step 1: Plan Selection */}
                  {currentStep === 'plan' && (
                    <div className="space-y-8">
                      {/* Hero Section */}
                      <div className="text-center mb-8 sm:mb-12">
                        <div className="relative inline-flex items-center justify-center mb-4 sm:mb-6">
                          <div className="absolute inset-0 bg-gradient-to-r from-medblue-500/30 to-medblue-600/30 rounded-full blur-xl"></div>
                          <div className="relative p-3 sm:p-4 bg-gradient-to-br from-medblue-500 to-medblue-600 rounded-xl sm:rounded-2xl shadow-xl">
                            <img 
                              src="https://r5p6ptp1nn.ufs.sh/f/6mc1qMI9JcraFSYUmbide7MKPVFpROQi36XnZbchzSA1G4ax" 
                              alt="MedQ Logo" 
                              className="w-8 h-8 sm:w-10 sm:h-10 object-contain brightness-0 invert"
                            />
                          </div>
                        </div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 px-2">
                          <span className="bg-gradient-to-r from-medblue-600 to-medblue-800 bg-clip-text text-transparent">
                            Choisissez votre plan
                          </span>
                        </h1>
                        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto px-4">
                          Accédez à tous les contenus premium de MedQ et boostez vos révisions
                        </p>
                      </div>

                      {/* Promotional Banner */}
                      {pricing.isDiscountActive && (
                        <div className="mb-6 sm:mb-8">
                          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 p-1 shadow-xl">
                            <div className="relative bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl p-4 sm:p-6 text-center">
                              <div className="absolute inset-0 bg-gradient-to-r from-red-50/50 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/20 rounded-lg sm:rounded-xl"></div>
                              <div className="relative">
                                <div className="flex items-center justify-center gap-1 sm:gap-2 mb-2 sm:mb-3">
                                  <Sparkles className="text-red-600 h-4 w-4 sm:h-6 sm:w-6" />
                                  <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                                    Promotion exceptionnelle
                                  </h3>
                                  <Sparkles className="text-orange-600 h-4 w-4 sm:h-6 sm:w-6" />
                                </div>
                                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
                                  <span className="text-red-600 font-bold">-{pricing.discountPercentage}%</span> sur tous les abonnements !
                                  {pricing.discountEndDate && (
                                    <span className="text-xs sm:text-sm block sm:inline"> Jusqu'au {new Date(pricing.discountEndDate).toLocaleDateString('fr-FR')}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Plan Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        {/* Semester Plan */}
                        <Card className={`relative cursor-pointer transition-all duration-300 hover:shadow-xl ${
                          state.subscriptionType === 'semester' 
                            ? 'ring-2 ring-medblue-500 shadow-xl bg-gradient-to-br from-medblue-50 to-white dark:from-medblue-900/20 dark:to-gray-800/80' 
                            : 'hover:ring-1 hover:ring-medblue-200 bg-white dark:bg-gray-800'
                        }`} onClick={() => setState(prev => ({ ...prev, subscriptionType: 'semester' }))}>
                          <CardHeader className="text-center pb-3 sm:pb-4">
                            <div className="flex items-center justify-center mb-3 sm:mb-4">
                              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-medblue-600" />
                            </div>
                            <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                              Semestriel
                            </CardTitle>
                            <CardDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                              Parfait pour un semestre d'études
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="text-center px-4 sm:px-6">
                            <div className="mb-4 sm:mb-6">
                              {pricing.isDiscountActive && (
                                <div className="text-base sm:text-lg text-gray-500 line-through mb-1">
                                  {pricing.semester.originalPrice} {pricing.currency}
                                </div>
                              )}
                              <div className="text-3xl sm:text-4xl font-bold text-medblue-600 mb-1">
                                {pricing.semester.finalPrice} {pricing.currency}
                              </div>
                              <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                                pour {pricing.semester.duration}
                              </div>
                              {pricing.isDiscountActive && pricing.semester.discountAmount > 0 && (
                                <div className="inline-block bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium mt-2">
                                  Économisez {pricing.semester.discountAmount} {pricing.currency}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2 sm:space-y-3 text-left">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                                <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300">Accès à tous les QCM premium</span>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                                <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300">Explications détaillées</span>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                                <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300">Statistiques avancées</span>
                              </div>
                            </div>
                          </CardContent>
                          {state.subscriptionType === 'semester' && (
                            <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
                              <div className="bg-medblue-500 text-white rounded-full p-1.5 sm:p-2">
                                <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                              </div>
                            </div>
                          )}
                        </Card>

                        {/* Annual Plan */}
                        <Card className={`relative cursor-pointer transition-all duration-300 hover:shadow-xl ${
                          state.subscriptionType === 'annual' 
                            ? 'ring-2 ring-medblue-500 shadow-xl bg-gradient-to-br from-medblue-50 to-white dark:from-medblue-900/20 dark:to-gray-800/80' 
                            : 'hover:ring-1 hover:ring-medblue-200 bg-white dark:bg-gray-800'
                        }`} onClick={() => setState(prev => ({ ...prev, subscriptionType: 'annual' }))}>
                          <CardHeader className="text-center pb-3 sm:pb-4">
                            <div className="flex items-center justify-center mb-3 sm:mb-4 flex-wrap gap-2">
                              <CalendarDays className="h-6 w-6 sm:h-8 sm:w-8 text-medblue-600" />
                              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 text-xs sm:text-sm">
                                Populaire
                              </Badge>
                            </div>
                            <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                              Annuel
                            </CardTitle>
                            <CardDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                              Le meilleur rapport qualité-prix
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="text-center px-4 sm:px-6">
                            <div className="mb-4 sm:mb-6">
                              {pricing.isDiscountActive && (
                                <div className="text-base sm:text-lg text-gray-500 line-through mb-1">
                                  {pricing.annual.originalPrice} {pricing.currency}
                                </div>
                              )}
                              <div className="text-3xl sm:text-4xl font-bold text-medblue-600 mb-1">
                                {pricing.annual.finalPrice} {pricing.currency}
                              </div>
                              <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                                pour {pricing.annual.duration}
                              </div>
                              <div className="flex flex-col gap-2 mt-2">
                                <div className="inline-block bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                                  Économisez {pricing.annual.savings} {pricing.currency} vs semestriel
                                </div>
                                {pricing.isDiscountActive && pricing.annual.discountAmount > 0 && (
                                  <div className="inline-block bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                                    + {pricing.annual.discountAmount} {pricing.currency} de remise
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="space-y-2 sm:space-y-3 text-left">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                                <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300">Tous les avantages semestriels</span>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 flex-shrink-0" />
                                <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300">Contenu exclusif annuel</span>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 flex-shrink-0" />
                                <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300">Support prioritaire</span>
                              </div>
                            </div>
                          </CardContent>
                          {state.subscriptionType === 'annual' && (
                            <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
                              <div className="bg-medblue-500 text-white rounded-full p-1.5 sm:p-2">
                                <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                              </div>
                            </div>
                          )}
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Payment Method */}
                  {currentStep === 'method' && (
                    <div className="space-y-6 sm:space-y-8">
                      <div className="text-center px-4">
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                          Comment souhaitez-vous payer ?
                        </h2>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                          Choisissez la méthode de paiement qui vous convient le mieux
                        </p>
                      </div>

                      <div className="grid gap-3 sm:gap-4 max-w-2xl mx-auto">
                        {/* Konnect Payment */}
                        <Card 
                          className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
                            state.method === 'konnect_gateway' 
                              ? 'ring-2 ring-medblue-500 bg-gradient-to-r from-medblue-50 to-white dark:from-medblue-900/20 dark:to-gray-800/80' 
                              : 'hover:ring-1 hover:ring-medblue-200'
                          }`}
                          onClick={() => setState(prev => ({ ...prev, method: 'konnect_gateway' }))}
                        >
                          <CardContent className="flex flex-col sm:flex-row sm:items-center p-4 sm:p-6 gap-3 sm:gap-4">
                            <div className="flex items-center gap-3 sm:gap-4 flex-1">
                              <div className="p-2.5 sm:p-3 bg-gradient-to-br from-medblue-500 to-medblue-600 rounded-lg sm:rounded-xl">
                                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                                  Paiement en ligne (Recommandé)
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Carte bancaire via Konnect - Activation instantanée
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 justify-between sm:justify-end">
                              <Badge className="bg-green-100 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 text-xs">
                                Instantané
                              </Badge>
                              {state.method === 'konnect_gateway' && (
                                <Check className="h-4 w-4 sm:h-5 sm:w-5 text-medblue-500" />
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Voucher Code */}
                        <Card 
                          className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
                            state.method === 'voucher_code' 
                              ? 'ring-2 ring-medblue-500 bg-gradient-to-r from-medblue-50 to-white dark:from-medblue-900/20 dark:to-gray-800/80' 
                              : 'hover:ring-1 hover:ring-medblue-200'
                          }`}
                          onClick={() => setState(prev => ({ ...prev, method: 'voucher_code' }))}
                        >
                          <CardContent className="flex flex-col sm:flex-row sm:items-center p-4 sm:p-6 gap-3 sm:gap-4">
                            <div className="flex items-center gap-3 sm:gap-4 flex-1">
                              <div className="p-2.5 sm:p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl">
                                <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                                  Code de bon
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  J'ai un code promo ou un bon d'achat
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 justify-between sm:justify-end">
                              <Badge className="bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800 text-xs">
                                Instantané
                              </Badge>
                              {state.method === 'voucher_code' && (
                                <Check className="h-4 w-4 sm:h-5 sm:w-5 text-medblue-500" />
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Custom Payment */}
                        <Card 
                          className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
                            state.method === 'custom_payment' 
                              ? 'ring-2 ring-medblue-500 bg-gradient-to-r from-medblue-50 to-white dark:from-medblue-900/20 dark:to-gray-800/80' 
                              : 'hover:ring-1 hover:ring-medblue-200'
                          }`}
                          onClick={() => setState(prev => ({ ...prev, method: 'custom_payment' }))}
                        >
                          <CardContent className="flex flex-col sm:flex-row sm:items-center p-4 sm:p-6 gap-3 sm:gap-4">
                            <div className="flex items-center gap-3 sm:gap-4 flex-1">
                              <div className="p-2.5 sm:p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg sm:rounded-xl">
                                <Banknote className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                                  Autre méthode de paiement
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Virement, espèces, D17 - Validation manuelle
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 justify-between sm:justify-end">
                              <Badge className="bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 text-xs">
                                24-48h
                              </Badge>
                              {state.method === 'custom_payment' && (
                                <Check className="h-4 w-4 sm:h-5 sm:w-5 text-medblue-500" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Payment Details */}
                  {currentStep === 'details' && (
                    <div className="space-y-6 sm:space-y-8">
                      <div className="text-center px-4">
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                          Détails du paiement
                        </h2>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                          {state.method === 'konnect_gateway' && 'Vous allez être redirigé vers la page de paiement sécurisée'}
                          {state.method === 'voucher_code' && 'Entrez votre code de bon ou code promo'}
                          {state.method === 'custom_payment' && 'Fournissez les détails de votre paiement'}
                        </p>
                      </div>

                      <div className="max-w-xl mx-auto px-3 sm:px-4">
                        {state.method === 'konnect_gateway' && (
                          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                            <CardContent className="p-4 sm:p-6">
                              <div className="text-center space-y-4">
                                <div className="p-3 sm:p-4 bg-medblue-50 dark:bg-medblue-900/20 rounded-xl border dark:border-medblue-800/30">
                                  <Shield className="h-10 w-10 sm:h-12 sm:w-12 text-medblue-600 dark:text-medblue-400 mx-auto mb-2 sm:mb-3" />
                                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-base sm:text-lg">
                                    Paiement sécurisé
                                  </h3>
                                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                                    Vous allez être redirigé vers Konnect pour finaliser votre paiement en toute sécurité.
                                  </p>
                                </div>

                                {/* Coupon Input */}
                                <div className="space-y-2">
                                  <Label htmlFor="coupon" className="text-sm text-gray-700 dark:text-gray-300">Code de réduction (optionnel)</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      id="coupon"
                                      value={state.couponCode}
                                      onChange={(e) => setState(prev => ({ 
                                        ...prev, 
                                        couponCode: e.target.value.toUpperCase(),
                                        couponError: null,
                                        couponDiscount: 0
                                      }))}
                                      placeholder="Entrez un code de réduction"
                                      className="text-center font-mono tracking-wider bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={handleApplyCoupon}
                                      disabled={!state.couponCode || state.isLoading}
                                      className="px-4"
                                    >
                                      {state.isLoading ? 'Vérification...' : 'Appliquer'}
                                    </Button>
                                  </div>
                                  {state.couponError && (
                                    <p className="text-sm text-red-600 dark:text-red-400">{state.couponError}</p>
                                  )}
                                  {state.couponDiscount > 0 && (
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                      Réduction appliquée: -{state.couponDiscount} {pricing.currency}
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-2 text-sm sm:text-base">
                                  <div className="flex justify-between items-center">
                                    <span className="text-left text-gray-900 dark:text-gray-100">Abonnement {state.subscriptionType === 'annual' ? 'annuel' : 'semestriel'}</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      {state.subscriptionType === 'annual' ? pricing.annual.finalPrice : pricing.semester.finalPrice} {pricing.currency}
                                    </span>
                                  </div>
                                  {pricing.isDiscountActive && (
                                    <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                                      <span className="text-left">Remise ({pricing.discountPercentage}%)</span>
                                      <span>
                                        -{state.subscriptionType === 'annual' ? pricing.annual.discountAmount : pricing.semester.discountAmount} {pricing.currency}
                                      </span>
                                    </div>
                                  )}
                                  {state.couponDiscount > 0 && (
                                    <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                                      <span className="text-left">Code de réduction</span>
                                      <span>-{state.couponDiscount} {pricing.currency}</span>
                                    </div>
                                  )}
                                  <div className="border-t pt-2 mt-2">
                                    <div className="flex justify-between items-center font-bold text-lg">
                                      <span className="text-left text-gray-900 dark:text-gray-100">Total à payer</span>
                                      <span className="text-medblue-600 dark:text-medblue-400">
                                        {Math.max(0, (state.subscriptionType === 'annual' ? pricing.annual.finalPrice : pricing.semester.finalPrice) - state.couponDiscount)} {pricing.currency}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {state.method === 'voucher_code' && (
                          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                            <CardContent className="p-4 sm:p-6 space-y-4">
                              <div className="p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center border dark:border-purple-800/30">
                                <Gift className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                                <h3 className="font-semibold text-gray-900 dark:text-white text-base sm:text-lg">
                                  Code de bon
                                </h3>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="voucher" className="text-sm sm:text-base text-gray-900 dark:text-gray-100">Code de bon ou promo</Label>
                                <Input
                                  id="voucher"
                                  value={state.voucherCode}
                                  onChange={(e) => setState(prev => ({ ...prev, voucherCode: e.target.value }))}
                                  placeholder="Entrez votre code ici"
                                  className="text-center text-base sm:text-lg font-mono tracking-wider py-3 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {state.method === 'custom_payment' && (
                          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mx-1 sm:mx-0">
                            <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
                              <div className="p-3 sm:p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border dark:border-orange-800/30">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-base sm:text-lg">
                                  <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                                  Informations de paiement
                                </h3>
                                <div className="space-y-3 text-xs sm:text-sm">
                                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
                                    <span className="text-gray-600 dark:text-gray-300 font-medium">RIB:</span>
                                    <span className="font-mono text-right sm:text-left break-all text-gray-900 dark:text-gray-100 text-xs leading-relaxed">
                                      {pricing.paymentDetails.ribNumber}
                                    </span>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
                                    <span className="text-gray-600 dark:text-gray-300 font-medium">D17:</span>
                                    <span className="font-mono text-right sm:text-left text-gray-900 dark:text-gray-100">
                                      {pricing.paymentDetails.d17PhoneNumber}
                                    </span>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 font-semibold pt-2 border-t border-orange-200 dark:border-orange-700">
                                    <span className="text-gray-900 dark:text-gray-100">Montant à payer:</span>
                                    <span className="text-medblue-600 dark:text-medblue-400 text-right sm:text-left text-lg">
                                      {state.subscriptionType === 'annual' ? pricing.annual.finalPrice : pricing.semester.finalPrice} {pricing.currency}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="payment-details" className="text-sm sm:text-base text-gray-900 dark:text-gray-100">Détails du paiement</Label>
                                <Textarea
                                  id="payment-details"
                                  value={state.customPaymentDetails}
                                  onChange={(e) => setState(prev => ({ ...prev, customPaymentDetails: e.target.value }))}
                                  placeholder="Ex: Virement effectué le DD/MM/YYYY, référence XXX"
                                  rows={3}
                                  className="text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                                />
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                  Précisez la méthode utilisée et toute information utile pour la vérification
                                </p>
                              </div>

                              <div className="space-y-4">
                                <Label className="text-sm font-medium">
                                  Justificatif de paiement <span className="text-red-500">*</span>
                                </Label>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  Veuillez téléverser une preuve de paiement (capture d'écran, reçu, etc.) pour valider votre paiement.
                                </p>
                                <div className="border-2 border-dashed border-medblue-300 dark:border-medblue-700 rounded-lg p-3 sm:p-6">
                                    <UploadDropzone
                                      endpoint="imageUploader"
                                      onClientUploadComplete={(res) => {
                                        if (res?.[0]) {
                                          setState(prev => ({
                                            ...prev,
                                            proofFileUrl: res[0].url,
                                            proofFileName: res[0].name
                                          }))
                                          toast({
                                            title: 'Succès',
                                            description: 'Justificatif téléversé avec succès',
                                            variant: 'default'
                                          })
                                        }
                                      }}
                                      onUploadError={(error) => {
                                        toast({
                                          title: 'Erreur',
                                          description: 'Erreur lors du téléversement',
                                          variant: 'destructive'
                                        })
                                      }}
                                      content={{
                                        label: "Glissez et déposez vos fichiers ici ou cliquez pour sélectionner",
                                        allowedContent: "Images (PNG, JPG, JPEG) jusqu'à 4MB",
                                        button: "Choisir des fichiers"
                                      }}
                                      appearance={{
                                        button: "ut-ready:bg-medblue-500 ut-ready:bg-opacity-100 ut-uploading:cursor-not-allowed ut-uploading:bg-medblue-500/50 ut-ready:px-4 ut-ready:py-2 ut-ready:rounded-lg ut-ready:text-white ut-ready:font-medium ut-ready:cursor-pointer",
                                        container: "border-medblue-300 dark:border-medblue-700"
                                      }}
                                    />
                                  </div>
                                  {state.proofFileName && (
                                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                                      <CheckCircle className="h-5 w-5 text-green-500" />
                                      <span className="text-sm text-green-700 dark:text-green-400">
                                        Fichier téléversé: {state.proofFileName}
                                      </span>
                                    </div>
                                  )}
                                </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 4: Confirmation */}
                  {currentStep === 'confirmation' && (
                    <div className="space-y-8">
                      <div className="text-center">
                        {state.status === 'completed' ? (
                          <div className="space-y-6">
                            {state.method === 'custom_payment' ? (
                              <>
                                <div className="relative inline-flex items-center justify-center">
                                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-yellow-500/30 rounded-full blur-xl animate-pulse"></div>
                                  <div className="relative p-6 bg-gradient-to-br from-orange-500 to-yellow-600 rounded-full shadow-2xl">
                                    <Clock className="h-16 w-16 text-white" />
                                  </div>
                                </div>
                                <div>
                                  <h2 className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-4">
                                    ⏳ Demande en attente
                                  </h2>
                                  <p className="text-xl text-gray-700 dark:text-gray-300 mb-6">
                                    Votre demande d'abonnement est en cours de validation par nos équipes
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="relative inline-flex items-center justify-center">
                                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/30 to-emerald-500/30 rounded-full blur-xl animate-pulse"></div>
                                  <div className="relative p-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-2xl">
                                    <CheckCircle className="h-16 w-16 text-white" />
                                  </div>
                                </div>
                                <div>
                                  <h2 className="text-4xl font-bold text-green-600 dark:text-green-400 mb-4">
                                    🎉 Félicitations !
                                  </h2>
                                  <p className="text-xl text-gray-700 dark:text-gray-300 mb-6">
                                    Votre abonnement premium a été activé avec succès
                                  </p>
                                </div>
                              </>
                            )}
                            {/* Show countdown only for non-custom payments */}
                            {state.method !== 'custom_payment' && countdown && (
                              <div className="bg-medblue-50 dark:bg-medblue-900/30 border border-medblue-200 dark:border-medblue-700 rounded-xl p-6">
                                <p className="text-medblue-700 dark:text-medblue-300">
                                  Redirection automatique vers le tableau de bord dans {countdown} secondes...
                                </p>
                                <Button
                                  onClick={() => router.push('/dashboard')}
                                  className="mt-4 bg-medblue-500 hover:bg-medblue-600 text-white"
                                >
                                  Aller au tableau de bord maintenant
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : state.status === 'awaiting_proof' ? (
                          <div className="space-y-6">
                            <div className="relative inline-flex items-center justify-center">
                              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-yellow-500/30 rounded-full blur-xl"></div>
                              <div className="relative p-6 bg-gradient-to-br from-orange-500 to-yellow-600 rounded-full shadow-2xl">
                                <Clock className="h-16 w-16 text-white" />
                              </div>
                            </div>
                            <div>
                              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                                En attente de validation
                              </h2>
                              <p className="text-gray-600 dark:text-gray-400 mb-6">
                                Votre paiement personnalisé est en cours de vérification par nos équipes
                              </p>
                              <Card className="max-w-lg mx-auto">
                                <CardContent className="p-6 text-center">
                                  <div className="space-y-4">
                                    <Clock className="h-16 w-16 text-medblue-600 mx-auto" />
                                    <div>
                                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        Validation en cours
                                      </h3>
                                      <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Nos équipes examinent votre paiement et les justificatifs fournis. 
                                        Vous recevrez une notification une fois la validation terminée.
                                      </p>
                                    </div>
                                    {state.proofFileName && (
                                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                        <span className="text-sm text-green-700 dark:text-green-400">
                                          Justificatif fourni: {state.proofFileName}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 sm:space-y-6 px-4">
                            <div className="text-center">
                              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                                Récapitulatif de commande
                              </h2>
                            </div>
                            <Card className="max-w-lg mx-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                              <CardHeader className="pb-3 sm:pb-4">
                                <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-900 dark:text-white">
                                  <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-medblue-600 dark:text-medblue-400" />
                                  MedQ Premium
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3 sm:space-y-4 text-sm sm:text-base">
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-900 dark:text-gray-100">Plan:</span>
                                  <span className="font-semibold capitalize text-gray-900 dark:text-white">
                                    {state.subscriptionType === 'annual' ? 'Annuel' : 'Semestriel'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-900 dark:text-gray-100">Méthode:</span>
                                  <span className="font-semibold text-right text-gray-900 dark:text-white">
                                    {state.method === 'konnect_gateway' && 'Carte bancaire'}
                                    {state.method === 'voucher_code' && 'Code de bon'}
                                    {state.method === 'custom_payment' && 'Paiement personnalisé'}
                                  </span>
                                </div>
                                {state.couponDiscount > 0 && (
                                  <>
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-900 dark:text-gray-100">Réduction:</span>
                                      <span className="font-semibold text-green-600 dark:text-green-400">
                                        -{state.couponDiscount} {pricing.currency}
                                      </span>
                                    </div>
                                    <hr className="border-gray-200 dark:border-gray-600" />
                                  </>
                                )}
                                <div className="flex justify-between items-center text-base sm:text-lg font-bold">
                                  <span className="text-gray-900 dark:text-gray-100">Total:</span>
                                  <span className="text-medblue-600 dark:text-medblue-400">
                                    {Math.max(0, (state.subscriptionType === 'annual' ? pricing.annual.finalPrice : pricing.semester.finalPrice) - state.couponDiscount)} {pricing.currency}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error Message - Centered */}
                  {currentStep === 'details' && state.method === 'custom_payment' && !canGoNext() && (
                    <div className="text-center pt-4 pb-2 px-4 sm:px-0">
                      <p className="text-sm text-red-500">
                        {!state.customPaymentDetails.trim() && !state.proofFileUrl && "Veuillez remplir les détails et téléverser une preuve de paiement"}
                        {state.customPaymentDetails.trim() && !state.proofFileUrl && "Veuillez téléverser une preuve de paiement pour continuer"}
                        {!state.customPaymentDetails.trim() && state.proofFileUrl && "Veuillez remplir les détails du paiement"}
                      </p>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  {(state.status !== 'completed' && state.status !== 'awaiting_proof') && (
                    <div className="flex justify-between items-center pt-6 sm:pt-8 mt-6 sm:mt-8 border-t border-medblue-100 dark:border-gray-700 px-4 sm:px-0">
                      <Button
                        variant="outline"
                        onClick={goBack}
                        disabled={currentStep === 'plan'}
                        className="flex items-center justify-center gap-2 py-3 sm:py-2 px-4"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="text-sm sm:text-base">Précédent</span>
                      </Button>
                      
                      {currentStep === 'confirmation' ? (
                        <Button
                          onClick={handleInitiatePayment}
                          disabled={state.isLoading}
                          className="bg-medblue-500 hover:bg-medblue-600 flex items-center justify-center gap-2 py-3 sm:py-2 px-4"
                        >
                          {state.isLoading ? (
                            <>
                              <RefreshCcw className="h-4 w-4 animate-spin" />
                              <span className="text-sm sm:text-base">Traitement...</span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm sm:text-base">Confirmer le paiement</span>
                              <CheckCircle className="h-4 w-4" />
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          onClick={goNext}
                          disabled={!canGoNext()}
                          className="bg-medblue-500 hover:bg-medblue-600 flex items-center justify-center gap-2 py-3 sm:py-2 px-4"
                        >
                          <span className="text-sm sm:text-base">Suivant</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </main>
          </SidebarInset>
        </div>
      </AppSidebarProvider>
    </ProtectedRoute>
  )
}
