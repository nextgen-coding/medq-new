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

interface User {
  id: string;
  name: string | null;
  email: string;
  role: 'student' | 'maintainer' | 'admin';
  status: 'active' | 'inactive' | 'banned' | 'pending' | string;
  createdAt: string;
  lastLoginAt?: string;
  _count: {
    progress: number;
    reports: number;
  };
  profile?: {
    specialty?: string;
    niveau?: string;
    university?: string;
  };
  subscription?: {
    type: string;
    status: string;
    expiresAt?: string;
  };
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
  toast.error(t('admin.deleteError', { defaultValue: 'Échec de la suppression de l’utilisateur' }));
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const getRoleColor = (role: string) => {
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
            <AvatarImage src={''} alt={user?.name || user?.email || 'user'} />
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
                      {t('admin.university', { defaultValue: 'Université' })}
                    </Label>
                    <p className="text-lg font-medium">{user.profile?.university || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
              {user?.subscription && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.subscription', { defaultValue: 'Abonnement' })}
                  </Label>
                  <p className="text-sm">
                    {user.subscription.type} - {user.subscription.status}
                  </p>
                  {user.subscription.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      {t('admin.expires', { defaultValue: 'Expire le' })}: {formatDate(user.subscription.expiresAt)}
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