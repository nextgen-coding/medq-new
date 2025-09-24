import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { 
  Search, 
  Filter, 
  User, 
  Shield, 
  Calendar,
  Activity,
  Flag,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name?: string;
  role: 'student' | 'maintainer' | 'admin';
  status: string;
  createdAt: string;
  updatedAt: string;
  emailVerified?: string;
  _count: {
    progress: number;
    reports: number;
  };
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function UsersTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'createdAt' | 'email' | 'role'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const navigateToUser = (userId: string) => {
    router.push(`/admin/users/${userId}`);
  };

  const fetchUsers = async (page = 1, searchTerm = search, role = roleFilter) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(role && role !== 'all' && { role })
      });

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) {
        throw new Error('Impossible de charger les utilisateurs');
      }

      const data = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: t('common.error', { defaultValue: 'Erreur' }),
        description: t('admin.errorFetchingUsers', { defaultValue: 'Erreur lors du chargement des utilisateurs' }),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchUsers(1, search, roleFilter);
  };

  const handleRoleFilter = (role: string) => {
    setRoleFilter(role);
    setCurrentPage(1);
    fetchUsers(1, search, role);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchUsers(page, search, roleFilter);
  };

  const handleRoleChange = async (userId: string, newRole: 'student' | 'maintainer' | 'admin') => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Échec de la mise à jour du rôle');
      }

      const updatedUser = await response.json();
      setUsers(prev => prev.map(user => 
        user.id === userId ? updatedUser : user
      ));

      toast({
        title: t('admin.roleUpdated', { defaultValue: 'Rôle mis à jour' }),
        description: t('admin.roleUpdatedSuccess', { defaultValue: "Le rôle de l’utilisateur {{email}} est maintenant {{role}}", email: updatedUser.email, role: newRole }),
      });
    } catch (error: unknown) {
      console.error('Error updating user role:', error);
      toast({
        title: t('common.error', { defaultValue: 'Erreur' }),
        description: (error instanceof Error ? error.message : String(error)) || t('admin.errorUpdatingRole'),
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role: string) => {
    return role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="space-y-6 sm:space-y-8 animate-fade-in">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="h-9 sm:h-10 w-48 sm:w-64 bg-muted/50 rounded-xl animate-pulse" />
          <div className="h-9 sm:h-10 w-40 sm:w-48 bg-muted/50 rounded-xl animate-pulse" />
          <div className="h-9 sm:h-10 w-28 sm:w-32 bg-muted/50 rounded-xl animate-pulse" />
        </div>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 sm:h-32 rounded-xl border border-border/60 bg-background/40 backdrop-blur animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Search and Filters */}
      <Card className="rounded-2xl border border-border/60 bg-background/60 backdrop-blur shadow-sm">
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold tracking-tight">
            <User className="h-5 w-5 text-blue-600" />
            <span className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">{t('admin.manageUsers', { defaultValue: 'Gérer les utilisateurs' })}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 lg:items-end">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.searchUsers', { defaultValue: 'Rechercher des utilisateurs…' })}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9 sm:pl-10 rounded-xl bg-background/50"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={handleRoleFilter}>
              <SelectTrigger className="w-full lg:w-52 rounded-xl bg-background/50">
                <SelectValue placeholder={t('admin.filterByRole', { defaultValue: 'Filtrer par rôle' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.allRoles', { defaultValue: 'Tous les rôles' })}</SelectItem>
                <SelectItem value="student">{t('admin.students', { defaultValue: 'Étudiants' })}</SelectItem>
                <SelectItem value="maintainer">{t('admin.maintainers', { defaultValue: 'Mainteneurs' })}</SelectItem>
                <SelectItem value="admin">{t('admin.admins', { defaultValue: 'Admins' })}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} className="w-full lg:w-auto rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700">
              {t('common.search', { defaultValue: 'Rechercher' })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table / Mobile List */}
      <Card className="rounded-2xl border border-border/60 bg-background/60 backdrop-blur overflow-hidden">
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center">
              <User className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3" />
              <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">{t('admin.noUsersFound')}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
                {search || roleFilter !== 'all' ? t('admin.noUsersMatchFilters') : t('admin.noUsersYet')}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: stacked list */}
              <div className="md:hidden divide-y divide-border">
                {users.map((user) => (
                  <div key={user.id} className="p-3 sm:p-4 space-y-2 sm:space-y-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium leading-tight text-sm truncate">{user.name || user.email}</div>
                        {user.name && (
                          <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
                        )}
                      </div>
                      <div className="flex flex-col xs:flex-row items-end xs:items-center gap-1 xs:gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <Badge className={`${getRoleColor(user.role)} border-none font-medium rounded-full px-2 py-0.5 text-[9px] xs:text-[10px]`}> 
                            {user.role === 'admin' ? (
                              <Shield className="h-2.5 w-2.5 xs:h-3 xs:w-3 mr-0.5 xs:mr-1" />
                            ) : (
                              <User className="h-2.5 w-2.5 xs:h-3 xs:w-3 mr-0.5 xs:mr-1" />
                            )}
                            {user.role}
                          </Badge>
                          <Badge className={`${getStatusColor(user.status)} border-none font-medium rounded-full px-2 py-0.5 text-[9px] xs:text-[10px]`}> 
                            {user.status}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigateToUser(user.id)}
                          className="h-7 w-7 xs:h-8 xs:w-8 p-0 hover:bg-medblue-100 hover:text-medblue-700"
                        >
                          <ChevronRight className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] xs:text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3 xs:h-4 xs:w-4" />
                        <span>{user._count.progress}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Flag className="h-3 w-3 xs:h-4 xs:w-4" />
                        <span>{user._count.reports}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 xs:h-4 xs:w-4" />
                        <span className="hidden xs:inline">{formatDate(user.createdAt)}</span>
                        <span className="xs:hidden">{new Date(user.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Select
                        value={user.role}
                        onValueChange={(value: 'student' | 'maintainer' | 'admin') => handleRoleChange(user.id, value)}
                      >
                        <SelectTrigger className="w-32 xs:w-40 rounded-xl bg-background/50 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {t('admin.student')}
                            </div>
                          </SelectItem>
                          <SelectItem value="maintainer">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {t('admin.maintainer', { defaultValue: 'Maintainer' })}
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              {t('admin.admin')}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="text-xs sm:text-sm">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-semibold uppercase tracking-wide text-[10px] sm:text-xs text-muted-foreground">{t('admin.user')}</TableHead>
                      <TableHead className="font-semibold uppercase tracking-wide text-[10px] sm:text-xs text-muted-foreground">{t('admin.role')}</TableHead>
                      <TableHead className="font-semibold uppercase tracking-wide text-[10px] sm:text-xs text-muted-foreground">{t('admin.status')}</TableHead>
                      <TableHead className="font-semibold uppercase tracking-wide text-[10px] sm:text-xs text-muted-foreground hidden lg:table-cell">{t('admin.progress')}</TableHead>
                      <TableHead className="font-semibold uppercase tracking-wide text-[10px] sm:text-xs text-muted-foreground hidden lg:table-cell">{t('admin.reports')}</TableHead>
                      <TableHead className="font-semibold uppercase tracking-wide text-[10px] sm:text-xs text-muted-foreground hidden xl:table-cell">{t('admin.joined')}</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wide text-[10px] sm:text-xs text-muted-foreground">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="min-w-0">
                          <div className="font-medium leading-tight text-sm sm:text-base truncate">{user.name || user.email}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{user.email}</div>
                          <div className="flex items-center gap-2 mt-1 lg:hidden">
                            <div className="flex items-center gap-1 text-[9px]">
                              <Activity className="h-3 w-3 text-muted-foreground" />
                              <span>{user._count.progress}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[9px]">
                              <Flag className="h-3 w-3 text-muted-foreground" />
                              <span>{user._count.reports}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getRoleColor(user.role)} border-none font-medium rounded-full px-2 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px]`}> 
                          {user.role === 'admin' ? (
                            <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                          ) : (
                            <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                          )}
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(user.status)} border-none font-medium rounded-full px-2 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px]`}> 
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <span>{user._count.progress}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs">
                          <Flag className="h-4 w-4 text-muted-foreground" />
                          <span>{user._count.reports}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDate(user.createdAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <Select
                            value={user.role}
                            onValueChange={(value: 'student' | 'maintainer' | 'admin') => handleRoleChange(user.id, value)}
                          >
                            <SelectTrigger className="w-24 sm:w-28 lg:w-32 rounded-xl bg-background/50 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="student">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  {t('admin.student')}
                                </div>
                              </SelectItem>
                              <SelectItem value="maintainer">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  {t('admin.maintainer', { defaultValue: 'Maintainer' })}
                                </div>
                              </SelectItem>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  {t('admin.admin')}
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigateToUser(user.id)}
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-medblue-50 rounded-full"
                          >
                            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-medblue-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={!pagination.hasPrev ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => handlePageChange(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handlePageChange(currentPage + 1)}
                  className={!pagination.hasNext ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Results Summary */}
      {pagination && (
        <div className="text-center text-[11px] sm:text-xs text-muted-foreground">
          {t('admin.showingResults', { 
            from: ((currentPage - 1) * pagination.limit) + 1,
            to: Math.min(currentPage * pagination.limit, pagination.totalCount),
            total: pagination.totalCount
          })}
        </div>
      )}
    </div>
  );
}