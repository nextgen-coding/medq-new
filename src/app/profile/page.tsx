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
import { useTranslation } from 'react-i18next'
import { User, Mail, GraduationCap, Calendar, Shield, Crown, Clock, Camera, Save, Eye, EyeOff, Lock } from 'lucide-react'
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
  })

  // Only render after client hydration to avoid SSR mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Niveaux state
  const [niveaux, setNiveaux] = useState<{ id: string; name: string }[]>([])

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
      const isGoogleUser = !!user?.google_id;
      // Only send the fields required by the backend
      const payload = isGoogleUser
        ? { newPassword: passwordData.newPassword }
        : { currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword };
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
      toast({ title: 'Succès', description: isGoogleUser ? 'Mot de passe défini' : 'Mot de passe mis à jour', variant: 'default' })
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

  return (
    <ProtectedRoute>
      <ProfileCompletionGuard>
        <AppSidebarProvider>
          <div className="flex w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900">
            <AppSidebar />
            <SidebarInset className="flex flex-col min-h-0">
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
              <div className="min-h-0">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
                  {/* Header Section */}
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Mon Profil</h1>
                    <p className="text-gray-600 dark:text-gray-400">Gérez vos informations personnelles et vos préférences</p>
                  </div>

                  <div className="grid gap-8 lg:grid-cols-3 pb-8">
                    {/* Profile Overview Card */}
                    <div className="lg:col-span-1">
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
                                onChange={e => setProfile(prev => ({ ...prev, email: e.target.value }))}
                                className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                                placeholder="votre.email@exemple.com"
                              />
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
                                  <SelectItem value="FMT">Faculté de Médecine de Tunis</SelectItem>
                                  <SelectItem value="FMS">Faculté de Médecine de Sfax</SelectItem>
                                  <SelectItem value="FMSf">Faculté de Médecine de Sousse</SelectItem>
                                  <SelectItem value="FMM">Faculté de Médecine de Monastir</SelectItem>
                                  <SelectItem value="FMG">Faculté de Médecine de Gabès</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Level */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Niveau d'études
                              </Label>
                              <Select value={profile.niveauId} onValueChange={val => setProfile(prev => ({ ...prev, niveauId: val }))}>
                                <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200">
                                  <SelectValue placeholder="Sélectionnez votre niveau" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600">
                                  {niveaux.length === 0 ? (
                                    <div className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">
                                      Aucun niveau disponible
                                    </div>
                                  ) : (
                                    niveaux.map(niv => (
                                      <SelectItem key={niv.id} value={niv.id}>{niv.name}</SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Highlight Color Picker */}
                          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                              <div
                                className="w-4 h-4 rounded-full mr-2 border-2 border-gray-300 shadow-sm transition-all duration-200"
                                style={{ backgroundColor: profile.highlightColor }}
                              ></div>
                              Couleur du surligneur
                            </Label>
                            <div className="flex items-center space-x-4">
                              <div className="relative group">
                                <input
                                  type="color"
                                  value={profile.highlightColor}
                                  onChange={e => setProfile(prev => ({ ...prev, highlightColor: e.target.value }))}
                                  className="w-14 h-12 rounded-xl border-2 border-gray-200 dark:border-gray-600 cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                />
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Aperçu</div>
                                <div className="relative">
                                  <div
                                    className="px-4 py-3 rounded-lg text-sm font-medium text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-600 shadow-sm transition-all duration-300 hover:shadow-md"
                                    style={{
                                      backgroundColor: profile.highlightColor,
                                      boxShadow: `0 4px 6px -1px ${profile.highlightColor}20, 0 2px 4px -1px ${profile.highlightColor}10`
                                    }}
                                  >
                                    Texte surligné avec cette couleur
                                  </div>
                                  <div className="absolute -bottom-1 left-2 right-2 h-1 bg-black/10 dark:bg-white/10 rounded-b-lg blur-sm"></div>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                  {profile.highlightColor.toUpperCase()}
                                </div>
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

                      {/* Subscription Card */}
                      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                            <Crown className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400" />
                            Abonnement
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-6 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Plan actuel</Label>
                              <div className="text-xl font-bold text-gray-900 dark:text-white">
                                {user?.hasActiveSubscription ? 'Pro Annuel' : 'Gratuit'}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Statut</Label>
                              <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${user?.hasActiveSubscription ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                <Badge className={`font-medium ${
                                  user?.hasActiveSubscription
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                                    : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                                }`}>
                                  {user?.hasActiveSubscription ? 'Actif' : 'Inactif'}
                                </Badge>
                              </div>
                            </div>

                            {user?.hasActiveSubscription && user?.subscriptionExpiresAt && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Expiration</Label>
                                <div className="flex items-center space-x-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span className="text-gray-900 dark:text-white font-medium">
                                    {new Date(user.subscriptionExpiresAt).toLocaleDateString('fr-FR', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {!user?.hasActiveSubscription && (
                            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
                                <Crown className="h-4 w-4 mr-2" />
                                Passer au Plan Pro
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            </SidebarInset>
          </div>
        </AppSidebarProvider>
      </ProfileCompletionGuard>
    </ProtectedRoute>
  )
}