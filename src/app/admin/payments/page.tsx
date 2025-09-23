'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { 
  Eye, 
  Check, 
  X, 
  Filter, 
  Download,
  Search,
  User,
  Calendar,
  CreditCard,
  Gift,
  Upload,
  Clock
} from 'lucide-react';

interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  method: 'konnect_gateway' | 'voucher_code' | 'custom_payment';
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'awaiting_verification' | 'verified' | 'rejected';
  subscriptionType: 'semester' | 'annual';
  customPaymentDetails?: string;
  proofImageUrl?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    name: string;
    email: string;
  };
  voucherCode?: {
    code: string;
  };
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
    case 'verified':
      return 'bg-green-100 text-green-800 hover:bg-green-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    case 'awaiting_verification':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
    case 'failed':
    case 'rejected':
    case 'cancelled':
      return 'bg-red-100 text-red-800 hover:bg-red-200';
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  }
};

const getMethodIcon = (method: string) => {
  switch (method) {
    case 'konnect_gateway':
      return <CreditCard className="h-4 w-4" />;
    case 'voucher_code':
      return <Gift className="h-4 w-4" />;
    case 'custom_payment':
      return <Upload className="h-4 w-4" />;
    default:
      return null;
  }
};

const getMethodLabel = (method: string) => {
  switch (method) {
    case 'konnect_gateway':
      return 'Paiement en ligne';
    case 'voucher_code':
      return 'Code de bon';
    case 'custom_payment':
      return 'Paiement personnalisé';
    default:
      return method;
  }
};

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isProofDialogOpen, setIsProofDialogOpen] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/admin/payments');
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      setPayments(data.payments || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les paiements',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (paymentId: string, action: 'verify' | 'reject', notes?: string) => {
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      });

      if (!response.ok) throw new Error('Failed to verify payment');

      toast({
        title: 'Succès',
        description: `Paiement ${action === 'verify' ? 'vérifié' : 'rejeté'} avec succès`,
        variant: 'default',
      });

      fetchPayments();
      setIsProofDialogOpen(false);
      setSelectedPayment(null);
    } catch (error) {
      console.error('Error verifying payment:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de traiter la vérification',
        variant: 'destructive',
      });
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || payment.method === methodFilter;
    const matchesSearch = searchTerm === '' || 
      payment.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.id.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesMethod && matchesSearch;
  });

  const pendingVerifications = payments.filter(p => p.status === 'awaiting_verification').length;

  return (
    <ProtectedRoute requireAdmin>
      <AdminLayout>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Gestion des Paiements
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Gérez et vérifiez tous les paiements des utilisateurs
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <CreditCard className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Total des paiements</p>
                      <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Clock className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">En attente</p>
                      <p className="text-2xl font-bold text-gray-900">{pendingVerifications}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Check className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Vérifiés</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {payments.filter(p => ['completed', 'verified'].includes(p.status)).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <X className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Rejetés</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {payments.filter(p => ['failed', 'rejected', 'cancelled'].includes(p.status)).length}
                      </p>
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
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Rechercher par nom, email ou ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="awaiting_verification">À vérifier</SelectItem>
                      <SelectItem value="completed">Complété</SelectItem>
                      <SelectItem value="verified">Vérifié</SelectItem>
                      <SelectItem value="failed">Échoué</SelectItem>
                      <SelectItem value="rejected">Rejeté</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Méthode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les méthodes</SelectItem>
                      <SelectItem value="konnect_gateway">Paiement en ligne</SelectItem>
                      <SelectItem value="voucher_code">Code de bon</SelectItem>
                      <SelectItem value="custom_payment">Paiement personnalisé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Payments Table */}
            <Card>
              <CardHeader>
                <CardTitle>Paiements ({filteredPayments.length})</CardTitle>
                <CardDescription>
                  Liste de tous les paiements avec leurs détails et statuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Chargement...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Méthode</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/admin/users/${payment.userId}`)}
                                className="p-1 h-auto"
                              >
                                <User className="h-4 w-4" />
                              </Button>
                              <div>
                                <div className="font-medium">{payment.user.name}</div>
                                <div className="text-sm text-gray-500">{payment.user.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getMethodIcon(payment.method)}
                              {getMethodLabel(payment.method)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {payment.subscriptionType === 'annual' ? 'Annuel' : 'Semestriel'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {payment.amount} {payment.currency}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(payment.status)}>
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {new Date(payment.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {payment.method === 'custom_payment' && payment.proofImageUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setIsProofDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              {payment.status === 'awaiting_verification' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleVerifyPayment(payment.id, 'verify')}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleVerifyPayment(payment.id, 'reject')}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Proof Dialog */}
            <Dialog open={isProofDialogOpen} onOpenChange={setIsProofDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Preuve de paiement</DialogTitle>
                  <DialogDescription>
                    Vérifiez la preuve de paiement soumise par l'utilisateur
                  </DialogDescription>
                </DialogHeader>
                
                {selectedPayment && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Utilisateur</label>
                        <p>{selectedPayment.user.name} ({selectedPayment.user.email})</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Montant</label>
                        <p>{selectedPayment.amount} {selectedPayment.currency}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Type d'abonnement</label>
                        <p>{selectedPayment.subscriptionType === 'annual' ? 'Annuel' : 'Semestriel'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Date</label>
                        <p>{new Date(selectedPayment.createdAt).toLocaleString()}</p>
                      </div>
                    </div>

                    {selectedPayment.customPaymentDetails && (
                      <div>
                        <label className="text-sm font-medium">Détails du paiement</label>
                        <p className="mt-1 p-2 bg-gray-50 rounded border text-sm">
                          {selectedPayment.customPaymentDetails}
                        </p>
                      </div>
                    )}

                    {selectedPayment.proofImageUrl && (
                      <div>
                        <label className="text-sm font-medium">Preuve de paiement</label>
                        <div className="mt-2 border rounded-lg overflow-hidden">
                          <img
                            src={selectedPayment.proofImageUrl}
                            alt="Preuve de paiement"
                            className="w-full h-auto max-h-96 object-contain"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => handleVerifyPayment(selectedPayment.id, 'verify')}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Vérifier et Approuver
                      </Button>
                      <Button
                        onClick={() => handleVerifyPayment(selectedPayment.id, 'reject')}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Rejeter
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </AdminLayout>
    </ProtectedRoute>
  );
}
