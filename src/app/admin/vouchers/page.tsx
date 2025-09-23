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
  Download
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

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<VoucherCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Create voucher form state
  const [createForm, setCreateForm] = useState({
    subscriptionType: 'annual' as 'semester' | 'annual',
    quantity: 1,
    expiresInDays: 30,
    hasExpiry: false,
  });

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchVouchers();
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

  return (
    <ProtectedRoute requireAdmin>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Gestion des Codes de Bon
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Créez et gérez les codes de bon pour les abonnements
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer des codes
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
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Gift className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Total des codes</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Utilisés</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.used}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Gift className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Disponibles</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.unused}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Expirés</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.expired}</p>
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
              <div className="flex gap-4">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="semester">Semestriel</SelectItem>
                    <SelectItem value="annual">Annuel</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Utilisé par</TableHead>
                      <TableHead>Date d'expiration</TableHead>
                      <TableHead>Créé le</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVouchers.map((voucher) => {
                      const isExpired = voucher.expiresAt && new Date(voucher.expiresAt) < new Date();
                      
                      return (
                        <TableRow key={voucher.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                {voucher.code}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyCode(voucher.code)}
                                className="p-1 h-auto"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {voucher.subscriptionType === 'annual' ? 'Annuel' : 'Semestriel'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={
                                voucher.isUsed 
                                  ? 'bg-green-100 text-green-800'
                                  : isExpired
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                              }
                            >
                              {voucher.isUsed ? 'Utilisé' : isExpired ? 'Expiré' : 'Disponible'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {voucher.usage && voucher.usage.length > 0 ? (
                              <div>
                                <div className="font-medium">{voucher.usage[0].user.name}</div>
                                <div className="text-sm text-gray-500">{voucher.usage[0].user.email}</div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {voucher.expiresAt ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                {new Date(voucher.expiresAt).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-gray-400">Aucune</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {new Date(voucher.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            {!voucher.isUsed && !isExpired && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyCode(voucher.code)}
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Copier
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
