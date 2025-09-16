'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UniversalHeader } from '@/components/layout/UniversalHeader';
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { User, Mail, GraduationCap, Calendar, Shield, Crown, Clock, Camera, Save, Eye, EyeOff, Lock } from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ProfileCompletionGuard } from '@/components/ProfileCompletionGuard'

export default function ProfilePageRoute() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [showChangePassword, setShowChangePassword] = useState(false)
  // Local faculty selection (no faculty field on User type yet)
  const [faculty, setFaculty] = useState('FMSF')
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
    // TODO: Implement password change logic
    console.log('Changing password...', passwordData)
    setShowChangePassword(false)
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
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
                    onClick={() => console.log('Save changes')}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer les modifications
                  </Button>
                }
              />

              {/* Main Content */}
              <div className="flex-1 bg-gray-900 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <div className="mb-6">
                    <p className="text-gray-400">Voir et mettre à jour vos informations de profil.</p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Informations personnelles */}
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white">Informations personnelles</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Photo de profil */}
                        <div className="space-y-2">
                          <Label className="text-gray-300">Photo de profil</Label>
                          <div className="flex items-center space-x-4">
                            <Avatar className="h-20 w-20">
                              <AvatarImage src={user?.image} alt={user?.name || user?.email} />
                              <AvatarFallback className="bg-blue-600 text-white text-lg">
                                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Button variant="outline" size="sm" className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white">
                                <Camera className="h-4 w-4 mr-2" />
                                Changer de photo
                              </Button>
                              <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF jusqu'à 5Mo</p>
                            </div>
                          </div>
                        </div>

                        {/* Nom d'utilisateur */}
                        <div className="space-y-2">
                          <Label htmlFor="username" className="text-gray-300">Nom d'utilisateur</Label>
                          <Input 
                            id="username"
                            defaultValue={user?.name || ''}
                            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          />
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-gray-300">Email</Label>
                          <Input 
                            id="email"
                            type="email"
                            defaultValue={user?.email || ''}
                            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          />
                        </div>

                        {/* Faculté (local state only; add to backend if needed) */}
                        <div className="space-y-2">
                          <Label className="text-gray-300">Faculté</Label>
                          <Select value={faculty} onValueChange={setFaculty}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-700 border-gray-600">
                              <SelectItem value="FMSF">FMSF</SelectItem>
                              <SelectItem value="other">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Niveau */}
                        <div className="space-y-2">
                          <Label className="text-gray-300">Niveau</Label>
                          <Select defaultValue={user?.niveau?.name || 'DCEM2'}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-700 border-gray-600">
                              <SelectItem value="DCEM1">DCEM1</SelectItem>
                              <SelectItem value="DCEM2">DCEM2 : Pediatrie / Chirurgie</SelectItem>
                              <SelectItem value="DCEM3">DCEM3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Informations du compte */}
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white">Informations du compte</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Rôle */}
                        <div className="space-y-2">
                          <Label className="text-gray-300">Rôle</Label>
                          <div className="flex items-center space-x-2">
                            <Shield className="h-4 w-4 text-blue-400" />
                            <Badge className="bg-blue-600 text-white">
                              {user?.role === 'admin' ? 'Administrateur' : 'Étudiant'}
                            </Badge>
                          </div>
                        </div>

                        {/* Dernière modification du mot de passe */}
                        <div className="space-y-2">
                          <Label className="text-gray-300">Dernière modification du mot de passe</Label>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">
                              {user?.passwordUpdatedAt ? 
                                `Il y a ${Math.floor((Date.now() - new Date(user.passwordUpdatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30))} mois` : 
                                'Jamais modifié'}
                            </span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                              onClick={() => setShowChangePassword(!showChangePassword)}
                            >
                              <Lock className="h-4 w-4 mr-2" />
                              Changer le mot de passe
                            </Button>
                          </div>
                        </div>

                        {/* Change Password Section */}
                        {showChangePassword && (
                          <div className="space-y-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
                            <h4 className="font-medium text-white">Changer le mot de passe</h4>
                            
                            <div className="space-y-2">
                              <Label className="text-gray-300">Mot de passe actuel</Label>
                              <div className="relative">
                                <Input 
                                  type={showPasswords.current ? "text" : "password"}
                                  value={passwordData.currentPassword}
                                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                  className="bg-gray-600 border-gray-500 text-white pr-10"
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
                              <Label className="text-gray-300">Nouveau mot de passe</Label>
                              <div className="relative">
                                <Input 
                                  type={showPasswords.new ? "text" : "password"}
                                  value={passwordData.newPassword}
                                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                  className="bg-gray-600 border-gray-500 text-white pr-10"
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
                              <Label className="text-gray-300">Confirmer le nouveau mot de passe</Label>
                              <div className="relative">
                                <Input 
                                  type={showPasswords.confirm ? "text" : "password"}
                                  value={passwordData.confirmPassword}
                                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                  className="bg-gray-600 border-gray-500 text-white pr-10"
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
                                className="border-gray-600 text-gray-300"
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
                  <Card className="bg-gray-800 border-gray-700 mt-6">
                    <CardHeader>
                      <CardTitle className="text-white">Abonnement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-gray-300">Plan actuel</Label>
                          <div className="text-xl font-semibold text-white">
                            {user?.hasActiveSubscription ? 'Plan Annuel Pro' : 'Plan Gratuit'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-gray-300">Statut</Label>
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${user?.hasActiveSubscription ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                            <Badge className={user?.hasActiveSubscription ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'}>
                              {user?.hasActiveSubscription ? 'Actif' : 'Inactif'}
                            </Badge>
                          </div>
                        </div>

                        {user?.hasActiveSubscription && user?.subscriptionExpiresAt && (
                          <div className="space-y-2">
                            <Label className="text-gray-300">Date d'expiration</Label>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-white">
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