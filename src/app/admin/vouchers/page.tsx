'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { 
  Plus, 
  Copy, 
  Calendar,
  Gift,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  Trash2
} from 'lucide-react';

interface VoucherCode {
  id: string;
  code: string;
  subscriptionType: 'semester' | 'annual';
  isUsed: boolean;
  usedAt?: string;
  expiresAt?: string;
  createdAt: string;
  creator: {
    name: string;
    email: string;
  };
  usage?: {
    user: {
      name: string;
      email: string;
    };
    usedAt: string;
  }[];
}

interface ReductionCoupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  isUsed: boolean;
  usedAt?: string;
  expiresAt?: string;
  createdAt: string;
  creator: {
    name: string;
    email: string;
  };
  usedBy?: {
    name: string;
    email: string;
  };
}

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<VoucherCode[]>([]);
  const [reductionCoupons, setReductionCoupons] = useState<ReductionCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateReductionDialogOpen, setIsCreateReductionDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Create voucher form state
  const [createForm, setCreateForm] = useState({
    subscriptionType: 'annual' as 'semester' | 'annual',
    quantity: 1,
    expiresInDays: 30,
    hasExpiry: false,
  });

  // Create reduction coupon form state
  const [createReductionForm, setCreateReductionForm] = useState({
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 10,
    quantity: 1,
    expiresInDays: 30,
    hasExpiry: false,
  });

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reductionTypeFilter, setReductionTypeFilter] = useState<string>('all');
  const [reductionStatusFilter, setReductionStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchVouchers();
    fetchReductionCoupons();
  }, []);

  const fetchVouchers = async () => {
    try {
      const response = await fetch('/api/admin/vouchers');
      if (!response.ok) throw new Error('Failed to fetch vouchers');
      const data = await response.json();
      setVouchers(data.vouchers || []);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les codes de bon',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReductionCoupons = async () => {
    try {
      const response = await fetch('/api/admin/reduction-coupons');
      if (!response.ok) throw new Error('Failed to fetch reduction coupons');
      const data = await response.json();
      setReductionCoupons(data.coupons || []);
    } catch (error) {
      console.error('Error fetching reduction coupons:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les coupons de réduction',
        variant: 'destructive',
      });
    }
  };

  const handleCreateVouchers = async () => {
    try {
      const response = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionType: createForm.subscriptionType,
          count: createForm.quantity,
          expiresInDays: createForm.hasExpiry ? createForm.expiresInDays : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create vouchers');
      }

      const data = await response.json();

      toast({
        title: 'Succès',
        description: data.message || `${createForm.quantity} code(s) de bon créé(s) avec succès`,
        variant: 'default',
      });

      setIsCreateDialogOpen(false);
      setCreateForm({
        subscriptionType: 'annual',
        quantity: 1,
        expiresInDays: 30,
        hasExpiry: false,
      });
      fetchVouchers();
    } catch (error) {
      console.error('Error creating vouchers:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de créer les codes de bon',
        variant: 'destructive',
      });
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'Copié',
      description: 'Code copié dans le presse-papiers',
      variant: 'default',
    });
  };

  const handleDeleteVoucher = async (voucherId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce code de bon ?')) {
      return;
    }

    setDeletingId(voucherId);
    try {
      const response = await fetch(`/api/admin/vouchers?id=${voucherId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete voucher');
      }

      toast({
        title: 'Succès',
        description: 'Code de bon supprimé avec succès',
        variant: 'default',
      });

      fetchVouchers();
    } catch (error) {
      console.error('Error deleting voucher:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de supprimer le code de bon',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateReductionCoupons = async () => {
    try {
      const response = await fetch('/api/admin/reduction-coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountType: createReductionForm.discountType,
          discountValue: createReductionForm.discountValue,
          count: createReductionForm.quantity,
          expiresInDays: createReductionForm.hasExpiry ? createReductionForm.expiresInDays : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create reduction coupons');
      }

      const data = await response.json();

      toast({
        title: 'Succès',
        description: data.message || `${createReductionForm.quantity} coupon(s) de réduction créé(s) avec succès`,
        variant: 'default',
      });

      setIsCreateReductionDialogOpen(false);
      setCreateReductionForm({
        discountType: 'percentage',
        discountValue: 10,
        quantity: 1,
        expiresInDays: 30,
        hasExpiry: false,
      });
      fetchReductionCoupons();
    } catch (error) {
      console.error('Error creating reduction coupons:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de créer les coupons de réduction',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteReductionCoupon = async (couponId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce coupon de réduction ?')) {
      return;
    }

    setDeletingId(couponId);
    try {
      const response = await fetch(`/api/admin/reduction-coupons?id=${couponId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete reduction coupon');
      }

      toast({
        title: 'Succès',
        description: 'Coupon de réduction supprimé avec succès',
        variant: 'default',
      });

      fetchReductionCoupons();
    } catch (error) {
      console.error('Error deleting reduction coupon:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de supprimer le coupon de réduction',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredVouchers = vouchers.filter(voucher => {
    const matchesType = typeFilter === 'all' || voucher.subscriptionType === typeFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'used' && voucher.isUsed) ||
      (statusFilter === 'unused' && !voucher.isUsed) ||
      (statusFilter === 'expired' && voucher.expiresAt && new Date(voucher.expiresAt) < new Date());

    return matchesType && matchesStatus;
  });

  const stats = {
    total: vouchers.length,
    used: vouchers.filter(v => v.isUsed).length,
    unused: vouchers.filter(v => !v.isUsed).length,
    expired: vouchers.filter(v => v.expiresAt && new Date(v.expiresAt) < new Date()).length,
  };

  const filteredReductionCoupons = reductionCoupons.filter(coupon => {
    const matchesType = reductionTypeFilter === 'all' || coupon.discountType === reductionTypeFilter;
    const matchesStatus = reductionStatusFilter === 'all' || 
      (reductionStatusFilter === 'used' && coupon.isUsed) ||
      (reductionStatusFilter === 'unused' && !coupon.isUsed) ||
      (reductionStatusFilter === 'expired' && coupon.expiresAt && new Date(coupon.expiresAt) < new Date());

    return matchesType && matchesStatus;
  });

  const reductionStats = {
    total: reductionCoupons.length,
    used: reductionCoupons.filter(c => c.isUsed).length,
    unused: reductionCoupons.filter(c => !c.isUsed).length,
    expired: reductionCoupons.filter(c => c.expiresAt && new Date(c.expiresAt) < new Date()).length,
  };

  return (
    <ProtectedRoute requireAdmin>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Gestion des Codes et Coupons
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                Créez et gérez les codes de bon d'abonnement et les coupons de réduction
              </p>
            </div>
          </div>

          <Tabs defaultValue="vouchers" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vouchers">Codes d'abonnement</TabsTrigger>
              <TabsTrigger value="coupons">Coupons de réduction</TabsTrigger>
            </TabsList>

            <TabsContent value="vouchers" className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full">
                <Button variant="outline" className="flex-1 sm:flex-initial">
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Exporter</span>
                  <span className="xs:hidden">Export</span>
                </Button>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 sm:flex-initial">
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden xs:inline">Créer des codes</span>
                      <span className="xs:hidden">Créer</span>
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Créer des codes de bon</DialogTitle>
                    <DialogDescription>
                      Générez de nouveaux codes de bon pour les abonnements
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>Type d'abonnement</Label>
                      <RadioGroup
                        value={createForm.subscriptionType}
                        onValueChange={(value) => setCreateForm(prev => ({ 
                          ...prev, 
                          subscriptionType: value as 'semester' | 'annual' 
                        }))}
                        className="mt-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="semester" id="semester" />
                          <Label htmlFor="semester">Semestriel (6 mois)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="annual" id="annual" />
                          <Label htmlFor="annual">Annuel (12 mois)</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div>
                      <Label htmlFor="quantity">Nombre de codes à générer</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max="100"
                        value={createForm.quantity}
                        onChange={(e) => setCreateForm(prev => ({ 
                          ...prev, 
                          quantity: parseInt(e.target.value) || 1 
                        }))}
                        className="mt-1"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="hasExpiry"
                          checked={createForm.hasExpiry}
                          onChange={(e) => setCreateForm(prev => ({ 
                            ...prev, 
                            hasExpiry: e.target.checked 
                          }))}
                        />
                        <Label htmlFor="hasExpiry">Définir une date d'expiration</Label>
                      </div>
                      
                      {createForm.hasExpiry && (
                        <div>
                          <Label htmlFor="expiresInDays">Expire dans (jours)</Label>
                          <Input
                            id="expiresInDays"
                            type="number"
                            min="1"
                            value={createForm.expiresInDays}
                            onChange={(e) => setCreateForm(prev => ({ 
                              ...prev, 
                              expiresInDays: parseInt(e.target.value) || 30 
                            }))}
                            className="mt-1"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button 
                        onClick={handleCreateVouchers}
                        className="flex-1"
                      >
                        Créer {createForm.quantity} code(s)
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total des codes</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Utilisés</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.used}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Disponibles</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.unused}</p>
                  </div>
                </div>
              </CardContent>
            </Card>            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Expirés</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.expired}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filtres</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col xs:flex-row gap-3 xs:gap-4">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full xs:w-[140px] sm:w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="semester">Semestriel</SelectItem>
                    <SelectItem value="annual">Annuel</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full xs:w-[140px] sm:w-[180px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="unused">Non utilisés</SelectItem>
                    <SelectItem value="used">Utilisés</SelectItem>
                    <SelectItem value="expired">Expirés</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Vouchers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Codes de Bon ({filteredVouchers.length})</CardTitle>
              <CardDescription>
                Liste de tous les codes de bon générés
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Chargement...</div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block sm:hidden space-y-3">
                    {filteredVouchers.map((voucher) => {
                      const isExpired = voucher.expiresAt && new Date(voucher.expiresAt) < new Date();
                      return (
                        <Card key={voucher.id} className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <code className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                  {voucher.code}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyCode(voucher.code)}
                                  className="p-1 h-auto"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              <Badge 
                                variant={voucher.isUsed ? "default" : isExpired ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {voucher.isUsed ? 'Utilisé' : isExpired ? 'Expiré' : 'Disponible'}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Type:</span>
                                <div className="font-medium">
                                  {voucher.subscriptionType === 'annual' ? 'Annuel' : 'Semestriel'}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-500">Prix:</span>
                                <div className="font-medium">
                                  {voucher.subscriptionType === 'annual' ? '99 TND' : '49 TND'}
                                </div>
                              </div>
                            </div>

                            {voucher.usage && voucher.usage.length > 0 && (
                              <div className="text-sm">
                                <span className="text-gray-500">Utilisé par:</span>
                                <div className="font-medium truncate">{voucher.usage[0].user.name}</div>
                                <div className="text-xs text-gray-500 truncate">{voucher.usage[0].user.email}</div>
                              </div>
                            )}

                            {voucher.expiresAt && (
                              <div className="text-sm">
                                <span className="text-gray-500">Expire:</span>
                                <div className="font-medium flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(voucher.expiresAt).toLocaleDateString()}
                                </div>
                              </div>
                            )}

                            {!voucher.isUsed && !isExpired && (
                              <div className="flex gap-2 pt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyCode(voucher.code)}
                                  className="flex-1 text-xs"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copier
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteVoucher(voucher.id)}
                                  disabled={deletingId === voucher.id}
                                  className="flex-1 text-red-600 hover:text-red-700 text-xs"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  {deletingId === voucher.id ? 'Suppr...' : 'Supprimer'}
                                </Button>
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="hidden md:table-cell">Utilisé par</TableHead>
                        <TableHead className="hidden lg:table-cell">Date d'expiration</TableHead>
                        <TableHead className="hidden lg:table-cell">Créé le</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVouchers.map((voucher) => {
                        const isExpired = voucher.expiresAt && new Date(voucher.expiresAt) < new Date();
                        return (
                          <TableRow key={voucher.id}>
                            <TableCell>
                              <div className="flex flex-col xs:flex-row items-start xs:items-center gap-1 xs:gap-2">
                                <code className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                  {voucher.code}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyCode(voucher.code)}
                                  className="p-1 h-auto xs:ml-auto"
                                >
                                  <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                                <div className="sm:hidden text-xs text-muted-foreground">
                                  {voucher.subscriptionType === 'annual' ? 'Annuel' : 'Sem.'} • 
                                  {voucher.isUsed ? ' Utilisé' : isExpired ? ' Expiré' : ' Disponible'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs">
                                {voucher.subscriptionType === 'annual' ? 'Annuel' : 'Semestriel'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={voucher.isUsed ? "default" : isExpired ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                <span className="hidden xs:inline">
                                  {voucher.isUsed ? 'Utilisé' : isExpired ? 'Expiré' : 'Disponible'}
                                </span>
                                <span className="xs:hidden">
                                  {voucher.isUsed ? 'OK' : isExpired ? 'Exp' : 'Disp'}
                                </span>
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {voucher.usage && voucher.usage.length > 0 ? (
                                <div className="min-w-0">
                                  <div className="font-medium text-sm truncate">{voucher.usage[0].user.name}</div>
                                  <div className="text-xs text-gray-500 truncate">{voucher.usage[0].user.email}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {voucher.expiresAt ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3 text-gray-400" />
                                  {new Date(voucher.expiresAt).toLocaleDateString()}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">Aucune</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {new Date(voucher.createdAt).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-1 xs:gap-2">
                                {!voucher.isUsed && !isExpired && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopyCode(voucher.code)}
                                      className="text-xs px-2 xs:hidden"
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copier
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteVoucher(voucher.id)}
                                      disabled={deletingId === voucher.id}
                                      className="text-red-600 hover:text-red-700 text-xs px-2"
                                    >
                                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                      <span className="hidden sm:inline">{deletingId === voucher.id ? 'Suppression...' : 'Supprimer'}</span>
                                      <span className="sm:hidden">Supp.</span>
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="coupons" className="space-y-4 sm:space-y-6">
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" className="flex-1 sm:flex-initial">
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Exporter</span>
                  <span className="xs:hidden">Export</span>
                </Button>
                <Dialog open={isCreateReductionDialogOpen} onOpenChange={setIsCreateReductionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 sm:flex-initial">
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden xs:inline">Créer des coupons</span>
                      <span className="xs:hidden">Créer</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Créer des coupons de réduction</DialogTitle>
                      <DialogDescription>
                        Générez de nouveaux coupons de réduction
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="reduction-discount-type">Type de réduction</Label>
                          <Select value={createReductionForm.discountType} onValueChange={(value: 'percentage' | 'fixed') => setCreateReductionForm(prev => ({ ...prev, discountType: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Pourcentage</SelectItem>
                              <SelectItem value="fixed">Montant fixe</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="reduction-discount-value">
                            Valeur ({createReductionForm.discountType === 'percentage' ? '%' : 'TND'})
                          </Label>
                          <Input
                            id="reduction-discount-value"
                            type="number"
                            value={createReductionForm.discountValue}
                            onChange={(e) => setCreateReductionForm(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                            min="0"
                            max={createReductionForm.discountType === 'percentage' ? 100 : undefined}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="reduction-quantity">Quantité</Label>
                          <Input
                            id="reduction-quantity"
                            type="number"
                            value={createReductionForm.quantity}
                            onChange={(e) => setCreateReductionForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                            min="1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="reduction-expiry">Expiration (jours)</Label>
                          <Input
                            id="reduction-expiry"
                            type="number"
                            value={createReductionForm.expiresInDays}
                            onChange={(e) => setCreateReductionForm(prev => ({ ...prev, expiresInDays: parseInt(e.target.value) || 30 }))}
                            min="1"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="reduction-has-expiry"
                          checked={createReductionForm.hasExpiry}
                          onChange={(e) => setCreateReductionForm(prev => ({ ...prev, hasExpiry: e.target.checked }))}
                          className="rounded"
                        />
                        <Label htmlFor="reduction-has-expiry">Définir une date d'expiration</Label>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full pt-4">
                        <Button 
                          onClick={handleCreateReductionCoupons}
                          className="flex-1"
                        >
                          Créer {createReductionForm.quantity} coupon(s)
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setIsCreateReductionDialogOpen(false)}
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Reduction Coupons Stats */}
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total des coupons</p>
                        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{reductionStats.total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Utilisés</p>
                        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{reductionStats.used}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                        <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Disponibles</p>
                        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{reductionStats.unused}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Expirés</p>
                        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{reductionStats.expired}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Reduction Coupons Filters */}
              <Card>
                <CardHeader>
                  <CardTitle>Filtres</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col xs:flex-row gap-3 xs:gap-4">
                    <Select value={reductionTypeFilter} onValueChange={setReductionTypeFilter}>
                      <SelectTrigger className="w-full xs:w-[140px] sm:w-[180px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les types</SelectItem>
                        <SelectItem value="percentage">Pourcentage</SelectItem>
                        <SelectItem value="fixed">Montant fixe</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={reductionStatusFilter} onValueChange={setReductionStatusFilter}>
                      <SelectTrigger className="w-full xs:w-[140px] sm:w-[180px]">
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        <SelectItem value="unused">Non utilisés</SelectItem>
                        <SelectItem value="used">Utilisés</SelectItem>
                        <SelectItem value="expired">Expirés</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Reduction Coupons Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Coupons de réduction ({filteredReductionCoupons.length})</CardTitle>
                  <CardDescription>
                    Liste de tous les coupons de réduction générés
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Chargement...</div>
                  ) : (
                    <>
                      {/* Mobile Card View */}
                      <div className="block sm:hidden space-y-3">
                        {filteredReductionCoupons.map((coupon) => {
                          const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                          return (
                            <Card key={coupon.id} className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <code className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                      {coupon.code}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCopyCode(coupon.code)}
                                      className="p-1 h-auto"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <Badge 
                                    variant={coupon.isUsed ? "default" : isExpired ? "destructive" : "secondary"}
                                    className="text-xs"
                                  >
                                    {coupon.isUsed ? 'Utilisé' : isExpired ? 'Expiré' : 'Disponible'}
                                  </Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Type:</span>
                                    <div className="font-medium">
                                      {coupon.discountType === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Valeur:</span>
                                    <div className="font-medium">
                                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue} TND`}
                                    </div>
                                  </div>
                                </div>

                                {coupon.usedBy && (
                                  <div className="text-sm">
                                    <span className="text-gray-500">Utilisé par:</span>
                                    <div className="font-medium truncate">{coupon.usedBy.name}</div>
                                    <div className="text-xs text-gray-500 truncate">{coupon.usedBy.email}</div>
                                  </div>
                                )}

                                {coupon.expiresAt && (
                                  <div className="text-sm">
                                    <span className="text-gray-500">Expire:</span>
                                    <div className="font-medium flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(coupon.expiresAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                )}

                                {!coupon.isUsed && !isExpired && (
                                  <div className="flex gap-2 pt-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopyCode(coupon.code)}
                                      className="flex-1 text-xs"
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copier
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteReductionCoupon(coupon.id)}
                                      disabled={deletingId === coupon.id}
                                      className="flex-1 text-red-600 hover:text-red-700 text-xs"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      {deletingId === coupon.id ? 'Suppr...' : 'Supprimer'}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden sm:block overflow-x-auto">
                        <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead className="hidden sm:table-cell">Type</TableHead>
                            <TableHead className="hidden sm:table-cell">Valeur</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="hidden md:table-cell">Utilisé par</TableHead>
                            <TableHead className="hidden lg:table-cell">Date d'expiration</TableHead>
                            <TableHead className="hidden lg:table-cell">Créé le</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredReductionCoupons.map((coupon) => {
                            const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                            return (
                              <TableRow key={coupon.id}>
                                <TableCell>
                                  <div className="flex flex-col xs:flex-row items-start xs:items-center gap-1 xs:gap-2">
                                    <code className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                      {coupon.code}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCopyCode(coupon.code)}
                                      className="p-1 h-auto xs:ml-auto"
                                    >
                                      <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                    <div className="sm:hidden text-xs text-muted-foreground">
                                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue} TND`} • 
                                      {coupon.isUsed ? ' Utilisé' : isExpired ? ' Expiré' : ' Disponible'}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <Badge variant="outline" className="text-xs">
                                    {coupon.discountType === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <span className="text-sm font-medium">
                                    {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue} TND`}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={coupon.isUsed ? "default" : isExpired ? "destructive" : "secondary"}
                                    className="text-xs"
                                  >
                                    <span className="hidden xs:inline">
                                      {coupon.isUsed ? 'Utilisé' : isExpired ? 'Expiré' : 'Disponible'}
                                    </span>
                                    <span className="xs:hidden">
                                      {coupon.isUsed ? 'OK' : isExpired ? 'Exp' : 'Disp'}
                                    </span>
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {coupon.usedBy ? (
                                    <div className="min-w-0">
                                      <div className="font-medium text-sm truncate">{coupon.usedBy.name}</div>
                                      <div className="text-xs text-gray-500 truncate">{coupon.usedBy.email}</div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {coupon.expiresAt ? (
                                    <div className="flex items-center gap-1 text-sm">
                                      <Calendar className="h-3 w-3 text-gray-400" />
                                      {new Date(coupon.expiresAt).toLocaleDateString()}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-sm">Aucune</span>
                                  )}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {new Date(coupon.createdAt).toLocaleDateString()}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-1 xs:gap-2">
                                    {!coupon.isUsed && !isExpired && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleCopyCode(coupon.code)}
                                          className="text-xs px-2 xs:hidden"
                                        >
                                          <Copy className="h-3 w-3 mr-1" />
                                          Copier
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDeleteReductionCoupon(coupon.id)}
                                          disabled={deletingId === coupon.id}
                                          className="text-red-600 hover:text-red-700 text-xs px-2"
                                        >
                                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                          <span className="hidden sm:inline">{deletingId === coupon.id ? 'Suppression...' : 'Supprimer'}</span>
                                          <span className="sm:hidden">Supp.</span>
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
