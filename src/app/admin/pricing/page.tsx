'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'
import { 
  DollarSign, 
  Percent, 
  Calendar,
  CalendarDays,
  Save,
  AlertCircle,
  Eye,
  EyeOff,
  CreditCard,
  Phone
} from 'lucide-react'

interface PricingSettings {
  id: string
  semesterPrice: number
  annualPrice: number
  discountEnabled: boolean
  discountPercentage: number | null
  discountStartDate: string | null
  discountEndDate: string | null
  ribNumber: string | null
  d17PhoneNumber: string | null
  currency: string
  updatedAt: string
  updater: {
    id: string
    name: string | null
    email: string
  }
  isDiscountActive: boolean
  effectivePrices: {
    semester: {
      originalPrice: number
      finalPrice: number
      discountAmount: number
    }
    annual: {
      originalPrice: number
      finalPrice: number
      discountAmount: number
    }
  }
}

export default function AdminPricingPage() {
  const [settings, setSettings] = useState<PricingSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const [formData, setFormData] = useState({
    semesterPrice: 50,
    annualPrice: 120,
    discountEnabled: false,
    discountPercentage: 0,
    discountStartDate: '',
    discountEndDate: '',
    ribNumber: '1234567890',
    d17PhoneNumber: '+216 12 345 678',
    currency: 'TND'
  })

  const fetchPricingSettings = async () => {
    try {
      const response = await fetch('/api/admin/pricing')
      const data = await response.json()

      if (data.success) {
        setSettings(data.data)
        setFormData({
          semesterPrice: data.data.semesterPrice,
          annualPrice: data.data.annualPrice,
          discountEnabled: data.data.discountEnabled,
          discountPercentage: data.data.discountPercentage || 0,
          discountStartDate: data.data.discountStartDate ? 
            new Date(data.data.discountStartDate).toISOString().split('T')[0] : '',
          discountEndDate: data.data.discountEndDate ? 
            new Date(data.data.discountEndDate).toISOString().split('T')[0] : '',
          ribNumber: data.data.ribNumber || '1234567890',
          d17PhoneNumber: data.data.d17PhoneNumber || '+216 12 345 678',
          currency: data.data.currency
        })
      } else {
        toast({
          title: 'Erreur',
          description: data.error || 'Erreur lors du chargement des paramètres',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur de connexion',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Succès',
          description: 'Paramètres de prix mis à jour avec succès',
          variant: 'default'
        })
        await fetchPricingSettings() // Refresh data
      } else {
        toast({
          title: 'Erreur',
          description: data.error || 'Erreur lors de la mise à jour',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur de connexion',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate preview prices
  const calculatePreviewPrices = () => {
    const currentDate = new Date()
    const startDate = formData.discountStartDate ? new Date(formData.discountStartDate) : null
    const endDate = formData.discountEndDate ? new Date(formData.discountEndDate) : null
    
    const isDiscountActive = formData.discountEnabled &&
      formData.discountPercentage > 0 &&
      (!startDate || startDate <= currentDate) &&
      (!endDate || endDate >= currentDate)

    const discountMultiplier = isDiscountActive 
      ? (100 - formData.discountPercentage) / 100
      : 1

    return {
      semester: {
        originalPrice: formData.semesterPrice,
        finalPrice: Math.round(formData.semesterPrice * discountMultiplier * 100) / 100,
        discountAmount: isDiscountActive 
          ? Math.round(formData.semesterPrice * formData.discountPercentage / 100 * 100) / 100
          : 0
      },
      annual: {
        originalPrice: formData.annualPrice,
        finalPrice: Math.round(formData.annualPrice * discountMultiplier * 100) / 100,
        discountAmount: isDiscountActive 
          ? Math.round(formData.annualPrice * formData.discountPercentage / 100 * 100) / 100
          : 0
      },
      isDiscountActive
    }
  }

  const previewPrices = calculatePreviewPrices()

  useEffect(() => {
    fetchPricingSettings()
  }, [])

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Gestion des Prix
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Configurez les prix des abonnements et les remises
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
              className="gap-2"
            >
              {previewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {previewMode ? 'Masquer aperçu' : 'Aperçu'}
            </Button>
          </div>
        </div>

        {/* Current Settings Info */}
        {settings && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Dernière mise à jour :</strong> {new Date(settings.updatedAt).toLocaleString('fr-FR')} 
              par {settings.updater.name || settings.updater.email}
              {settings.isDiscountActive && (
                <span className="ml-4 text-green-600 font-medium">
                  • Remise active : {settings.discountPercentage}%
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Pricing Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Prix des Abonnements
              </CardTitle>
              <CardDescription>
                Définissez les prix pour chaque type d'abonnement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div>
                <Label htmlFor="semesterPrice">Prix Semestriel</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="semesterPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.semesterPrice}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      semesterPrice: parseFloat(e.target.value) || 0 
                    }))}
                  />
                  <span className="text-sm text-gray-500">{formData.currency}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="annualPrice">Prix Annuel</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="annualPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.annualPrice}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      annualPrice: parseFloat(e.target.value) || 0 
                    }))}
                  />
                  <span className="text-sm text-gray-500">{formData.currency}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="currency">Devise</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    currency: e.target.value 
                  }))}
                  placeholder="TND"
                />
              </div>

            </CardContent>
          </Card>

          {/* Discount Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Configuration des Remises
              </CardTitle>
              <CardDescription>
                Activez et configurez les remises temporaires
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="discountEnabled">Remise activée</Label>
                  <p className="text-sm text-gray-500">
                    Activer le système de remise
                  </p>
                </div>
                <Switch
                  id="discountEnabled"
                  checked={formData.discountEnabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ 
                    ...prev, 
                    discountEnabled: checked 
                  }))}
                />
              </div>

              {formData.discountEnabled && (
                <>
                  <div>
                    <Label htmlFor="discountPercentage">Pourcentage de remise</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        id="discountPercentage"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={formData.discountPercentage}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          discountPercentage: parseFloat(e.target.value) || 0 
                        }))}
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="discountStartDate">Date de début</Label>
                      <Input
                        id="discountStartDate"
                        type="date"
                        value={formData.discountStartDate}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          discountStartDate: e.target.value 
                        }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="discountEndDate">Date de fin</Label>
                      <Input
                        id="discountEndDate"
                        type="date"
                        value={formData.discountEndDate}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          discountEndDate: e.target.value 
                        }))}
                      />
                    </div>
                  </div>
                </>
              )}

            </CardContent>
          </Card>

        </div>

        {/* Payment Details Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Détails de Paiement
            </CardTitle>
            <CardDescription>
              Configurez les informations de paiement affichées aux utilisateurs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div>
              <Label htmlFor="ribNumber">Numéro RIB</Label>
              <Input
                id="ribNumber"
                value={formData.ribNumber}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  ribNumber: e.target.value 
                }))}
                placeholder="1234567890"
              />
              <p className="text-sm text-gray-500 mt-1">
                Numéro de compte bancaire pour les virements
              </p>
            </div>

            <div>
              <Label htmlFor="d17PhoneNumber" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Numéro D17
              </Label>
              <Input
                id="d17PhoneNumber"
                value={formData.d17PhoneNumber}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  d17PhoneNumber: e.target.value 
                }))}
                placeholder="+216 12 345 678"
              />
              <p className="text-sm text-gray-500 mt-1">
                Numéro de téléphone tunisien pour les paiements D17
              </p>
            </div>

          </CardContent>
        </Card>

        {/* Preview Prices */}
        {previewMode && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
            <CardHeader>
              <CardTitle className="text-blue-800 dark:text-blue-200">
                Aperçu des Prix
              </CardTitle>
              <CardDescription className="text-blue-600 dark:text-blue-400">
                Voici comment les prix apparaîtront aux utilisateurs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Semester Preview */}
                <div className="border rounded-lg p-4 bg-white dark:bg-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">Semestriel</span>
                    {previewPrices.isDiscountActive && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        -{formData.discountPercentage}%
                      </Badge>
                    )}
                  </div>
                  
                  {previewPrices.isDiscountActive ? (
                    <div>
                      <div className="text-sm text-gray-500 line-through">
                        {previewPrices.semester.originalPrice} {formData.currency}
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {previewPrices.semester.finalPrice} {formData.currency}
                      </div>
                      <div className="text-sm text-green-600">
                        Économisez {previewPrices.semester.discountAmount} {formData.currency}
                      </div>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-blue-600">
                      {previewPrices.semester.originalPrice} {formData.currency}
                    </div>
                  )}
                </div>

                {/* Annual Preview */}
                <div className="border rounded-lg p-4 bg-white dark:bg-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="h-4 w-4" />
                    <span className="font-medium">Annuel</span>
                    {previewPrices.isDiscountActive && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        -{formData.discountPercentage}%
                      </Badge>
                    )}
                  </div>
                  
                  {previewPrices.isDiscountActive ? (
                    <div>
                      <div className="text-sm text-gray-500 line-through">
                        {previewPrices.annual.originalPrice} {formData.currency}
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {previewPrices.annual.finalPrice} {formData.currency}
                      </div>
                      <div className="text-sm text-green-600">
                        Économisez {previewPrices.annual.discountAmount} {formData.currency}
                      </div>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-blue-600">
                      {previewPrices.annual.originalPrice} {formData.currency}
                    </div>
                  )}
                </div>

              </div>

              {previewPrices.isDiscountActive && (
                <Alert className="mt-4 border-green-200 bg-green-50">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Remise active :</strong> {formData.discountPercentage}% de réduction
                    {formData.discountStartDate && formData.discountEndDate && (
                      <span>
                        {' '}du {new Date(formData.discountStartDate).toLocaleDateString('fr-FR')}
                        {' '}au {new Date(formData.discountEndDate).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            size="lg"
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </div>

      </div>
    </AdminLayout>
  )
}
