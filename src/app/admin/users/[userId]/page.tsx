'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  ArrowLeft,
  User,
  Shield,
  Calendar,
  Activity,
  Flag,
  Send,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Gift,
  Upload,
  Eye,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UploadDropzone } from '@/utils/uploadthing';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface User {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  image?: string | null;
  role: 'student' | 'maintainer' | 'admin';
  status: 'active' | 'inactive' | 'banned' | 'pending' | string;
  createdAt: string;
  lastLoginAt?: string;
  hasActiveSubscription: boolean;
  subscriptionExpiresAt?: string | null;
  _count: {
    progress: number;
    reports: number;
    payments: number;
  };
  profile?: {
    specialty?: string;
    niveau?: string;
    faculte?: string;
  };
  paymentHistory?: Array<{
    id: string;
    amount: number;
    currency: string;
    method: 'konnect_gateway' | 'voucher_code' | 'custom_payment' | 'autre_payment';
    status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'awaiting_verification' | 'verified' | 'rejected';
    subscriptionType: 'semester' | 'annual';
    customPaymentDetails?: string;
    proofImageUrl?: string;
    adminNotes?: string;
    createdAt: string;
    voucherCode?: {
      code: string;
    };
  }>;
}

export default function UserDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notificationText, setNotificationText] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removeSubscriptionDialogOpen, setRemoveSubscriptionDialogOpen] = useState(false);
  const [removingSubscription, setRemovingSubscription] = useState(false);
  const [removalReason, setRemovalReason] = useState('');
  const [activateSubscriptionDialogOpen, setActivateSubscriptionDialogOpen] = useState(false);
  const [activatingSubscription, setActivatingSubscription] = useState(false);
  const [activationSubscriptionType, setActivationSubscriptionType] = useState<'semester' | 'annual'>('semester');
  const [activationPaymentMethod, setActivationPaymentMethod] = useState<'konnect_gateway' | 'voucher_code' | 'custom_payment'>('konnect_gateway');
  const [activationVoucherCode, setActivationVoucherCode] = useState('');
  const [activationCustomDetails, setActivationCustomDetails] = useState('');
  const [activationProofFileUrl, setActivationProofFileUrl] = useState<string | null>(null);
  const [activationIsUploading, setActivationIsUploading] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      const userData = await response.json();
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user:', error);
  toast.error(t('admin.userFetchError', { defaultValue: 'Impossible de charger les détails de l’utilisateur' }));
      router.push('/admin');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (newRole: 'student' | 'maintainer' | 'admin') => {
    if (!user) return;
    
    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      setUser({ ...user, role: newRole });
  toast.success(t('admin.roleUpdated', { defaultValue: 'Rôle de l’utilisateur mis à jour' }));
    } catch (error) {
      console.error('Error updating role:', error);
  toast.error(t('admin.roleUpdateError', { defaultValue: 'Échec de la mise à jour du rôle de l’utilisateur' }));
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'inactive' | 'banned' | 'pending') => {
    if (!user) return;
    
    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

  setUser({ ...user, status: newStatus });
  toast.success(t('admin.statusUpdated', { defaultValue: 'Statut de l’utilisateur mis à jour' }));
    } catch (error) {
      console.error('Error updating status:', error);
  toast.error(t('admin.statusUpdateError', { defaultValue: 'Échec de la mise à jour du statut de l’utilisateur' }));
    } finally {
      setUpdating(false);
    }
  };

  const handleSendNotification = async () => {
    if (!notificationText.trim() || !user) return;

    setSendingNotification(true);
    try {
      const response = await fetch(`/api/admin/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          message: notificationText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send notification');
      }

      setNotificationText('');
  toast.success(t('admin.notificationSent', { defaultValue: 'Notification envoyée avec succès' }));
    } catch (error) {
      console.error('Error sending notification:', error);
  toast.error(t('admin.notificationError', { defaultValue: 'Échec de l’envoi de la notification' }));
    } finally {
      setSendingNotification(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

  toast.success(t('admin.userDeleted', { defaultValue: 'Utilisateur supprimé avec succès' }));
      router.push('/admin/users');
    } catch (error) {
      console.error('Error deleting user:', error);
  toast.error(t('admin.deleteError', { defaultValue: 'Échec de la suppression de l\'utilisateur' }));
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleRemoveSubscription = async () => {
    if (!user) return;

    setRemovingSubscription(true);
    try {
      const response = await fetch('/api/admin/users/remove-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          reason: removalReason.trim() || 'No reason provided'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove subscription');
      }

      // Update local user state
      setUser({ 
        ...user, 
        hasActiveSubscription: false,
        subscriptionExpiresAt: null
      });
      
      setRemovalReason('');
      setRemoveSubscriptionDialogOpen(false);
      toast.success('Abonnement supprimé avec succès');
      
      // Refresh user data to get updated information
      fetchUser();
    } catch (error) {
      console.error('Error removing subscription:', error);
      toast.error(error instanceof Error ? error.message : 'Échec de la suppression de l\'abonnement');
    } finally {
      setRemovingSubscription(false);
    }
  };

  const handleActivateSubscription = async () => {
    if (!user) return;

    // Validation
    if (activationPaymentMethod === 'voucher_code' && !activationVoucherCode.trim()) {
      toast.error('Veuillez entrer un code de bon');
      return;
    }

    if (activationPaymentMethod === 'custom_payment' && !activationCustomDetails.trim()) {
      toast.error('Veuillez entrer les détails du paiement personnalisé');
      return;
    }

    if (activationPaymentMethod === 'custom_payment' && !activationProofFileUrl) {
      toast.error('Veuillez télécharger une preuve de paiement');
      return;
    }

    setActivatingSubscription(true);
    try {
      // Create payment record instead of directly activating subscription
      const response = await fetch('/api/admin/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          method: activationPaymentMethod,
          subscriptionType: activationSubscriptionType,
          voucherCode: activationPaymentMethod === 'voucher_code' ? activationVoucherCode : undefined,
          customPaymentDetails: activationPaymentMethod === 'custom_payment' ? activationCustomDetails : undefined,
          proofImageUrl: activationPaymentMethod === 'custom_payment' ? activationProofFileUrl : undefined,
          adminCreated: true // Flag to indicate this was created by admin
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment record');
      }

      const result = await response.json();
      
      // Reset form fields
      setActivationVoucherCode('');
      setActivationCustomDetails('');
      setActivationProofFileUrl(null);
      setActivationPaymentMethod('konnect_gateway');
      setActivationSubscriptionType('semester');
      
      setActivateSubscriptionDialogOpen(false);
      
      const methodText = activationPaymentMethod === 'voucher_code' ? 'avec code de bon' :
                        activationPaymentMethod === 'custom_payment' ? 'avec paiement personnalisé' :
                        'avec passerelle de paiement';
      
      toast.success(`Paiement ${activationSubscriptionType === 'annual' ? 'annuel' : 'semestriel'} ${methodText} créé avec succès. ${
        activationPaymentMethod === 'voucher_code' ? 'Abonnement activé automatiquement.' :
        activationPaymentMethod === 'custom_payment' ? 'En attente de vérification.' :
        'Traitement en cours.'
      }`);
      
      // Refresh user data to get updated information
      fetchUser();
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error(error instanceof Error ? error.message : 'Échec de la création du paiement');
    } finally {
      setActivatingSubscription(false);
    }
  };  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'maintainer':
        return 'bg-medblue-100 text-medblue-800 hover:bg-medblue-200';
      default:
        return 'bg-green-100 text-green-800 hover:bg-green-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'banned':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const headerContent = useMemo(() => (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">{t('admin.admin', { defaultValue: 'Administration' })}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/users">{t('admin.users', { defaultValue: 'Utilisateurs' })}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{user?.name || user?.email || '...'}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 sm:h-16 sm:w-16 ring-2 ring-medblue-100 dark:ring-medblue-900/30">
            <AvatarImage src={user?.image || ''} alt={user?.name || user?.email || 'user'} />
            <AvatarFallback className="bg-medblue-50 text-medblue-700">
              {(user?.name || user?.email || '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{user?.name || user?.email}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {user && (
                <Badge className={`${getRoleColor(user.role)} border-none rounded-full px-3 py-1 capitalize`}>
                  {user.role === 'admin' ? <Shield className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                  {user.role}
                </Badge>
              )}
              {user && (
                <Badge className={`${getStatusColor(user.status)} border-none rounded-full px-3 py-1 capitalize`}>
                  {user.status}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/users')} className="hidden sm:inline-flex gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back', { defaultValue: 'Retour' })}
          </Button>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                {t('common.delete', { defaultValue: 'Supprimer' })}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  {t('admin.deleteUser', { defaultValue: 'Supprimer l’utilisateur' })}
                </DialogTitle>
                <DialogDescription>
                  {t('admin.deleteUserConfirmation', {
                    defaultValue:
                      'Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible et supprimera définitivement toutes ses données.',
                    name: user?.name || user?.email,
                  })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  {t('common.cancel', { defaultValue: 'Annuler' })}
                </Button>
                <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
                  {deleting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {t('common.deleting', { defaultValue: 'Suppression…' })}
                    </div>
                  ) : (
                    t('common.delete', { defaultValue: 'Supprimer' })
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  ), [user, deleteDialogOpen, deleting, router, t]);

  const content = (
    <div className="space-y-6">
      {/* Top header */}
      {headerContent}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('admin.basicInformation', { defaultValue: 'Informations de base' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.name', { defaultValue: 'Nom' })}
                  </Label>
                  <p className="text-lg font-medium">{user?.name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.email', { defaultValue: 'Email' })}
                  </Label>
                  <p className="text-lg font-medium">{user?.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.phone', { defaultValue: 'Téléphone' })}
                  </Label>
                  <p className="text-lg font-medium">{user?.phone || 'Non renseigné'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.role', { defaultValue: 'Rôle' })}
                  </Label>
                  <div className="mt-1">
                    <Select value={user?.role} onValueChange={handleRoleChange} disabled={updating}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {t('admin.student', { defaultValue: 'Étudiant' })}
                          </div>
                        </SelectItem>
                        <SelectItem value="maintainer">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {t('admin.maintainer', { defaultValue: 'Mainteneur' })}
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            {t('admin.admin', { defaultValue: 'Admin' })}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.status', { defaultValue: 'Statut' })}
                  </Label>
                  <div className="mt-1">
                    <Select value={user?.status} onValueChange={handleStatusChange} disabled={updating}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            {t('admin.active', { defaultValue: 'Actif' })}
                          </div>
                        </SelectItem>
                        <SelectItem value="inactive">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-600" />
                            {t('admin.inactive', { defaultValue: 'Inactif' })}
                          </div>
                        </SelectItem>
                        <SelectItem value="pending">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-yellow-600" />
                            {t('admin.pending', { defaultValue: 'En attente' })}
                          </div>
                        </SelectItem>
                        <SelectItem value="banned">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            {t('admin.banned', { defaultValue: 'Banni' })}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Information */}
          {user?.profile && (
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.profileInformation', { defaultValue: 'Informations du profil' })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      {t('admin.specialty', { defaultValue: 'Spécialité' })}
                    </Label>
                    <p className="text-lg font-medium">{user.profile?.specialty || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      {t('admin.level', { defaultValue: 'Niveau' })}
                    </Label>
                    <p className="text-lg font-medium">{user.profile?.niveau || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      {t('admin.faculty', { defaultValue: 'Faculté' })}
                    </Label>
                    <p className="text-lg font-medium">{user.profile?.faculte || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Informations de paiement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Statut d'abonnement
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={user?.hasActiveSubscription ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {user?.hasActiveSubscription ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Date d'expiration
                  </Label>
                  <p className="text-lg font-medium">
                    {user?.subscriptionExpiresAt 
                      ? new Date(user.subscriptionExpiresAt).toLocaleDateString()
                      : 'N/A'
                    }
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Nombre de paiements
                  </Label>
                  <p className="text-lg font-medium">{user?._count?.payments || 0}</p>
                </div>
              </div>

              {/* Subscription Management Buttons */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex gap-2">
                  {user?.hasActiveSubscription && (
                    <Dialog open={removeSubscriptionDialogOpen} onOpenChange={setRemoveSubscriptionDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="flex items-center gap-2">
                          <XCircle className="h-4 w-4" />
                          Supprimer l'abonnement
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Supprimer l'abonnement
                          </DialogTitle>
                          <DialogDescription>
                            Êtes-vous sûr de vouloir supprimer l'abonnement de cet utilisateur ? 
                            Cette action retirera immédiatement l'accès aux contenus premium.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="removalReason">Raison de la suppression (optionnel)</Label>
                            <Textarea
                              id="removalReason"
                              placeholder="Ex: Violation des conditions d'utilisation, demande de l'utilisateur..."
                              value={removalReason}
                              onChange={(e) => setRemovalReason(e.target.value)}
                              rows={3}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setRemoveSubscriptionDialogOpen(false)}>
                            Annuler
                          </Button>
                          <Button variant="destructive" onClick={handleRemoveSubscription} disabled={removingSubscription}>
                            {removingSubscription ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Suppression...
                              </div>
                            ) : (
                              'Supprimer l\'abonnement'
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}

                  {!user?.hasActiveSubscription && (
                    <Dialog 
                      open={activateSubscriptionDialogOpen} 
                      onOpenChange={(open) => {
                        setActivateSubscriptionDialogOpen(open);
                        if (!open) {
                          // Reset form when dialog closes
                          setActivationVoucherCode('');
                          setActivationCustomDetails('');
                          setActivationProofFileUrl(null);
                          setActivationPaymentMethod('konnect_gateway');
                          setActivationSubscriptionType('semester');
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="default" size="sm" className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Créer un abonnement
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-green-600">
                            <UserCheck className="h-5 w-5" />
                            Créer un abonnement
                          </DialogTitle>
                          <DialogDescription>
                            Créez un enregistrement de paiement et activez l'abonnement pour cet utilisateur.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6">
                          {/* Subscription Type */}
                          <div>
                            <Label htmlFor="subscriptionType">Type d'abonnement</Label>
                            <Select value={activationSubscriptionType} onValueChange={(value: 'semester' | 'annual') => setActivationSubscriptionType(value)}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="semester">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Semestriel (6 mois)
                                  </div>
                                </SelectItem>
                                <SelectItem value="annual">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Annuel (12 mois)
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Payment Method */}
                          <div>
                            <Label htmlFor="paymentMethod">Méthode de paiement</Label>
                            <RadioGroup 
                              value={activationPaymentMethod} 
                              onValueChange={(value: 'konnect_gateway' | 'voucher_code' | 'custom_payment') => setActivationPaymentMethod(value)}
                              className="mt-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="konnect_gateway" id="konnect" />
                                <Label htmlFor="konnect" className="flex items-center gap-2 cursor-pointer">
                                  <CreditCard className="h-4 w-4" />
                                  Passerelle Konnect
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="voucher_code" id="voucher" />
                                <Label htmlFor="voucher" className="flex items-center gap-2 cursor-pointer">
                                  <Gift className="h-4 w-4" />
                                  Code de bon
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="custom_payment" id="custom" />
                                <Label htmlFor="custom" className="flex items-center gap-2 cursor-pointer">
                                  <Upload className="h-4 w-4" />
                                  Paiement personnalisé
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>

                          {/* Voucher Code Input */}
                          {activationPaymentMethod === 'voucher_code' && (
                            <div>
                              <Label htmlFor="voucherCode">Code de bon</Label>
                              <Input
                                id="voucherCode"
                                value={activationVoucherCode}
                                onChange={(e) => setActivationVoucherCode(e.target.value)}
                                placeholder="Entrez le code de bon"
                                className="mt-1"
                              />
                            </div>
                          )}

                          {/* Custom Payment Details */}
                          {activationPaymentMethod === 'custom_payment' && (
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="customDetails">Détails du paiement personnalisé</Label>
                                <Textarea
                                  id="customDetails"
                                  value={activationCustomDetails}
                                  onChange={(e) => setActivationCustomDetails(e.target.value)}
                                  placeholder="Décrivez les détails du paiement (ex: virement bancaire, paiement en espèces, etc.)"
                                  className="mt-1"
                                  rows={3}
                                />
                              </div>
                              
                              <div>
                                <Label>Preuve de paiement (obligatoire)</Label>
                                <div className="mt-2">
                                  <UploadDropzone
                                    endpoint="imageUploader"
                                    onClientUploadComplete={(res) => {
                                      if (res?.[0]) {
                                        setActivationProofFileUrl(res[0].url);
                                        setActivationIsUploading(false);
                                        toast.success('Preuve de paiement téléchargée avec succès');
                                      }
                                    }}
                                    onUploadError={(error) => {
                                      console.error('Upload error:', error);
                                      setActivationIsUploading(false);
                                      toast.error('Erreur lors du téléchargement de la preuve');
                                    }}
                                    onUploadBegin={(name: string) => {
                                      setActivationIsUploading(true);
                                      toast.success(`Téléchargement de ${name} en cours...`);
                                    }}
                                  />
                                  {activationProofFileUrl && (
                                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="text-sm font-medium text-green-800">
                                            ✓ Preuve de paiement téléchargée
                                          </p>
                                          <p className="text-xs text-green-600">
                                            Fichier prêt pour vérification
                                          </p>
                                        </div>
                                        <a 
                                          href={activationProofFileUrl} 
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
                              </div>
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setActivateSubscriptionDialogOpen(false)}>
                            Annuler
                          </Button>
                          <Button variant="default" onClick={handleActivateSubscription} disabled={activatingSubscription}>
                            {activatingSubscription ? (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Création...
                              </div>
                            ) : (
                              'Créer le paiement'
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Payment History */}
              {user?.paymentHistory && user.paymentHistory.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Historique des paiements</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {user.paymentHistory.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            {payment.method === 'konnect_gateway' && <CreditCard className="h-4 w-4" />}
                            {payment.method === 'voucher_code' && <Gift className="h-4 w-4" />}
                            {payment.method === 'custom_payment' && <Upload className="h-4 w-4" />}
                            {payment.method === 'autre_payment' && <Upload className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="font-medium">
                              {payment.amount} {payment.currency} - {payment.subscriptionType === 'annual' ? 'Annuel' : 'Semestriel'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {payment.method === 'konnect_gateway' && 'Paiement en ligne'}
                              {payment.method === 'voucher_code' && `Code: ${payment.voucherCode?.code}`}
                              {payment.method === 'custom_payment' && 'Paiement personnalisé'}
                              {payment.method === 'autre_payment' && 'Autre méthode de paiement'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(payment.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={
                            payment.status === 'completed' || payment.status === 'verified' 
                              ? 'bg-green-100 text-green-800'
                              : payment.status === 'awaiting_verification'
                                ? 'bg-yellow-100 text-yellow-800'
                                : payment.status === 'pending'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                          }>
                            {payment.status}
                          </Badge>
                          {(payment.method === 'custom_payment' || payment.method === 'autre_payment') && payment.proofImageUrl && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Preuve de paiement</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  {payment.customPaymentDetails && (
                                    <div>
                                      <Label className="text-sm font-medium">Détails</Label>
                                      <p className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-900 dark:text-gray-100">
                                        {payment.customPaymentDetails}
                                      </p>
                                    </div>
                                  )}
                                  <div>
                                    <Label className="text-sm font-medium">Preuve de paiement</Label>
                                    <div className="mt-2 border rounded-lg overflow-hidden">
                                      <img
                                        src={payment.proofImageUrl}
                                        alt="Preuve de paiement"
                                        className="w-full h-auto max-h-96 object-contain"
                                      />
                                    </div>
                                  </div>
                                  {payment.adminNotes && (
                                    <div>
                                      <Label className="text-sm font-medium">Notes admin</Label>
                                      <p className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-900 dark:text-gray-100">
                                        {payment.adminNotes}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Send Notification */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                {t('admin.sendNotification', { defaultValue: 'Envoyer une notification' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="notification" className="text-sm font-medium">
                  {t('admin.message', { defaultValue: 'Message' })}
                </Label>
                <Textarea
                  id="notification"
                  placeholder={t('admin.notificationPlaceholder', { defaultValue: 'Saisissez votre message ici…' })}
                  value={notificationText}
                  onChange={(e) => setNotificationText(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
              <Button
                onClick={handleSendNotification}
                disabled={!notificationText.trim() || sendingNotification}
                className="w-full bg-medblue-600 hover:bg-medblue-700"
              >
                {sendingNotification ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {t('admin.sending', { defaultValue: 'Envoi…' })}
                  </div>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {t('admin.sendNotification', { defaultValue: 'Envoyer la notification' })}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.currentStatus', { defaultValue: 'Statut actuel' })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={`${user ? getRoleColor(user.role) : ''} border-none font-medium rounded-full px-3 py-1`}>
                  {user?.role === 'admin' ? <Shield className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                  {user?.role}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${user ? getStatusColor(user.status) : ''} border-none font-medium rounded-full px-3 py-1`}>
                  {user?.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Activity Stats */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.activityStats', { defaultValue: 'Statistiques d’activité' })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-medblue-600" />
                  <span className="text-sm">{t('admin.progress', { defaultValue: 'Progression' })}</span>
                </div>
                <span className="font-semibold">{user?._count.progress}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">{t('admin.reports', { defaultValue: 'Signalements' })}</span>
                </div>
                <span className="font-semibold">{user?._count.reports}</span>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.accountInfo', { defaultValue: 'Informations du compte' })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  {t('admin.joinDate', { defaultValue: 'Date d’inscription' })}
                </Label>
                <p className="text-sm">{user ? formatDate(user.createdAt) : '—'}</p>
              </div>
              {user?.lastLoginAt && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.lastLogin', { defaultValue: 'Dernière connexion' })}
                  </Label>
                  <p className="text-sm">{formatDate(user.lastLoginAt)}</p>
                </div>
              )}
              {user?.hasActiveSubscription && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.subscription', { defaultValue: 'Abonnement' })}
                  </Label>
                  <p className="text-sm">
                    Actif
                  </p>
                  {user.subscriptionExpiresAt && (
                    <p className="text-xs text-muted-foreground">
                      {t('admin.expires', { defaultValue: 'Expire le' })}: {formatDate(user.subscriptionExpiresAt)}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <ProtectedRoute requireAdmin>
        <AdminRoute>
          <AdminLayout>
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medblue-600"></div>
            </div>
          </AdminLayout>
        </AdminRoute>
      </ProtectedRoute>
    );
  }

  if (!user) {
    return (
      <ProtectedRoute requireAdmin>
        <AdminRoute>
          <AdminLayout>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-muted-foreground">
                {t('admin.userNotFound', { defaultValue: 'Utilisateur introuvable' })}
              </h2>
              <Button variant="outline" className="mt-6" onClick={() => router.push('/admin/users')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back', { defaultValue: 'Retour' })}
              </Button>
            </div>
          </AdminLayout>
        </AdminRoute>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>{content}</AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}