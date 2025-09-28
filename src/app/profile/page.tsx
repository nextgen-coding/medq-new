'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UniversalHeader } from '@/components/layout/UniversalHeader';
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from 'react-i18next'
import { User, Mail, GraduationCap, Calendar, Shield, Crown, Clock, Camera, Save, Eye, EyeOff, Lock, Settings, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ProfileCompletionGuard } from '@/components/ProfileCompletionGuard'

export default function ProfilePageRoute() {
  const { user, refreshUser, updateUser } = useAuth();
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false)
  // Editable profile state
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    niveauId: user?.niveauId || user?.niveau?.id || '',
    image: user?.image || '',
    faculty: user?.faculty || 'FMSF',
    sexe: user?.sexe || 'M',
    highlightColor: (user as any)?.highlightColor || '#ffe066', // default yellow
    showSelfAssessment: (user as any)?.showSelfAssessment ?? true, // default to true
  })

  // Only render after client hydration to avoid SSR mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Always fetch fresh user data when the profile page loads
  useEffect(() => {
    if (isClient) {
      refreshUser();
    }
  }, [isClient, refreshUser]);

  // Niveaux state
  const [niveaux, setNiveaux] = useState<{ id: string; name: string }[]>([])

  // Level change request state
  const [pendingLevelRequest, setPendingLevelRequest] = useState<any>(null)
  const [showLevelChangeRequest, setShowLevelChangeRequest] = useState(false)
  const [levelChangeReason, setLevelChangeReason] = useState('')

  // Fetch niveaux from backend
  useEffect(() => {
    fetch('/api/niveaux')
      .then(res => res.json())
      .then(data => {
        setNiveaux(data)
        // If user has no niveauId, set to first niveau's id
        setProfile(prev => ({ ...prev, niveauId: prev.niveauId || (data[0]?.id || '') }))
      })
      .catch(() => setNiveaux([]))
  }, [])

  // Fetch pending level change request
  useEffect(() => {
    fetch('/api/level-change-requests?status=pending')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setPendingLevelRequest(data[0]) // Get the first pending request
        }
      })
      .catch(console.error)
  }, [])

  // Update form fields when user changes (after login/refresh)
  useEffect(() => {
    if (user) {
      setProfile({
        name: user?.name || '',
        email: user?.email || '',
        niveauId: user?.niveauId || user?.niveau?.id || '',
        image: user?.image || '',
        faculty: user?.faculty || 'FMSF',
        sexe: user?.sexe || 'M',
        highlightColor: (user as any)?.highlightColor || '#ffe066',
        showSelfAssessment: (user as any)?.showSelfAssessment !== undefined ? (user as any)?.showSelfAssessment : true,
      })
    }
  }, [user])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })

  if (!isClient) return null;

  const handlePasswordChange = async () => {
    try {
      // Client-side password validation
      if (passwordData.newPassword.length < 8) {
        toast({ title: 'Erreur', description: 'Le mot de passe doit contenir au moins 8 caractères.', variant: 'destructive' });
        return;
      }
      if (!/[A-Z]/.test(passwordData.newPassword)) {
        toast({ title: 'Erreur', description: 'Le mot de passe doit contenir au moins une lettre majuscule.', variant: 'destructive' });
        return;
      }
      if (!/[a-z]/.test(passwordData.newPassword)) {
        toast({ title: 'Erreur', description: 'Le mot de passe doit contenir au moins une lettre minuscule.', variant: 'destructive' });
        return;
      }
      // Send currentPassword if user has an existing password, regardless of Google status
      const payload = user?.password
        ? { currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword }
        : { newPassword: passwordData.newPassword };
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errorData = await res.json();
        toast({ title: 'Erreur', description: errorData.error || 'Impossible de changer le mot de passe', variant: 'destructive' });
        return;
      }
      toast({ title: 'Succès', description: user?.password ? 'Mot de passe mis à jour' : 'Mot de passe défini', variant: 'default' })
      setShowChangePassword(false)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      // Refresh user context so UI updates to require current password next time
      if (refreshUser) await refreshUser();
    } catch (e) {
      toast({ title: 'Erreur', description: 'Impossible de changer le mot de passe', variant: 'destructive' })
    }
  }

  const handleProfileSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          niveau: undefined // remove niveau if present
        }),
      })
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde du profil')
      const data = await res.json();
      toast({ title: 'Succès', description: 'Profil mis à jour', variant: 'default' })
      if (data.user && updateUser) updateUser(data.user);
      refreshUser && refreshUser()
    } catch (e) {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder le profil', variant: 'destructive' })
    }
    setIsSaving(false)
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      // Optimistically update UI
      const tempUrl = URL.createObjectURL(file)
      setProfile(prev => ({ ...prev, image: tempUrl }))
      // Upload image
      const res = await fetch('/api/upload/image', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Erreur lors du téléversement de la photo')
      const data = await res.json()
      setProfile(prev => ({ ...prev, image: data.url }))
      // Update image in DB
      const saveRes = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          niveauId: profile.niveauId,
          sexe: profile.sexe,
          faculty: profile.faculty,
          image: data.url,
        }),
      })
      if (!saveRes.ok) throw new Error('Erreur lors de la sauvegarde de la photo')
      // Optionally update user context immediately
      if (refreshUser) refreshUser()
      toast({ title: 'Succès', description: 'Photo de profil mise à jour', variant: 'default' })
    } catch (e) {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour la photo', variant: 'destructive' })
    }
    setIsUploading(false)
  }

  const handleLevelChangeRequest = async (newLevelId: string) => {
    if (newLevelId === user?.niveauId) return // No change needed
    
    try {
      const res = await fetch('/api/level-change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedLevelId: newLevelId,
          reason: levelChangeReason || undefined,
        }),
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erreur lors de la création de la demande')
      }
      
      const newRequest = await res.json()
      setPendingLevelRequest(newRequest)
      setShowLevelChangeRequest(false)
      setLevelChangeReason('')
      
      toast({ 
        title: 'Demande envoyée', 
        description: 'Votre demande de changement de niveau a été envoyée aux administrateurs.', 
        variant: 'default' 
      })
    } catch (error: any) {
      toast({ 
        title: 'Erreur', 
        description: error.message || 'Impossible d\'envoyer la demande', 
        variant: 'destructive' 
      })
    }
  }

  return (
    <ProtectedRoute>
      <ProfileCompletionGuard>
        <AppSidebarProvider>
          <div className="flex w-full h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <AppSidebar />
            <SidebarInset className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
              {/* Universal Header */}
              <UniversalHeader
                title="Profil"
                rightActions={
                  <Button
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    onClick={handleProfileSave}
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                }
              />

              {/* Main Content */}
              <main className="flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
                  {/* Header Section */}
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Mon Profil</h1>
                    <p className="text-gray-600 dark:text-gray-400">Gérez vos informations personnelles et vos préférences</p>
                  </div>

                  <div className="grid gap-8 lg:grid-cols-3 pb-8">
                    {/* Left Column: Profile Overview + Subscription */}
                    <div className="lg:col-span-1 flex flex-col gap-8">
                      {/* Profile Overview Card */}
                      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
                        <CardContent className="p-6">
                          <div className="text-center">
                            {/* Enhanced Avatar Section */}
                            <div className="relative mb-6">
                              <div className="relative inline-block">
                                <Avatar className="h-24 w-24 ring-4 ring-white dark:ring-gray-700 shadow-2xl">
                                  <AvatarImage src={profile.image} alt={profile.name || profile.email} />
                                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-bold">
                                    {profile.name?.charAt(0) || profile.email?.charAt(0) || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-2 -right-2">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={handleImageChange}
                                  />
                                  <Button
                                    size="sm"
                                    className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg p-0"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                  >
                                    {isUploading ? (
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    ) : (
                                      <Camera className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Cliquez pour changer la photo</p>
                            </div>

                            {/* User Info */}
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                              {profile.name || 'Utilisateur'}
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">{profile.email}</p>

                            {/* Role Badge */}
                            <div className="flex justify-center mb-4">
                              <Badge className={`px-3 py-1 text-sm font-medium ${
                                user?.role === 'admin'
                                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                  : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                              }`}>
                                {user?.role === 'admin' ? 'Administrateur' : 'Étudiant'}
                              </Badge>
                            </div>

                            {/* Subscription Status */}
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                              <div className="flex items-center justify-center space-x-2">
                                <Crown className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                                  {user?.hasActiveSubscription ? 'Plan Pro Actif' : 'Plan Gratuit'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Subscription Card */}
                      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-yellow-100 dark:bg-yellow-900/40">
                                <Crown className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Abonnement</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{user?.hasActiveSubscription ? 'Plan Premium' : 'Plan Gratuit'}</p>
                              </div>
                            </div>
                            <Badge variant={user?.hasActiveSubscription ? "default" : "secondary"} className="shrink-0">
                              {user?.hasActiveSubscription ? 'Pro' : 'Free'}
                            </Badge>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${user?.hasActiveSubscription ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                <span className={`text-sm font-semibold ${
                                  user?.hasActiveSubscription ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                  {user?.hasActiveSubscription ? 'Actif' : 'Inactif'}
                                </span>
                              </div>
                            </div>
                            
                            {user?.hasActiveSubscription && user?.subscriptionExpiresAt && (
                              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Expire le</span>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-gray-500" />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {new Date(user.subscriptionExpiresAt).toLocaleDateString('fr-FR', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {!user?.hasActiveSubscription && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <Button 
                                onClick={() => window.location.href = '/upgrade'}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                                size="sm"
                              >
                                <Crown className="h-4 w-4 mr-2" />
                                Upgrader vers Pro
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                    </div>

                    {/* Main Content Cards */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Personal Information */}
                      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                            <User className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                            Informations Personnelles
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid gap-6 md:grid-cols-2">
                            {/* Name */}
                            <div className="space-y-2">
                              <Label htmlFor="username" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Nom complet
                              </Label>
                              <Input
                                id="username"
                                value={profile.name}
                                onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                                className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                                placeholder="Votre nom complet"
                              />
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Adresse email
                              </Label>
                              <Input
                                id="email"
                                type="email"
                                value={profile.email}
                                readOnly
                                className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed transition-all duration-200"
                                placeholder="votre.email@exemple.com"
                              />
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                L'adresse email ne peut pas être modifiée
                              </p>
                            </div>

                            {/* Faculty */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Faculté
                              </Label>
                              <Select value={profile.faculty} onValueChange={val => setProfile(prev => ({ ...prev, faculty: val }))}>
                                <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200">
                                  <SelectValue placeholder="Sélectionnez votre faculté" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600">
                                  <SelectItem value="FMT">Faculté de Médecine de Tunis F.M.T.</SelectItem>
                                  <SelectItem value="FMS">Faculté de Médecine de Sfax F.M.S.</SelectItem>
                                  <SelectItem value="FMM">Faculté de Médecine de Monastir F.M.M.</SelectItem>
                                  <SelectItem value="FMSf">Faculté de Médecine de Sousse F.M.So.</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Level */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Niveau d'études
                              </Label>
                              
                              {/* Current Level Display */}
                              <div className="flex items-center justify-between h-10 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md transition-all duration-200">
                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                  <GraduationCap className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900 dark:text-white truncate">
                                      {niveaux.find(n => n.id === user?.niveauId)?.name || 'Niveau non défini'}
                                    </p>
                                    {pendingLevelRequest && (
                                      <div className="flex items-center space-x-2 mt-0.5">
                                        <AlertCircle className="h-3 w-3 text-orange-500 flex-shrink-0" />
                                        <p className="text-xs text-orange-600 dark:text-orange-400 truncate">
                                          En cours: {niveaux.find(n => n.id === pendingLevelRequest.requestedLevelId)?.name}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {!pendingLevelRequest && (
                                  <Dialog open={showLevelChangeRequest} onOpenChange={setShowLevelChangeRequest}>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                      >
                                        <Settings className="h-3 w-3 mr-1" />
                                        Modifier
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Demande de changement de niveau</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div>
                                          <Label className="text-sm font-medium">Nouveau niveau souhaité</Label>
                                          <Select value={profile.niveauId} onValueChange={val => setProfile(prev => ({ ...prev, niveauId: val }))}>
                                            <SelectTrigger className="mt-1">
                                              <SelectValue placeholder="Sélectionnez le nouveau niveau" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {niveaux.map(niv => (
                                                <SelectItem key={niv.id} value={niv.id}>
                                                  {niv.name}
                                                  {niv.id === user?.niveauId && ' (Actuel)'}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        
                                        <div>
                                          <Label className="text-sm font-medium">Raison du changement (optionnel)</Label>
                                          <Textarea
                                            value={levelChangeReason}
                                            onChange={(e) => setLevelChangeReason(e.target.value)}
                                            placeholder="Expliquez pourquoi vous souhaitez changer de niveau..."
                                            className="mt-1"
                                            rows={3}
                                          />
                                        </div>
                                        
                                        <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                          <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                            Votre demande sera examinée par un administrateur avant d'être approuvée.
                                          </p>
                                        </div>
                                        
                                        <div className="flex space-x-2">
                                          <Button
                                            onClick={() => handleLevelChangeRequest(profile.niveauId)}
                                            disabled={profile.niveauId === user?.niveauId}
                                            className="flex-1"
                                          >
                                            Envoyer la demande
                                          </Button>
                                          <Button
                                            variant="outline"
                                            onClick={() => setShowLevelChangeRequest(false)}
                                            className="flex-1"
                                          >
                                            Annuler
                                          </Button>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}
                                
                                {pendingLevelRequest && (
                                  <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-900/20">
                                    En attente
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>


                        </CardContent>
                      </Card>

                      {/* Account Security */}
                      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                            <Shield className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                            Sécurité du Compte
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Password Change */}
                          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">Mot de passe</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Dernière modification: {user?.passwordUpdatedAt ?
                                  new Date(user.passwordUpdatedAt).toLocaleDateString('fr-FR') :
                                  'Jamais modifié'}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-all duration-200"
                              onClick={() => setShowChangePassword(!showChangePassword)}
                            >
                              <Lock className="h-4 w-4 mr-2" />
                              {user?.password ? 'Changer' : 'Définir le mot de passe'}
                            </Button>
                          </div>

                          {/* Change/Set Password Form */}
                          {showChangePassword && (
                            <div className="space-y-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 animate-in slide-in-from-top-2 duration-300">
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">{user?.password ? 'Changer le mot de passe' : 'Définir le mot de passe'}</h4>

                              <div className="grid gap-4 md:grid-cols-1">
                                {/* Only show current password if user has a password set */}
                                {user?.password && (
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Mot de passe actuel
                                    </Label>
                                    <div className="relative">
                                      <Input
                                        type={showPasswords.current ? "text" : "password"}
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                        className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20 pr-10 transition-all duration-200"
                                        placeholder="Votre mot de passe actuel"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-600"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                                      >
                                        {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Nouveau mot de passe
                                  </Label>
                                  <div className="relative">
                                    <Input
                                      type={showPasswords.new ? "text" : "password"}
                                      value={passwordData.newPassword}
                                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                      className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20 pr-10 transition-all duration-200"
                                      placeholder="Votre nouveau mot de passe"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-600"
                                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                                    >
                                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Confirmer le mot de passe
                                  </Label>
                                  <div className="relative">
                                    <Input
                                      type={showPasswords.confirm ? "text" : "password"}
                                      value={passwordData.confirmPassword}
                                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                      className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20 pr-10 transition-all duration-200"
                                      placeholder="Confirmez votre nouveau mot de passe"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-600"
                                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                                    >
                                      {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              <div className="flex space-x-3 pt-4">
                                <Button
                                  onClick={handlePasswordChange}
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                                  disabled={
                                    user?.google_id
                                      ? (!passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword)
                                      : (!passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword)
                                  }
                                >
                                  {user?.google_id ? 'Définir' : 'Mettre à jour'}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => setShowChangePassword(false)}
                                  className="border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-all duration-200"
                                >
                                  Annuler
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Preferences */}
                      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                            <Settings className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-400" />
                            Préférences
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Self Assessment Toggle */}
                          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 dark:text-white">Auto-évaluation QROC</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Afficher l'interface d'auto-évaluation après avoir répondu aux questions ouvertes (QROC)
                              </p>
                            </div>
                            <Switch
                              checked={profile.showSelfAssessment}
                              onCheckedChange={(checked) => setProfile(prev => ({ ...prev, showSelfAssessment: checked }))}
                              className="ml-4"
                            />
                          </div>

                          {/* Highlight Color Picker */}
                          <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-700/50 dark:to-gray-800/30 rounded-xl border border-gray-200/50 dark:border-gray-600/50 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div className="relative">
                                  <div
                                    className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 shadow-md ring-1 ring-gray-200 dark:ring-gray-600 transition-all duration-300"
                                    style={{ backgroundColor: profile.highlightColor }}
                                  ></div>
                                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-white dark:border-gray-800 animate-pulse"></div>
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-900 dark:text-white">Couleur du surligneur</h4>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    Personnalisez votre couleur de surlignage
                                  </p>
                                </div>
                              </div>
                              <div className="text-xs font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                                {profile.highlightColor.toUpperCase()}
                              </div>
                            </div>

                            {/* Color Picker and Preview */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* Color Picker Section */}
                              <div className="space-y-3">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block">
                                  Sélectionnez une couleur
                                </label>
                                
                                {/* Custom Color Picker */}
                                <div className="relative group">
                                  <input
                                    type="color"
                                    value={profile.highlightColor}
                                    onChange={e => setProfile(prev => ({ ...prev, highlightColor: e.target.value }))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  />
                                  <div 
                                    className="w-full h-12 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.01] relative overflow-hidden pointer-events-none"
                                    style={{
                                      backgroundColor: profile.highlightColor,
                                      boxShadow: `0 4px 15px -3px ${profile.highlightColor}30`
                                    }}
                                  >
                                    {/* Gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    
                                    {/* Color picker icon and text */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="flex items-center space-x-2 bg-black/20 dark:bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                                        <svg className="w-4 h-4 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v11H4V4z" clipRule="evenodd" />
                                          <path d="M15 8a3 3 0 11-6 0 3 3 0 016 0zM12.5 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                                        </svg>
                                        <span className="text-sm font-medium text-white dark:text-black">Choisir une couleur</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Preset Colors */}
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block">
                                    Couleurs prédéfinies
                                  </label>
                                  <div className="grid grid-cols-8 gap-1.5">
                                    {[
                                      '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', 
                                      '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
                                      '#2196F3', '#03A9F4', '#00BCD4', '#009688',
                                      '#4CAF50', '#8BC34A', '#CDDC39', '#FFE082'
                                    ].map((color) => (
                                      <button
                                        key={color}
                                        onClick={() => setProfile(prev => ({ ...prev, highlightColor: color }))}
                                        className={`w-6 h-6 rounded-lg border transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                          profile.highlightColor === color 
                                            ? 'border-blue-500 ring-1 ring-blue-500/50 scale-110' 
                                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        title={`Couleur ${color}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Preview Section */}
                              <div className="space-y-3">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block">
                                  Aperçu en temps réel
                                </label>
                                
                                <div className="relative p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                                  <div className="space-y-2">
                                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                      Exemple de texte avec des mots 
                                      <span 
                                        className="px-1 py-0.5 rounded font-medium text-gray-900 dark:text-white transition-all duration-300"
                                        style={{
                                          backgroundColor: profile.highlightColor,
                                          boxShadow: `0 1px 3px ${profile.highlightColor}40`
                                        }}
                                      >
                                        surlignés
                                      </span> 
                                      dans vos exercices.
                                    </p>
                                    
                                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                                      <div 
                                        className="inline-block px-2 py-1 rounded text-xs font-medium text-gray-900 dark:text-white transition-all duration-300"
                                        style={{
                                          backgroundColor: profile.highlightColor,
                                          boxShadow: `0 2px 8px ${profile.highlightColor}30`
                                        }}
                                      >
                                        Terme médical important
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                    </div>
                  </div>
                </div>
              </main>
            </SidebarInset>
          </div>
        </AppSidebarProvider>
      </ProfileCompletionGuard>
    </ProtectedRoute>
  )
}