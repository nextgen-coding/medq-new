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
          <div className="space-y-4 sm:space-y-6 px-2 sm:px-0 max-w-full overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  Gestion des Paiements
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                  Gérez et vérifiez tous les paiements des utilisateurs
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" className="flex-1 sm:flex-initial">
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Exporter</span>
                  <span className="xs:hidden">Export</span>
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <CreditCard className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="ml-2 sm:ml-3 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{payments.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <div className="p-1.5 sm:p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                      <Clock className="h-4 w-4 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="ml-2 sm:ml-3 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Attente</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{pendingVerifications}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <Check className="h-4 w-4 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="ml-2 sm:ml-3 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Vérifiés</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {payments.filter(p => ['completed', 'verified'].includes(p.status)).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <X className="h-4 w-4 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="ml-2 sm:ml-3 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Rejetés</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
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
                <div className="flex flex-col gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Rechercher par nom, email ou ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full"
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col xs:flex-row gap-2 xs:gap-4">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full xs:w-[140px] sm:w-[180px]">
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
                      <SelectTrigger className="w-full xs:w-[140px] sm:w-[180px]">
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
                </div>
              </CardContent>
            </Card>

            {/* Payments Table */}
            <Card className="overflow-hidden">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Paiements ({filteredPayments.length})</CardTitle>
                <CardDescription className="text-sm">
                  Liste de tous les paiements avec leurs détails et statuts
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden">
                {loading ? (
                  <div className="text-center py-8">Chargement...</div>
                ) : (
                  <div className="w-full overflow-hidden">
                    <Table className="w-full sm:table-auto table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[45%] sm:w-auto">Utilisateur</TableHead>
                          <TableHead className="hidden sm:table-cell">Méthode</TableHead>
                          <TableHead className="hidden md:table-cell">Type</TableHead>
                          <TableHead className="hidden sm:table-cell">Montant</TableHead>
                          <TableHead className="w-[25%] sm:w-auto">Statut</TableHead>
                          <TableHead className="hidden lg:table-cell">Date</TableHead>
                          <TableHead className="w-[30%] sm:w-auto">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="p-1 sm:p-4">
                              <div className="flex items-start gap-1 min-w-0 w-full">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => router.push(`/admin/users/${payment.userId}`)}
                                  className="p-0.5 h-auto flex-shrink-0 mt-0.5"
                                >
                                  <User className="h-3 w-3" />
                                </Button>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <div className="font-medium text-xs truncate">{payment.user.name}</div>
                                  <div className="text-xs text-gray-500 truncate">{payment.user.email}</div>
                                  <div className="flex flex-wrap gap-0.5 mt-0.5 sm:hidden">
                                    <span className="text-xs px-1 py-0.5 bg-green-100 dark:bg-green-900/30 rounded text-green-600 dark:text-green-400 truncate">
                                      {payment.amount} {payment.currency}
                                    </span>
                                    <span className="text-xs px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400 truncate">
                                      {getMethodLabel(payment.method)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell p-2 sm:p-4">
                              <div className="flex items-center gap-2 min-w-0">
                                {getMethodIcon(payment.method)}
                                <span className="text-xs sm:text-sm truncate">{getMethodLabel(payment.method)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell p-2 sm:p-4">
                              <Badge variant="outline" className="text-xs truncate">
                                {payment.subscriptionType === 'annual' ? 'Annuel' : 'Semestriel'}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-xs sm:text-sm p-2 sm:p-4">
                              <div className="truncate">{payment.amount} {payment.currency}</div>
                            </TableCell>
                            <TableCell className="p-1 sm:p-4">
                              <Badge className={`${getStatusColor(payment.status)} text-xs w-full justify-center truncate`}>
                                <span className="truncate">{payment.status}</span>
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell p-2 sm:p-4">
                              <div className="flex items-center gap-1 text-xs sm:text-sm min-w-0">
                                <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="truncate">{new Date(payment.createdAt).toLocaleDateString()}</span>
                              </div>
                            </TableCell>
                            <TableCell className="p-1 sm:p-4">
                              <div className="flex flex-col gap-1 w-full">
                                {/* View proof button for custom payments */}
                                {payment.method === 'custom_payment' && payment.proofImageUrl && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedPayment(payment);
                                      setIsProofDialogOpen(true);
                                    }}
                                    className="px-2 py-1 text-xs h-7 w-full sm:w-auto"
                                  >
                                    <Eye className="h-3 w-3" />
                                    <span className="ml-1">Voir preuve</span>
                                  </Button>
                                )}
                                
                                {/* Verification buttons for pending custom payments only */}
                                {payment.method === 'custom_payment' && (payment.status === 'awaiting_verification' || payment.status === 'pending') && (
                                  <div className="flex gap-1 w-full">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleVerifyPayment(payment.id, 'verify')}
                                      className="text-green-600 hover:text-green-700 border-green-600 px-2 py-1 text-xs h-7 flex-1"
                                    >
                                      <Check className="h-3 w-3" />
                                      <span className="ml-1 hidden xs:inline">Accepter</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleVerifyPayment(payment.id, 'reject')}
                                      className="text-red-600 hover:text-red-700 border-red-600 px-2 py-1 text-xs h-7 flex-1"
                                    >
                                      <X className="h-3 w-3" />
                                      <span className="ml-1 hidden xs:inline">Refuser</span>
                                    </Button>
                                  </div>
                                )}
                                
                                {/* Status display for completed states */}
                                {payment.status === 'completed' && (
                                  <div className="text-xs text-green-600 text-center py-2 bg-green-50 dark:bg-green-900/20 rounded">
                                    ✓ Payé
                                  </div>
                                )}
                                {payment.status === 'verified' && (
                                  <div className="text-xs text-green-600 text-center py-2 bg-green-50 dark:bg-green-900/20 rounded">
                                    ✓ Vérifié
                                  </div>
                                )}
                                {['failed', 'rejected', 'cancelled'].includes(payment.status) && (
                                  <div className="text-xs text-red-600 text-center py-2 bg-red-50 dark:bg-red-900/20 rounded">
                                    ✗ Rejeté
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Proof Dialog */}
            <Dialog open={isProofDialogOpen} onOpenChange={setIsProofDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">Preuve de paiement</DialogTitle>
                  <DialogDescription className="text-sm sm:text-base">
                    Vérifiez la preuve de paiement soumise par l'utilisateur
                  </DialogDescription>
                </DialogHeader>
                
                {selectedPayment && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="text-sm font-medium">Utilisateur</label>
                        <p className="text-sm break-words">{selectedPayment.user.name} ({selectedPayment.user.email})</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Montant</label>
                        <p className="text-sm">{selectedPayment.amount} {selectedPayment.currency}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Type d'abonnement</label>
                        <p className="text-sm">{selectedPayment.subscriptionType === 'annual' ? 'Annuel' : 'Semestriel'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Date</label>
                        <p className="text-sm">{new Date(selectedPayment.createdAt).toLocaleString()}</p>
                      </div>
                    </div>

                    {selectedPayment.customPaymentDetails && (
                      <div>
                        <label className="text-sm font-medium">Détails du paiement</label>
                        <p className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm text-gray-900 dark:text-gray-100">
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

                    <div className="flex flex-col xs:flex-row gap-2 pt-4">
                      <Button
                        onClick={() => handleVerifyPayment(selectedPayment.id, 'verify')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-sm"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        <span className="hidden xs:inline">Vérifier et Approuver</span>
                        <span className="xs:hidden">Approuver</span>
                      </Button>
                      <Button
                        onClick={() => handleVerifyPayment(selectedPayment.id, 'reject')}
                        variant="destructive"
                        className="flex-1 text-sm"
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
