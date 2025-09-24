'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Eye,
  Sparkles,
  Trophy,
  Users,
  Star,
  Shield,
  Zap,
  CheckCircle,
  XCircle,
  RefreshCcw,
  Clock,
  Home
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
  discountEndDate: string | null
  paymentDetails: {
    ribNumber: string
    d17PhoneNumber: string
  }
}

export default function PaymentPage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

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
    const paymentMethod = searchParams.get('method') // New parameter for payment method
    
    if (paymentStatus === 'success') {
      setState(prev => ({ ...prev, status: 'completed' }))
      
      // Determine success message based on payment method
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
      // Refresh user data to update subscription status
      refreshUser()
      
      // Start countdown for auto-redirect
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
    } else if (paymentStatus === 'error') {
      toast({
        title: "⚠️ Erreur technique",
        description: "Une erreur technique s'est produite lors du traitement de votre paiement. Veuillez contacter le support.",
        variant: "destructive"
      })
    }
  }, [searchParams, refreshUser, router])

  // Show loading while pricing is being fetched
  if (isPricingLoading || !pricing) {
    return (
      <ProtectedRoute>
        <AppSidebarProvider>
          <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col">
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
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <div className="flex items-center justify-center min-h-[500px]">
                    <div className="text-center">
                      <div className="relative mb-8">
                        <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                          <Crown className="h-10 w-10 text-white" />
                        </div>
                        <div className="absolute inset-0 w-20 h-20 mx-auto border-4 border-blue-200 dark:border-blue-800 rounded-full animate-spin border-t-transparent"></div>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Chargement des offres
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        Préparation de vos options d'abonnement...
                      </p>
                      <div className="flex justify-center mt-6">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
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
          // Voucher or custom payment completed
          setState(prev => ({ ...prev, status: 'completed' }))
          
          // Enhanced success message based on payment method
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
          // Refresh user data and start countdown for auto-redirect
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
        <div className="flex w-full h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 overflow-hidden">
          <AppSidebar />
          <SidebarInset className="flex flex-col h-full">
            <UniversalHeader
              title="MedQ Premium"
              rightActions={
                <Button
                  variant="ghost"
                  onClick={() => router.push('/dashboard')}
                  className="gap-2 hover:bg-white/20 text-gray-600 dark:text-gray-300 transition-all duration-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour au tableau de bord
                </Button>
              }
            />

            <main className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                
                {/* Modern Hero Section */}
                <div className="relative text-center mb-16">
                  {/* Background decoration */}
                  <div className="absolute inset-0 -z-10">
                    <div className="absolute top-10 left-10 w-32 h-32 bg-blue-200/30 dark:bg-blue-800/20 rounded-full blur-3xl"></div>
                    <div className="absolute top-32 right-20 w-40 h-40 bg-purple-200/30 dark:bg-purple-800/20 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-20 left-1/2 w-48 h-48 bg-indigo-200/30 dark:bg-indigo-800/20 rounded-full blur-3xl transform -translate-x-1/2"></div>
                  </div>
                  
                  {/* Crown icon with animated glow */}
                  <div className="relative inline-flex items-center justify-center mb-8">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-xl opacity-30 animate-pulse"></div>
                    <div className="relative p-6 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl shadow-2xl">
                      <Crown className="h-12 w-12 text-white" />
                    </div>
                  </div>

                  <h1 className="text-5xl md:text-7xl font-black mb-6">
                    <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                      MedQ
                    </span>
                    <br />
                    <span className="text-3xl md:text-5xl font-light text-gray-700 dark:text-gray-300">
                      Premium
                    </span>
                  </h1>
                  
                  <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
                    Transformez votre apprentissage médical avec un accès illimité aux contenus exclusifs
                  </p>

                  {/* Stats bar */}
                  <div className="flex flex-wrap justify-center gap-8 mb-12">
                    <div className="text-center">
                      <div className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">500+</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">QCM Premium</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-400">24/7</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Accès illimité</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl md:text-3xl font-bold text-indigo-600 dark:text-indigo-400">∞</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mises à jour</div>
                    </div>
                  </div>
                </div>

                {/* Promotional Banner - Show only when discount is active */}
                {pricing && pricing.isDiscountActive && !searchParams.get('payment') && state.status !== 'completed' && (
                  <div className="mb-12">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-500 via-orange-500 to-red-600 p-1 shadow-2xl">
                      <div className="relative bg-white dark:bg-gray-900 rounded-[22px] p-8 text-center">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-50/50 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/20 rounded-[22px]"></div>
                        <div className="relative">
                          <div className="flex items-center justify-center gap-3 mb-4">
                            <div className="text-4xl animate-bounce">🔥</div>
                            <h3 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                              PROMOTION EXCEPTIONNELLE
                            </h3>
                            <div className="text-4xl animate-bounce">⚡</div>
                          </div>
                          <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 font-semibold mb-2">
                            Profitez de <span className="text-red-600 font-black text-2xl">-{pricing.discountPercentage}%</span> sur tous nos abonnements !
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {pricing.discountEndDate ? (
                              <>
                                Offre limitée jusqu'au {new Date(pricing.discountEndDate).toLocaleDateString('fr-FR')} • 
                                Économisez jusqu'à {pricing.annual.discountAmount} {pricing.currency}
                              </>
                            ) : (
                              <>
                                Offre limitée • Économisez jusqu'à {pricing.annual.discountAmount} {pricing.currency} sur l'abonnement annuel
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modern Premium Features - Hide on success/failure */}
                {!searchParams.get('payment') && state.status !== 'completed' && (
                  <div className="mb-20">
                    <div className="text-center mb-12">
                      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                        Pourquoi choisir Premium ?
                      </h2>
                      <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Découvrez tous les avantages qui vous attendent avec MedQ Premium
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Feature 1 */}
                      <div className="group relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                        <div className="relative p-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-gray-700/30 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-all duration-500 group-hover:scale-105">
                          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-6 shadow-xl">
                            <Star className="h-8 w-8 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                            Contenu Exclusif
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            Plus de 500 QCM premium avec explications détaillées et références médicales
                          </p>
                        </div>
                      </div>

                      {/* Feature 2 */}
                      <div className="group relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                        <div className="relative p-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-gray-700/30 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-all duration-500 group-hover:scale-105">
                          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-6 shadow-xl">
                            <Shield className="h-8 w-8 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                            Analytics Avancées
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            Suivi détaillé de vos performances avec graphiques et recommandations personnalisées
                          </p>
                        </div>
                      </div>

                      {/* Feature 3 */}
                      <div className="group relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                        <div className="relative p-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-gray-700/30 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-all duration-500 group-hover:scale-105">
                          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mb-6 shadow-xl">
                            <Zap className="h-8 w-8 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                            Mises à Jour
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            Contenu médical actualisé régulièrement selon les dernières découvertes
                          </p>
                        </div>
                      </div>

                      {/* Feature 4 */}
                      <div className="group relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                        <div className="relative p-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-gray-700/30 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-all duration-500 group-hover:scale-105">
                          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mb-6 shadow-xl">
                            <Trophy className="h-8 w-8 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                            Support Priority
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            Assistance prioritaire et accès aux sessions de révision en live
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modern Subscription Plans - Hide on success/failure */}
                {!searchParams.get('payment') && state.status !== 'completed' && (
                  <div className="mb-16">
                    <div className="text-center mb-12">
                      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                        Choisissez votre plan Premium
                      </h2>
                      <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Débloquez l'accès complet à MedQ avec le plan qui correspond à vos besoins
                      </p>
                    </div>
                    
                    <div className="max-w-5xl mx-auto">
                      <RadioGroup
                        value={state.subscriptionType}
                        onValueChange={handleSubscriptionTypeChange}
                        className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                    >
                        {/* Semester Plan */}
                        <Label htmlFor="semester" className="relative group cursor-pointer">
                          {/* Discount Badge */}
                          {pricing.isDiscountActive && (
                            <div className="absolute -top-4 left-6 z-10">
                              <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-xl animate-pulse">
                                🔥 -{pricing.discountPercentage}% OFF
                              </div>
                            </div>
                          )}
                          
                          <div className={`relative overflow-hidden rounded-3xl border-2 transition-all duration-500 ${
                            state.subscriptionType === 'semester'
                              ? 'border-blue-500 shadow-2xl shadow-blue-500/25 scale-105'
                              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:shadow-xl hover:scale-102'
                          }`}>
                            {/* Background gradient */}
                            <div className={`absolute inset-0 transition-opacity duration-500 ${
                              state.subscriptionType === 'semester'
                                ? 'bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-blue-950 dark:via-gray-900 dark:to-blue-950 opacity-100'
                                : 'bg-white dark:bg-gray-800 group-hover:bg-gradient-to-br group-hover:from-blue-50/50 group-hover:via-white group-hover:to-blue-50/50 dark:group-hover:from-blue-950/30 dark:group-hover:via-gray-800 dark:group-hover:to-blue-950/30'
                            }`}></div>
                            
                            {/* Content */}
                            <div className="relative p-10">
                              <div className="flex justify-between items-start mb-8">
                                <div className="flex items-center gap-3">
                                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg">
                                    <Calendar className="h-6 w-6 text-white" />
                                  </div>
                                  <div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Semestriel</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Plan standard</p>
                                  </div>
                                </div>
                                <RadioGroupItem value="semester" id="semester" className="w-6 h-6" />
                              </div>
                              
                              <div className="mb-8">
                                <div className="flex items-baseline gap-2">
                                  {pricing.isDiscountActive ? (
                                    <>
                                      <span className="text-lg text-gray-500 line-through">
                                        {pricing.semester.originalPrice}
                                      </span>
                                      <span className="text-5xl font-black text-green-600 drop-shadow-lg">
                                        {pricing.semester.finalPrice}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-5xl font-black text-blue-600">
                                      {pricing.semester.finalPrice}
                                    </span>
                                  )}
                                  <span className="text-xl font-medium text-gray-600 dark:text-gray-400">
                                    {pricing.currency}
                                  </span>
                                </div>
                                <p className="text-gray-600 dark:text-gray-300 mt-2">
                                  pour {pricing.semester.duration}
                                </p>
                                
                                {/* Discount Savings Indicator */}
                                {pricing.isDiscountActive && (
                                  <div className="mt-3">
                                    <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-2 rounded-full text-sm font-semibold">
                                      <Sparkles className="w-4 h-4" />
                                      Économisez {pricing.semester.discountAmount} {pricing.currency}
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-blue-600" />
                                  </div>
                                  <span className="text-sm text-gray-600 dark:text-gray-300">Accès illimité aux QCM premium</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-blue-600" />
                                  </div>
                                  <span className="text-sm text-gray-600 dark:text-gray-300">Analytics détaillées</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-blue-600" />
                                  </div>
                                  <span className="text-sm text-gray-600 dark:text-gray-300">Support par email</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Label>

                        {/* Annual Plan */}
                        <Label htmlFor="annual" className="relative group cursor-pointer">
                          {/* Popular Badge or Discount Badge */}
                          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                            {pricing.isDiscountActive ? (
                              <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-xl animate-pulse">
                                🔥 SUPER PROMO -{pricing.discountPercentage}%
                              </div>
                            ) : (
                              <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-xl">
                                ⭐ Le plus populaire
                              </div>
                            )}
                          </div>
                          
                          <div className={`relative overflow-hidden rounded-3xl border-2 transition-all duration-500 ${
                            state.subscriptionType === 'annual'
                              ? 'border-purple-500 shadow-2xl shadow-purple-500/25 scale-105'
                              : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:shadow-xl hover:scale-102'
                          }`}>
                            {/* Background gradient */}
                            <div className={`absolute inset-0 transition-opacity duration-500 ${
                              state.subscriptionType === 'annual'
                                ? 'bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-purple-950 dark:via-gray-900 dark:to-indigo-950 opacity-100'
                                : 'bg-white dark:bg-gray-800 group-hover:bg-gradient-to-br group-hover:from-purple-50/50 group-hover:via-white group-hover:to-indigo-50/50 dark:group-hover:from-purple-950/30 dark:group-hover:via-gray-800 dark:group-hover:to-indigo-950/30'
                            }`}></div>
                            
                            {/* Accent decoration */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
                            
                            {/* Content */}
                            <div className="relative p-10 pt-12">
                              <div className="flex justify-between items-start mb-8">
                                <div className="flex items-center gap-3">
                                  <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg">
                                    <CalendarDays className="h-6 w-6 text-white" />
                                  </div>
                                  <div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Annuel</h3>
                                    <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Meilleur rapport qualité-prix</p>
                                  </div>
                                </div>
                                <RadioGroupItem value="annual" id="annual" className="w-6 h-6" />
                              </div>
                              
                              <div className="mb-6">
                                <div className="flex items-baseline gap-2 mb-2">
                                  {pricing.isDiscountActive ? (
                                    <>
                                      <span className="text-lg text-gray-500 line-through">
                                        {pricing.annual.originalPrice}
                                      </span>
                                      <span className="text-5xl font-black text-green-600 drop-shadow-lg">
                                        {pricing.annual.finalPrice}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-5xl font-black text-purple-600">
                                      {pricing.annual.finalPrice}
                                    </span>
                                  )}
                                  <span className="text-xl font-medium text-gray-600 dark:text-gray-400">
                                    {pricing.currency}
                                  </span>
                                </div>
                                <p className="text-gray-600 dark:text-gray-300 mb-3">
                                  pour {pricing.annual.duration}
                                </p>
                                <div className="space-y-2">
                                  {pricing.isDiscountActive ? (
                                    <>
                                      <div className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-4 py-2 rounded-full text-sm font-semibold">
                                        <Sparkles className="w-4 h-4" />
                                        PROMO: Économisez {pricing.annual.discountAmount} {pricing.currency}
                                      </div>
                                      <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-full text-sm font-semibold ml-2">
                                        💰 + {pricing.annual.savings} {pricing.currency} vs semestriel
                                      </div>
                                    </>
                                  ) : (
                                    <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-full text-sm font-semibold">
                                      <Sparkles className="w-4 h-4" />
                                      Économisez {pricing.annual.savings} {pricing.currency}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-purple-600" />
                                  </div>
                                  <span className="text-sm text-gray-600 dark:text-gray-300">Tout du plan semestriel</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-purple-600" />
                                  </div>
                                  <span className="text-sm text-gray-600 dark:text-gray-300">Sessions de révision en live</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-purple-600" />
                                  </div>
                                  <span className="text-sm text-gray-600 dark:text-gray-300">Support prioritaire 24/7</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-purple-600" />
                                  </div>
                                  <span className="text-sm text-gray-600 dark:text-gray-300">Accès anticipé aux nouvelles fonctionnalités</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Label>
                      </RadioGroup>
                    </div>
                  </div>
                )}

                {state.status === 'selecting' && !searchParams.get('payment') && (
                  <>
                    {/* Payment Methods */}
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
                        Choisissez votre méthode de paiement
                      </h2>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                        
                        {/* Konnect Gateway */}
                        <div 
                          className={`group cursor-pointer transition-all duration-300 ${
                            state.method === 'konnect_gateway' 
                              ? 'scale-105' 
                              : 'hover:scale-102'
                          }`}
                          onClick={() => handleMethodSelect('konnect_gateway')}
                        >
                          <Card className={`h-full border-2 transition-all duration-300 ${
                            state.method === 'konnect_gateway' 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-xl' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:shadow-lg'
                          }`}>
                            <CardHeader className="text-center pb-4">
                              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                                <CreditCard className="h-8 w-8 text-white" />
                              </div>
                              <CardTitle className="text-xl font-bold">Paiement en ligne</CardTitle>
                              <CardDescription className="text-base">
                                Carte bancaire via Konnect
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-3">
                                <li className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                    <Check className="h-3 w-3 text-green-600" />
                                  </div>
                                  <span className="text-sm">Paiement 100% sécurisé</span>
                                </li>
                                <li className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                    <Zap className="h-3 w-3 text-green-600" />
                                  </div>
                                  <span className="text-sm">Activation immédiate</span>
                                </li>
                                <li className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                    <Shield className="h-3 w-3 text-green-600" />
                                  </div>
                                  <span className="text-sm">Visa, Mastercard acceptées</span>
                                </li>
                              </ul>
                              <div className="mt-6">
                                <Badge className="w-full justify-center bg-blue-100 text-blue-800 hover:bg-blue-200">
                                  Recommandé
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Voucher Code */}
                        <div 
                          className={`group cursor-pointer transition-all duration-300 ${
                            state.method === 'voucher_code' 
                              ? 'scale-105' 
                              : 'hover:scale-102'
                          }`}
                          onClick={() => handleMethodSelect('voucher_code')}
                        >
                          <Card className={`h-full border-2 transition-all duration-300 ${
                            state.method === 'voucher_code' 
                              ? 'border-green-500 bg-green-50 dark:bg-green-950 shadow-xl' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-300 hover:shadow-lg'
                          }`}>
                            <CardHeader className="text-center pb-4">
                              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                                <Gift className="h-8 w-8 text-white" />
                              </div>
                              <CardTitle className="text-xl font-bold">Code de bon</CardTitle>
                              <CardDescription className="text-base">
                                Utilisez un code promotionnel
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-3">
                                <li className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                    <Zap className="h-3 w-3 text-green-600" />
                                  </div>
                                  <span className="text-sm">Activation instantanée</span>
                                </li>
                                <li className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                    <Star className="h-3 w-3 text-green-600" />
                                  </div>
                                  <span className="text-sm">Gratuit avec le code</span>
                                </li>
                                <li className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                    <Shield className="h-3 w-3 text-green-600" />
                                  </div>
                                  <span className="text-sm">Fourni par l'administration</span>
                                </li>
                              </ul>
                              <div className="mt-6">
                                <Badge variant="secondary" className="w-full justify-center">
                                  Code requis
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Custom Payment */}
                        <div 
                          className={`group cursor-pointer transition-all duration-300 ${
                            state.method === 'custom_payment' 
                              ? 'scale-105' 
                              : 'hover:scale-102'
                          }`}
                          onClick={() => handleMethodSelect('custom_payment')}
                        >
                          <Card className={`h-full border-2 transition-all duration-300 ${
                            state.method === 'custom_payment' 
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-950 shadow-xl' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 hover:shadow-lg'
                          }`}>
                            <CardHeader className="text-center pb-4">
                              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                                <Upload className="h-8 w-8 text-white" />
                              </div>
                              <CardTitle className="text-xl font-bold">Paiement personnalisé</CardTitle>
                              <CardDescription className="text-base">
                                Virement bancaire ou D17
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-3">
                                <li className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                                    <Clock className="h-3 w-3 text-orange-600" />
                                  </div>
                                  <span className="text-sm">Validation sous 24h</span>
                                </li>
                                <li className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                                    <Upload className="h-3 w-3 text-orange-600" />
                                  </div>
                                  <span className="text-sm">Justificatif requis</span>
                                </li>
                                <li className="flex items-center gap-3">
                                  <div className="w-5 h-5 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                                    <Shield className="h-3 w-3 text-orange-600" />
                                  </div>
                                  <span className="text-sm">Virement sécurisé</span>
                                </li>
                              </ul>
                              <div className="mt-6">
                                <Badge variant="outline" className="w-full justify-center border-orange-300 text-orange-700">
                                  Manuel
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>

                    {/* Payment Details Form - Enhanced */}
                    {state.method && (
                      <Card className="mb-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl">
                        <CardHeader className="text-center">
                          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                            {state.method === 'konnect_gateway' && <CreditCard className="h-6 w-6 text-blue-600" />}
                            {state.method === 'voucher_code' && <Gift className="h-6 w-6 text-green-600" />}
                            {state.method === 'custom_payment' && <Upload className="h-6 w-6 text-orange-600" />}
                            {(() => {
                              if (state.method === 'konnect_gateway') return 'Paiement sécurisé'
                              if (state.method === 'voucher_code') return 'Code de bon'
                              if (state.method === 'custom_payment') return 'Paiement personnalisé'
                              return 'Détails du paiement'
                            })()}
                          </CardTitle>
                          <CardDescription className="text-lg">
                            {(() => {
                              if (state.method === 'konnect_gateway') return 'Vous serez redirigé vers notre partenaire sécurisé Konnect'
                              if (state.method === 'voucher_code') return 'Entrez votre code promotionnel ci-dessous'
                              if (state.method === 'custom_payment') return 'Suivez les instructions pour effectuer votre paiement'
                              return ''
                            })()}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          
                          {/* Konnect Gateway Info */}
                          {state.method === 'konnect_gateway' && (
                            <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-2xl border border-blue-200 dark:border-blue-800">
                              <div className="flex justify-center mb-4">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                                  <Shield className="h-6 w-6 text-blue-600" />
                                </div>
                              </div>
                              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Paiement 100% sécurisé</h3>
                              <p className="text-blue-700 dark:text-blue-300 text-sm mb-4">
                                Montant : <span className="font-bold text-lg">{pricing[state.subscriptionType].finalPrice} {pricing.currency}</span>
                              </p>
                              <p className="text-blue-600 dark:text-blue-400 text-sm">
                                Vos données bancaires sont protégées par le cryptage SSL et ne transitent jamais par nos serveurs.
                              </p>
                            </div>
                          )}

                          {/* Voucher Code Input */}
                          {state.method === 'voucher_code' && (
                            <div className="space-y-4">
                              <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-2xl border border-green-200 dark:border-green-800">
                                <Gift className="h-12 w-12 text-green-600 mx-auto mb-3" />
                                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Code promotionnel</h3>
                                <p className="text-green-700 dark:text-green-300 text-sm">
                                  Entrez le code fourni par l'administration pour activer votre abonnement gratuitement.
                                </p>
                              </div>
                              <div>
                                <Label htmlFor="voucherCode" className="text-lg font-semibold">Code de bon</Label>
                                <Input
                                  id="voucherCode"
                                  placeholder="Entrez votre code de bon (ex: MEDQ-X-XXXXXX)"
                                  value={state.voucherCode}
                                  onChange={(e) => setState(prev => ({ 
                                    ...prev, 
                                    voucherCode: e.target.value.toUpperCase() 
                                  }))}
                                  className="text-center text-xl font-mono tracking-wider h-14 text-gray-900 dark:text-white"
                                />
                              </div>
                            </div>
                          )}

                          {/* Custom Payment Instructions */}
                          {state.method === 'custom_payment' && (
                            <div className="space-y-6">
                              <Alert className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950">
                                <AlertCircle className="h-5 w-5 text-orange-600" />
                                <AlertDescription className="text-orange-800 dark:text-orange-200">
                                  <div className="font-semibold mb-3 text-lg">Instructions de paiement :</div>
                                  <div className="space-y-2 text-sm">
                                    <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                                      <strong>💳 Virement bancaire :</strong> RIB {pricing.paymentDetails.ribNumber}
                                    </div>
                                    <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                                      <strong>📱 D17 :</strong> {pricing.paymentDetails.d17PhoneNumber}
                                    </div>
                                    <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                                      <strong>💰 Montant :</strong> <span className="text-xl font-bold">{pricing[state.subscriptionType].finalPrice} {pricing.currency}</span>
                                    </div>
                                    <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                                      <strong>📧 Référence :</strong> Votre email d'inscription
                                    </div>
                                  </div>
                                </AlertDescription>
                              </Alert>
                              
                              <div>
                                <Label htmlFor="paymentDetails" className="text-lg font-semibold">Détails de votre paiement</Label>
                                <Textarea
                                  id="paymentDetails"
                                  placeholder="Décrivez votre méthode de paiement...
Exemple : 
- Virement bancaire effectué le [date]
- Numéro de transaction : [numéro]
- Montant : [montant] TND
- Depuis le compte : [vos initiales]"
                                  value={state.customPaymentDetails}
                                  onChange={(e) => setState(prev => ({ 
                                    ...prev, 
                                    customPaymentDetails: e.target.value 
                                  }))}
                                  rows={5}
                                  className="text-base"
                                />
                              </div>
                            </div>
                          )}

                          {/* Action Button */}
                          <Button
                            onClick={handleInitiatePayment}
                            disabled={state.isLoading}
                            size="lg"
                            className={`w-full h-14 text-lg font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg ${
                              state.method === 'konnect_gateway' 
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white' 
                                : state.method === 'voucher_code'
                                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                                : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white'
                            }`}
                          >
                            {state.isLoading ? (
                              <div className="flex items-center gap-2">
                                <RefreshCcw className="h-5 w-5 animate-spin" />
                                Traitement en cours...
                              </div>
                            ) : (
                              <>
                                {state.method === 'konnect_gateway' && (
                                  <>
                                    <CreditCard className="h-5 w-5 mr-2" />
                                    Payer {pricing[state.subscriptionType].finalPrice} {pricing.currency}
                                  </>
                                )}
                                {state.method === 'voucher_code' && (
                                  <>
                                    <Gift className="h-5 w-5 mr-2" />
                                    Utiliser le code de bon
                                  </>
                                )}
                                {state.method === 'custom_payment' && (
                                  <>
                                    <Upload className="h-5 w-5 mr-2" />
                                    Enregistrer le paiement
                                  </>
                                )}
                              </>
                            )}
                          </Button>

                          {/* Trust Indicators */}
                          <div className="text-center pt-4">
                            <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <Shield className="h-4 w-4" />
                                Sécurisé
                              </div>
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                                Vérifié
                              </div>
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4" />
                                Fiable
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Proof Upload Form - Enhanced */}
                {state.status === 'awaiting_proof' && (
                  <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl">
                    <CardHeader className="text-center">
                      {/* Back Button */}
                      <div className="flex justify-start mb-4">
                        <Button
                          variant="outline"
                          onClick={() => setState(prev => ({ 
                            ...prev, 
                            status: 'selecting',
                            method: null,
                            paymentId: null,
                            paymentUrl: null,
                            requiresProof: false,
                            proofFileUrl: null,
                            proofFileName: null
                          }))}
                          className="gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Choisir une autre méthode
                        </Button>
                      </div>
                      
                      <div className="flex justify-center mb-4">
                        <div className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full shadow-lg">
                          <Upload className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      <CardTitle className="text-2xl font-bold">Téléverser le justificatif</CardTitle>
                      <CardDescription className="text-lg">
                        Veuillez joindre une photo ou un PDF de votre justificatif de paiement
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      
                      {/* Instructions */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                          <Eye className="h-5 w-5" />
                          Types de justificatifs acceptés
                        </h3>
                        <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-2">
                          <li>• Screenshot de votre application bancaire</li>
                          <li>• Photo du reçu de virement</li>
                          <li>• Capture d'écran D17</li>
                          <li>• Reçu de paiement (PDF ou image)</li>
                        </ul>
                      </div>

                      <div>
                        <Label className="text-lg font-semibold">Justificatif de paiement</Label>
                        
                        {state.isUploading && (
                          <div className="mb-4">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4">
                              <div className="flex items-center justify-center gap-3">
                                <RefreshCcw className="h-6 w-6 text-blue-600 animate-spin" />
                                <span className="text-blue-800 dark:text-blue-200 font-medium">Téléversement en cours...</span>
                              </div>
                              <div className="mt-2 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 transition-all hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/50">
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
                                  title: 'Fichier téléversé !',
                                  description: 'Votre justificatif a été téléversé avec succès',
                                  variant: 'default'
                                })
                              }
                            }}
                            onUploadError={(error: Error) => {
                              console.error("Upload error:", error);
                              setState(prev => ({ ...prev, isUploading: false }))
                              toast({
                                title: 'Erreur de téléversement',
                                description: error.message || 'Une erreur est survenue lors du téléversement',
                                variant: 'destructive'
                              })
                            }}
                            onUploadBegin={(name: string) => {
                              console.log("Upload beginning for:", name);
                              setState(prev => ({ ...prev, isUploading: true }))
                              toast({
                                title: 'Téléversement démarré',
                                description: `Téléversement de ${name}...`,
                                variant: 'default'
                              })
                            }}
                          />
                        </div>
                        
                        {state.proofFileUrl && (
                          <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-2 border-green-200 dark:border-green-800 rounded-xl">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                  <CheckCircle className="h-6 w-6 text-green-600" />
                                </div>
                                <div>
                                  <p className="font-semibold text-green-800 dark:text-green-200">
                                    {state.proofFileName || 'Fichier téléversé'}
                                  </p>
                                  <p className="text-sm text-green-600 dark:text-green-400">
                                    Prêt pour vérification par nos équipes
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-950"
                              >
                                <a href={state.proofFileUrl} target="_blank" rel="noopener noreferrer">
                                  <Eye className="h-4 w-4 mr-1" />
                                  Voir
                                </a>
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Submit Button */}
                      <Button
                        onClick={handleProofUpload}
                        disabled={state.isLoading || !state.proofFileUrl}
                        size="lg"
                        className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        {state.isLoading ? (
                          <div className="flex items-center gap-2">
                            <RefreshCcw className="h-5 w-5 animate-spin" />
                            Enregistrement en cours...
                          </div>
                        ) : (
                          <>
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Confirmer le justificatif
                          </>
                        )}
                      </Button>

                      {/* Help text */}
                      <div className="text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Votre justificatif sera vérifié sous 24h ouvrées. 
                          Vous recevrez un email de confirmation une fois votre abonnement activé.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Success/Failure Messages - Completely Redesigned */}
                {state.status === 'completed' && (
                  <div className="flex justify-center">
                    <Card className="max-w-2xl w-full shadow-2xl border-0 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950 dark:via-emerald-950 dark:to-teal-950 overflow-hidden">
                      <CardContent className="p-0">
                        {/* Success Animation Area */}
                        <div className="relative bg-gradient-to-r from-green-500 to-emerald-500 p-8 text-center">
                          <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 opacity-20 animate-pulse"></div>
                          <div className="relative">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                              <CheckCircle className="h-12 w-12 text-white" />
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-2">
                              {(() => {
                                const urlMethod = searchParams.get('method')
                                const displayMethod = urlMethod || state.method
                                
                                if (displayMethod === 'voucher_code') return 'Code de bon validé !'
                                if (displayMethod === 'custom_payment') return 'Paiement enregistré !'
                                return 'Paiement réussi !'
                              })()}
                            </h3>
                            <p className="text-green-100 text-lg">
                              Bienvenue dans MedQ Premium !
                            </p>
                          </div>
                        </div>
                        
                        {/* Content Area */}
                        <div className="p-8">
                          <div className="text-center mb-8">
                            <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                              {(() => {
                                const urlMethod = searchParams.get('method')
                                const displayMethod = urlMethod || state.method
                                
                                if (displayMethod === 'voucher_code') {
                                  return 'Votre code de bon a été appliqué avec succès. Votre abonnement premium est maintenant actif et vous avez accès à tous les contenus exclusifs.'
                                }
                                if (displayMethod === 'custom_payment') {
                                  return 'Votre demande de paiement personnalisé a été enregistrée. Nous la vérifierons sous 24h et vous recevrez une confirmation par email.'
                                }
                                return 'Votre paiement a été traité avec succès ! Votre abonnement premium est maintenant actif et vous pouvez profiter de tous nos contenus exclusifs.'
                              })()}
                            </p>
                          </div>

                          {/* Premium Benefits Reminder */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-xl">
                              <Star className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Contenu exclusif</p>
                            </div>
                            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-xl">
                              <Trophy className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                              <p className="text-sm font-medium text-purple-900 dark:text-purple-100">Statistiques avancées</p>
                            </div>
                            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-xl">
                              <Zap className="h-8 w-8 text-green-600 mx-auto mb-2" />
                              <p className="text-sm font-medium text-green-900 dark:text-green-100">Mises à jour</p>
                            </div>
                          </div>
                          
                          {/* Auto-redirect notice for all success cases */}
                          {countdown && (
                            <div className="mb-6 p-4 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 border border-blue-200 dark:border-blue-800 rounded-xl">
                              <div className="flex items-center justify-center gap-2">
                                <RefreshCcw className="h-4 w-4 text-blue-600 animate-spin" />
                                <p className="text-blue-800 dark:text-blue-200 font-medium">
                                  Redirection automatique dans <span className="font-bold text-2xl bg-blue-600 text-white px-2 py-1 rounded">{countdown}</span> seconde{countdown > 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {/* Action Buttons */}
                          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 justify-center">
                            <Button 
                              onClick={() => router.push('/dashboard')}
                              size="lg"
                              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg text-base sm:text-lg"
                            >
                              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                              Commencer maintenant
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => router.push('/profile')}
                              size="lg"
                              className="border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 font-semibold text-base sm:text-lg"
                            >
                              <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                              Mon profil
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
                
                {/* Payment Failure Message */}
                {searchParams.get('payment') === 'failed' && (
                  <div className="flex justify-center">
                    <Card className="max-w-2xl w-full shadow-2xl border-0 bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 dark:from-red-950 dark:via-rose-950 dark:to-pink-950 overflow-hidden">
                      <CardContent className="p-0">
                        {/* Error Header */}
                        <div className="relative bg-gradient-to-r from-red-500 to-rose-500 p-8 text-center">
                          <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-rose-400 opacity-20 animate-pulse"></div>
                          <div className="relative">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                              <XCircle className="h-12 w-12 text-white" />
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-2">
                              Paiement échoué
                            </h3>
                            <p className="text-red-100 text-lg">
                              Une erreur est survenue
                            </p>
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-8 text-center">
                          <p className="text-gray-700 dark:text-gray-300 text-lg mb-6 leading-relaxed">
                            Le paiement n'a pas pu être traité. Cela peut être dû à un problème temporaire avec votre banque ou notre système de paiement.
                          </p>
                          
                          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
                            <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Que faire maintenant ?</h4>
                            <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 text-left">
                              <li>• Vérifiez les détails de votre carte bancaire</li>
                              <li>• Assurez-vous d'avoir suffisamment de fonds</li>
                              <li>• Essayez une autre méthode de paiement</li>
                              <li>• Contactez notre support si le problème persiste</li>
                            </ul>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button 
                              onClick={() => window.location.reload()}
                              size="lg"
                              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg text-lg"
                            >
                              <RefreshCcw className="h-5 w-5 mr-2" />
                              Réessayer
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => router.push('/dashboard')}
                              size="lg"
                              className="border-2 border-gray-300 hover:border-gray-400 py-4 px-8 rounded-xl transition-all duration-300 font-semibold text-lg"
                            >
                              <Home className="h-5 w-5 mr-2" />
                              Retour au tableau de bord
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Payment Error Message */}
                {searchParams.get('payment') === 'error' && (
                  <div className="flex justify-center">
                    <Card className="max-w-2xl w-full shadow-2xl border-0 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950 dark:via-amber-950 dark:to-yellow-950 overflow-hidden">
                      <CardContent className="p-0">
                        {/* Error Header */}
                        <div className="relative bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-center">
                          <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 opacity-20 animate-pulse"></div>
                          <div className="relative">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                              <AlertCircle className="h-12 w-12 text-white" />
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-2">
                              Erreur technique
                            </h3>
                            <p className="text-orange-100 text-lg">
                              Un problème inattendu s'est produit
                            </p>
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-8 text-center">
                          <p className="text-gray-700 dark:text-gray-300 text-lg mb-6 leading-relaxed">
                            Une erreur technique s'est produite lors du traitement de votre paiement. Nos équipes ont été notifiées automatiquement.
                          </p>
                          
                          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
                            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Prochaines étapes</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Si votre carte a été débitée, n'effectuez pas de nouveau paiement. 
                              Contactez notre support qui pourra vérifier le statut de votre transaction.
                            </p>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button 
                              onClick={() => router.push('/dashboard')}
                              size="lg"
                              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg text-lg"
                            >
                              <Home className="h-5 w-5 mr-2" />
                              Retour au tableau de bord
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => window.location.href = 'mailto:support@medq.com'}
                              size="lg"
                              className="border-2 border-gray-300 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950 py-4 px-8 rounded-xl transition-all duration-300 font-semibold text-lg"
                            >
                              <AlertCircle className="h-5 w-5 mr-2" />
                              Contacter le support
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

              </div>
            </main>
          </SidebarInset>
        </div>
      </AppSidebarProvider>
    </ProtectedRoute>
  )
}
