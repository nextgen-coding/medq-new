'use client'

import { useState, useRef, useEffect } from 'react'
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
  const { user, refreshUser } = useAuth()
  const { t } = useTranslation()
  const [showChangePassword, setShowChangePassword] = useState(false)
  // Editable profile state
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    niveauId: user?.niveauId || user?.niveau?.id || '',
    image: user?.image || '',
    faculty: user?.faculty || 'FMSF',
    sexe: user?.sexe || 'M',
  })

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

  const handlePasswordChange = async () => {
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordData),
      })
      if (!res.ok) throw new Error('Erreur lors du changement de mot de passe')
      toast({ title: 'Succès', description: 'Mot de passe mis à jour', variant: 'default' })
      setShowChangePassword(false)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
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
      toast({ title: 'Succès', description: 'Profil mis à jour', variant: 'default' })
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
          <div className="flex min-h-screen w-full bg-gray-900">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col">
              {/* Universal Header */}
              <UniversalHeader
                title="Profil"
                rightActions={
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleProfileSave}
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </Button>
                }
              />

              {/* Main Content */}
              <div className="flex-1 bg-white text-gray-900 dark:bg-gray-900 dark:text-white transition-colors">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <div className="mb-6">
                    <p className="text-gray-400">Voir et mettre à jour vos informations de profil.</p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Informations personnelles */}
                    <Card className="bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 transition-colors">
                      <CardHeader>
                        <CardTitle className="text-white">Informations personnelles</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Photo de profil */}
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Photo de profil</Label>
                          <div className="flex items-center space-x-4">
                            <Avatar className="h-20 w-20">
                              <AvatarImage src={profile.image} alt={profile.name || profile.email} />
                              <AvatarFallback className="bg-blue-600 text-white text-lg">
                                {profile.name?.charAt(0) || profile.email?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleImageChange}
                              />
                              <Button variant="outline" size="sm" className="border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                                onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                              >
                                <Camera className="h-4 w-4 mr-2" />
                                {isUploading ? 'Téléversement...' : 'Changer de photo'}
                              </Button>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PNG, JPG, GIF jusqu'à 5Mo</p>
                            </div>
                          </div>
                        </div>

                        {/* Nom d'utilisateur */}
                        <div className="space-y-2">
                          <Label htmlFor="username" className="text-gray-700 dark:text-gray-300">Nom d'utilisateur</Label>
                          <Input 
                            id="username"
                            value={profile.name}
                            onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                            className="bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">Email</Label>
                          <Input 
                            id="email"
                            type="email"
                            value={profile.email}
                            onChange={e => setProfile(prev => ({ ...prev, email: e.target.value }))}
                            className="bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>

                        {/* Faculté (local state only; add to backend if needed) */}
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Faculté</Label>
                          <Select value={profile.faculty} onValueChange={val => setProfile(prev => ({ ...prev, faculty: val }))}>
                            <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600">
                              <SelectItem value="FMT">FMT</SelectItem>
                              <SelectItem value="FMS">FMS</SelectItem>
                              <SelectItem value="FMSf">FMSf</SelectItem>
                              <SelectItem value="FMM">FMM</SelectItem>
                              <SelectItem value="FMG">FMG</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Niveau */}
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Niveau</Label>
                          <Select value={profile.niveauId} onValueChange={val => setProfile(prev => ({ ...prev, niveauId: val }))}>
                            <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600">
                              {niveaux.length === 0 ? (
                                <SelectItem value="" disabled>Aucun niveau disponible</SelectItem>
                              ) : (
                                niveaux.map(niv => (
                                  <SelectItem key={niv.id} value={niv.id}>{niv.name}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Informations du compte */}
                    <Card className="bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 transition-colors">
                      <CardHeader>
                        <CardTitle className="text-gray-900 dark:text-white">Informations du compte</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Rôle */}
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Rôle</Label>
                          <div className="flex items-center space-x-2">
                            <Shield className="h-4 w-4 text-blue-400" />
                            <Badge className="bg-blue-600 text-white">
                              {user?.role === 'admin' ? 'Administrateur' : 'Étudiant'}
                            </Badge>
                          </div>
                        </div>

                        {/* Dernière modification du mot de passe */}
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Dernière modification du mot de passe</Label>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 dark:text-gray-400 text-sm">
                              {user?.passwordUpdatedAt ? 
                                `Il y a ${Math.floor((Date.now() - new Date(user.passwordUpdatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30))} mois` : 
                                'Jamais modifié'}
                            </span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                              onClick={() => setShowChangePassword(!showChangePassword)}
                            >
                              <Lock className="h-4 w-4 mr-2" />
                              Changer le mot de passe
                            </Button>
                          </div>
                        </div>

                        {/* Change Password Section */}
                        {showChangePassword && (
                          <div className="space-y-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                            <h4 className="font-medium text-gray-900 dark:text-white">Changer le mot de passe</h4>
                            
                            <div className="space-y-2">
                              <Label className="text-gray-700 dark:text-gray-300">Mot de passe actuel</Label>
                              <div className="relative">
                                <Input 
                                  type={showPasswords.current ? "text" : "password"}
                                  value={passwordData.currentPassword}
                                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                  className="bg-gray-100 border-gray-300 text-gray-900 pr-10 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                                >
                                  {showPasswords.current ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-gray-700 dark:text-gray-300">Nouveau mot de passe</Label>
                              <div className="relative">
                                <Input 
                                  type={showPasswords.new ? "text" : "password"}
                                  value={passwordData.newPassword}
                                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                  className="bg-gray-100 border-gray-300 text-gray-900 pr-10 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                                >
                                  {showPasswords.new ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-gray-700 dark:text-gray-300">Confirmer le nouveau mot de passe</Label>
                              <div className="relative">
                                <Input 
                                  type={showPasswords.confirm ? "text" : "password"}
                                  value={passwordData.confirmPassword}
                                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                  className="bg-gray-100 border-gray-300 text-gray-900 pr-10 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                                >
                                  {showPasswords.confirm ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                                </Button>
                              </div>
                            </div>

                            <div className="flex space-x-2">
                              <Button 
                                onClick={handlePasswordChange}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={!passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                              >
                                Mettre à jour le mot de passe
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => setShowChangePassword(false)}
                                className="border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"
                              >
                                Annuler
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Subscription Card - Full Width */}
                    <Card className="bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 mt-6 transition-colors">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white">Abonnement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Plan actuel</Label>
                          <div className="text-xl font-semibold text-gray-900 dark:text-white">
                            {user?.hasActiveSubscription ? 'Plan Annuel Pro' : 'Plan Gratuit'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Statut</Label>
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${user?.hasActiveSubscription ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                            <Badge className={user?.hasActiveSubscription ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'}>
                              {user?.hasActiveSubscription ? 'Actif' : 'Inactif'}
                            </Badge>
                          </div>
                        </div>

                        {user?.hasActiveSubscription && user?.subscriptionExpiresAt && (
                          <div className="space-y-2">
                            <Label className="text-gray-700 dark:text-gray-300">Date d'expiration</Label>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-900 dark:text-white">
                                Expire le {new Date(user.subscriptionExpiresAt).toLocaleDateString('fr-FR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {!user?.hasActiveSubscription && (
                        <div className="mt-6">
                          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            Gérer l'abonnement
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </SidebarInset>
          </div>
        </AppSidebarProvider>
      </ProfileCompletionGuard>
    </ProtectedRoute>
  )
}