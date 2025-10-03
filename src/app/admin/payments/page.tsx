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
  Clock,
  FileText,
  Mail,
  Link
} from 'lucide-react';

interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  method: 'konnect_gateway' | 'voucher_code' | 'custom_payment' | 'activation_key' | 'autre_payment';
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
    phone?: string;
  };
  voucherCode?: {
    code: string;
  };
  activationKey?: string;
  isBuyingKey?: boolean;
  metadata?: {
    linkSent?: boolean;
    linkSentAt?: string;
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
    case 'activation_key':
      return <Gift className="h-4 w-4" />;
    case 'autre_payment':
      return <FileText className="h-4 w-4" />;
    default:
      return null;
  }
};

const getMethodLabel = (method: string) => {
  switch (method) {
    case 'konnect_gateway':
      return 'Paiement en ligne';
    case 'voucher_code':
      return 'Clé d\'activation';
    case 'custom_payment':
      return 'Paiement personnalisé';
    case 'activation_key':
      return 'Clé d\'activation';
    case 'autre_payment':
      return 'Autre méthode';
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
  const [isSendLinkDialogOpen, setIsSendLinkDialogOpen] = useState(false);
  const [isSendKeyDialogOpen, setIsSendKeyDialogOpen] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');
  const [activationKey, setActivationKey] = useState('');
  
  // Generate activation key
  const generateActivationKey = (subscriptionType: 'semester' | 'annual') => {
    const prefix = subscriptionType === 'annual' ? 'MEDQ-Y' : 'MEDQ-S'
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `${prefix}-${randomStr}`
  }
  
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

      const data = await response.json();

      toast({
        title: 'Succès',
        description: action === 'verify' 
          ? `Paiement vérifié. Une clé d'activation a été générée et envoyée à l'utilisateur par email.`
          : 'Paiement rejeté avec succès',
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

  const handleSendPaymentLink = async (paymentId: string) => {
    if (!paymentLink.trim()) {
      toast({
        title: 'Erreur',
        description: 'Veuillez entrer un lien de paiement',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/send-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentLink: paymentLink.trim() }),
      });

      if (!response.ok) throw new Error('Failed to send payment link');

      toast({
        title: 'Succès',
        description: 'Lien de paiement envoyé avec succès',
        variant: 'default',
      });

      setIsSendLinkDialogOpen(false);
      setPaymentLink('');
      setSelectedPayment(null);
      fetchPayments(); // Refresh to update the link sent status
    } catch (error) {
      console.error('Error sending payment link:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer le lien de paiement',
        variant: 'destructive',
      });
    }
  };

  const handleSendActivationKey = async (paymentId: string) => {
    if (!activationKey.trim()) {
      toast({
        title: 'Erreur',
        description: 'Veuillez générer une clé d\'activation',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/send-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activationKey }),
      });

      if (!response.ok) throw new Error('Failed to send activation key');

      toast({
        title: 'Succès',
        description: 'Clé d\'activation générée et envoyée avec succès',
        variant: 'default',
      });

      setIsSendKeyDialogOpen(false);
      setActivationKey('');
      setSelectedPayment(null);
      fetchPayments(); // Refresh to update status
    } catch (error) {
      console.error('Error sending activation key:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer la clé d\'activation',
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
                        <SelectItem value="voucher_code">Clé d'activation</SelectItem>
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
                          <TableHead className="hidden lg:table-cell">Téléphone</TableHead>
                          <TableHead className="hidden sm:table-cell">Méthode</TableHead>
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
                                  className="p-0.5 h-auto flex-shrink-0 mt-0.5 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  title="Voir le profil utilisateur"
                                >
                                  <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                </Button>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <button
                                    onClick={() => router.push(`/admin/users/${payment.userId}`)}
                                    className="font-medium text-xs truncate text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer text-left w-full"
                                    title="Cliquez pour voir le profil"
                                  >
                                    {payment.user.name}
                                  </button>
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
                            <TableCell className="hidden lg:table-cell p-2 sm:p-4">
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {payment.user.phone || 'Non renseigné'}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell p-2 sm:p-4">
                              <div className="flex items-center gap-2 min-w-0">
                                {getMethodIcon(payment.method)}
                                <span className="text-xs sm:text-sm truncate">{getMethodLabel(payment.method)}</span>
                              </div>
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
                                {/* View proof button for custom and autre payments */}
                                {(payment.method === 'custom_payment' || payment.method === 'autre_payment') && payment.proofImageUrl && (
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
                                
                                {/* Verification buttons for pending payments */}
                                {(payment.method === 'custom_payment' || payment.method === 'autre_payment' || payment.method === 'konnect_gateway') && (payment.status === 'awaiting_verification' || payment.status === 'pending') && (
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
                                
                                {/* Action buttons for key purchases */}
                                {payment.isBuyingKey && payment.method === 'konnect_gateway' && (payment.status === 'pending' || payment.status === 'awaiting_verification') && (
                                  <>
                                    {payment.metadata?.linkSent ? (
                                      <div className="text-xs text-blue-600 text-center py-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                                        ✓ Lien envoyé
                                        {payment.metadata?.linkSentAt && (
                                          <div className="text-[10px] text-gray-500 mt-0.5">
                                            {new Date(payment.metadata.linkSentAt).toLocaleDateString('fr-FR', {
                                              day: '2-digit',
                                              month: 'short',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedPayment(payment);
                                          setIsSendLinkDialogOpen(true);
                                        }}
                                        className="px-2 py-1 text-xs h-7 w-full"
                                      >
                                        <Link className="h-3 w-3 mr-1" />
                                        Envoyer lien paiement
                                      </Button>
                                    )}
                                  </>
                                )}
                                
                                {/* Status display for completed states */}                                {/* Status display for completed states */}
                                {payment.status === 'completed' && (
                                  <div className="text-xs text-green-600 text-center py-2 bg-green-50 dark:bg-green-900/20 rounded">
                                    ✓ Payé
                                  </div>
                                )}
                                {payment.status === 'verified' && (
                                  <div className="flex flex-col gap-1">
                                    <div className="text-xs text-green-600 text-center py-2 bg-green-50 dark:bg-green-900/20 rounded">
                                      ✓ Vérifié
                                    </div>
                                    {payment.activationKey && (
                                      <div className="text-xs text-blue-600 text-center py-1 px-2 bg-blue-50 dark:bg-blue-900/20 rounded font-mono">
                                        Clé: {payment.activationKey}
                                      </div>
                                    )}
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
                        <div className="text-sm break-words">
                          <Button
                            variant="link"
                            onClick={() => router.push(`/admin/users/${selectedPayment.userId}`)}
                            className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {selectedPayment.user.name}
                          </Button>
                          {' '}({selectedPayment.user.email})
                        </div>
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

                    {selectedPayment.activationKey && (
                      <div>
                        <label className="text-sm font-medium">Clé d'activation générée</label>
                        <p className="mt-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800 text-sm font-mono text-blue-600 dark:text-blue-400">
                          {selectedPayment.activationKey}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Cette clé a été envoyée à l'utilisateur par email
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

            {/* Send Payment Link Dialog */}
            <Dialog open={isSendLinkDialogOpen} onOpenChange={setIsSendLinkDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg">Envoyer un lien de paiement</DialogTitle>
                  <DialogDescription className="text-sm">
                    Envoyez un lien de paiement privé à l'utilisateur pour compléter sa commande de clé d'activation
                  </DialogDescription>
                </DialogHeader>
                
                {selectedPayment && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Utilisateur</label>
                      <div className="text-sm break-words">
                        <Button
                          variant="link"
                          onClick={() => router.push(`/admin/users/${selectedPayment.userId}`)}
                          className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {selectedPayment.user.name}
                        </Button>
                        {' '}({selectedPayment.user.email})
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="paymentLink" className="text-sm font-medium">Lien de paiement</label>
                      <Input
                        id="paymentLink"
                        value={paymentLink}
                        onChange={(e) => setPaymentLink(e.target.value)}
                        placeholder="https://..."
                        className="mt-1"
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => handleSendPaymentLink(selectedPayment.id)}
                        className="flex-1"
                        disabled={!paymentLink.trim()}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Envoyer
                      </Button>
                      <Button
                        onClick={() => {
                          setIsSendLinkDialogOpen(false);
                          setPaymentLink('');
                          setSelectedPayment(null);
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Send Activation Key Dialog */}
            <Dialog open={isSendKeyDialogOpen} onOpenChange={(open) => {
              setIsSendKeyDialogOpen(open);
              if (!open) {
                setActivationKey('');
                setSelectedPayment(null);
              } else if (selectedPayment) {
                // Auto-generate key when dialog opens
                const generatedKey = generateActivationKey(selectedPayment.subscriptionType);
                setActivationKey(generatedKey);
              }
            }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg">Envoyer une clé d'activation</DialogTitle>
                  <DialogDescription className="text-sm">
                    Une clé d'activation sera générée automatiquement pour cet abonnement
                  </DialogDescription>
                </DialogHeader>
                
                {selectedPayment && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Utilisateur</label>
                      <div className="text-sm break-words">
                        <Button
                          variant="link"
                          onClick={() => router.push(`/admin/users/${selectedPayment.userId}`)}
                          className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {selectedPayment.user.name}
                        </Button>
                        {' '}({selectedPayment.user.email})
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Clé d'activation générée</label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={activationKey}
                          readOnly
                          className="font-mono text-center bg-gray-50"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newKey = generateActivationKey(selectedPayment.subscriptionType);
                            setActivationKey(newKey);
                          }}
                          title="Régénérer la clé"
                        >
                          🔄
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Cette clé sera envoyée par email et permettra à l'utilisateur d'activer son abonnement
                      </p>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => handleSendActivationKey(selectedPayment.id)}
                        className="flex-1"
                        disabled={!activationKey.trim()}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Envoyer par email
                      </Button>
                      <Button
                        onClick={() => {
                          setIsSendKeyDialogOpen(false);
                          setActivationKey('');
                          setSelectedPayment(null);
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Annuler
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
