'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { UniversalHeader } from '@/components/layout/UniversalHeader';
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { ExerciseCard } from '@/components/exercices/ExerciseCard';
import { Button } from '@/components/ui/button';
import { Specialty, Semester } from '@/types';
import { toast } from '@/hooks/use-toast';
import { CreateSpecialtyDialog } from '@/components/specialties/CreateSpecialtyDialog';
import { EditSpecialtyDialog } from '@/components/specialties/EditSpecialtyDialog';
import { UpsellBanner } from '@/components/subscription/UpsellBanner';
import { UpgradeDialog } from '@/components/subscription/UpgradeDialog';
import { useTranslation } from 'react-i18next';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PlusCircle, Pin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Niveau } from '@/types';

// Disable static generation to prevent SSR issues with useAuth
export const dynamic = 'force-dynamic';

// Cache for specialties data
let specialtiesCache: Specialty[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function MatieresPage() {
  const { user, isAdmin } = useAuth();
  const { hasActiveSubscription } = useSubscription();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [filteredSpecialties, setFilteredSpecialties] = useState<Specialty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [niveauFilter, setNiveauFilter] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<string>('all'); // Only used by admins
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [isUpsellDismissed, setIsUpsellDismissed] = useState(false);
  const [pinnedSpecialties, setPinnedSpecialties] = useState<Set<string>>(new Set());
  const { t } = useTranslation();

  // Load pinned specialties from database on mount
  useEffect(() => {
    const loadPinnedSpecialties = async () => {
      if (!user?.id) return;
      
      try {
        const response = await fetch(`/api/pinned-specialties?userId=${user.id}`);
        if (response.ok) {
          const pinnedData = await response.json();
          const pinnedIds = new Set<string>(pinnedData.map((item: { specialtyId: string }) => item.specialtyId));
          setPinnedSpecialties(pinnedIds);
        } else {
          console.error('Failed to load pinned specialties from database');
        }
      } catch (error) {
        console.error('Error loading pinned specialties from database:', error);
      }
    };

    if (user?.id) {
      loadPinnedSpecialties();
    }
  }, [user?.id]);

  // Load semesters and niveaux for admin filtering
  useEffect(() => {
    const loadFilters = async () => {
      try {
        // Load semesters
        const semesterRes = await fetch('/api/semesters');
        if (semesterRes.ok) {
          const semesterData: Semester[] = await semesterRes.json();
          setSemesters(semesterData || []);
        }

        // Load niveaux
        const niveauRes = await fetch('/api/niveaux');
        if (niveauRes.ok) {
          const niveauData: Niveau[] = await niveauRes.json();
          setNiveaux(niveauData || []);
        }
      } catch (error) {
        console.error('Error loading filters:', error);
      }
    };
    
    if (user && isAdmin) loadFilters();
  }, [user, isAdmin]);

  // Pin/Unpin handlers - database only
  const handlePin = useCallback(async (specialty: Specialty) => {
    if (!user?.id) {
      toast({
        title: "Authentification requise",
        description: "Veuillez vous connecter pour épingler des matières.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await fetch('/api/pinned-specialties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          specialtyId: specialty.id,
        }),
      });

      if (response.ok) {
        setPinnedSpecialties(prev => {
          const newSet = new Set(prev);
          newSet.add(specialty.id);
          return newSet;
        });
        
        toast({
          title: "Matière épinglée",
          description: `${specialty.name} a été épinglée en haut.`,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Erreur",
          description: errorData.error || "Impossible d'épingler la matière.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error pinning specialty:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'épingler la matière. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  }, [user?.id]);

  const handleUnpin = useCallback(async (specialty: Specialty) => {
    if (!user?.id) {
      toast({
        title: "Authentification requise",
        description: "Veuillez vous connecter pour désépingler des matières.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/pinned-specialties?userId=${user.id}&specialtyId=${specialty.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPinnedSpecialties(prev => {
          const newSet = new Set(prev);
          newSet.delete(specialty.id);
          return newSet;
        });
        
        toast({
          title: "Matière désépinglée",
          description: `${specialty.name} a été désépinglée.`,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Erreur",
          description: errorData.error || "Impossible de désépingler la matière.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error unpinning specialty:', error);
      toast({
        title: "Erreur",
        description: "Impossible de désépingler la matière. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  }, [user?.id]);

  // Filter and sort specialties based on search query and pinned status
  useEffect(() => {
    let filtered = specialties;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = specialties.filter(specialty => 
        specialty?.name?.toLowerCase().includes(query) ||
        specialty?.description?.toLowerCase().includes(query) ||
        specialty?.niveau?.name?.toLowerCase().includes(query)
      );
    }

    // Sort by pinned status (pinned items first)
    const sorted = filtered.sort((a, b) => {
      const aPinned = pinnedSpecialties.has(a.id);
      const bPinned = pinnedSpecialties.has(b.id);
      
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      
      // If both pinned or both unpinned, sort alphabetically
      return (a.name || '').localeCompare(b.name || '');
    });

    setFilteredSpecialties(sorted);
  }, [specialties, searchQuery, pinnedSpecialties]);

  const fetchSpecialties = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (isAdmin) {
        if (niveauFilter && niveauFilter !== 'all') params.set('niveau', niveauFilter);
        if (semesterFilter && semesterFilter !== 'all') params.set('semester', semesterFilter);
      }
      
      const response = await fetch(`/api/specialties${params.toString() ? `?${params.toString()}` : ''}`, {
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      
      if (!response.ok) {
        throw new Error('Impossible de récupérer les matières');
      }
      
      const data = await response.json();
      console.log('Fetched specialties:', data); // Debug log
      setSpecialties(data || []);
      setFilteredSpecialties(data || []);
    } catch (error) {
      console.error('Error fetching specialties:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [t, niveauFilter, semesterFilter, isAdmin]);

  useEffect(() => {
    if (user) {
      fetchSpecialties();
    }
  }, [user, fetchSpecialties]);

  const handleAddSpecialty = useCallback(() => {
    setIsCreateDialogOpen(true);
  }, []);

  const handleEditSpecialty = useCallback((specialty: Specialty) => {
    setSelectedSpecialty(specialty);
    setIsEditDialogOpen(true);
  }, []);

  const handleDeleteSpecialty = useCallback(async (specialty: Specialty) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette matière ?')) return;
    
    try {
      const response = await fetch(`/api/specialties/${specialty.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Impossible de supprimer la matière');
      }

      setSpecialties(prev => prev.filter(s => s.id !== specialty.id));
      
      // Invalidate cache
      specialtiesCache = null;
      
      toast({
        title: "Succès",
        description: "Matière supprimée avec succès.",
      });
    } catch (error) {
      console.error('Error deleting specialty:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  }, [t]);

  const handleSpecialtyCreated = useCallback(() => {
    fetchSpecialties(true);
    setIsCreateDialogOpen(false);
  }, [fetchSpecialties]);

  const handleSpecialtyUpdated = useCallback(() => {
    // Clear cache and force refresh to show updated icons immediately
    specialtiesCache = null;
    fetchSpecialties(true);
    setIsEditDialogOpen(false);
  }, [fetchSpecialties]);

  // Memoize the specialties list to prevent unnecessary re-renders
  const memoizedSpecialties = useMemo(() => {
    // Always sort to ensure pinned items are first
    return [...filteredSpecialties].sort((a, b) => {
      const aPinned = pinnedSpecialties.has(a.id);
      const bPinned = pinnedSpecialties.has(b.id);
      
      // Pinned items always come first
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      
      // If both pinned or both unpinned, sort alphabetically
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [filteredSpecialties, pinnedSpecialties]);

  // Show upsell banner for free users who haven't dismissed it
  const shouldShowUpsell = !hasActiveSubscription && !isAdmin && !isUpsellDismissed;

  const handleUpgrade = () => {
    setIsUpgradeDialogOpen(true);
  };

  const handleUpgradeComplete = () => {
    setIsUpgradeDialogOpen(false);
    // Optionally refresh the page or update subscription status
  };

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <div className="flex h-screen w-full overflow-hidden">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col overflow-hidden">
            {/* Universal Header with title and search only */}
            <UniversalHeader
              title="Matières"
              showSearch={true}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Rechercher des matières..."
              searchAlign="right"
              graySearch
              searchWidthClass="max-w-xl md:max-w-4xl lg:max-w-5xl"
              hideSeparator
            />

            {/* Main Content */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Admin Filters and Controls - Not Sticky */}
                {isAdmin && (
                  <div className="flex items-center justify-end gap-3 mb-8">
                    {/* Niveau Filter */}
                    {niveaux.length > 0 && (
                      <Select value={niveauFilter} onValueChange={(v) => { 
                        setNiveauFilter(v); 
                        // Reset semester filter when niveau changes
                        if (v !== 'all') {
                          setSemesterFilter('all');
                        }
                        fetchSpecialties(true); 
                      }}>
                        <SelectTrigger className="w-[180px] bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 focus:ring-0 focus-visible:ring-0">
                          <SelectValue placeholder="Filtrer par niveau" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous les niveaux</SelectItem>
                          {niveaux.map((n) => (
                            <SelectItem key={n.id} value={n.id}>
                              {n.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    {/* Semester Filter */}
                    {semesters.length > 0 && (
                      <Select value={semesterFilter} onValueChange={(v) => { setSemesterFilter(v); fetchSpecialties(true); }}>
                        <SelectTrigger className="w-[180px] bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 focus:ring-0 focus-visible:ring-0">
                          <SelectValue placeholder="Filtrer par semestre" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous les semestres</SelectItem>
                          <SelectItem value="none">Aucun semestre</SelectItem>
                          {semesters
                            .filter(s => niveauFilter === 'all' || s.niveauId === niveauFilter)
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} {typeof s.order === 'number' ? `(S${s.order})` : ''}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    <Button 
                      onClick={handleAddSpecialty}
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Ajouter une matière
                    </Button>
                  </div>
                )}

                {/* Upsell Banner for Free Users */}
                {shouldShowUpsell && (
                  <div className="mb-8">
                    <UpsellBanner
                      onUpgrade={handleUpgrade}
                      onDismiss={() => setIsUpsellDismissed(true)}
                    />
                  </div>
                )}

                {/* Specialties Grid */}
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array(6).fill(0).map((_, i) => (
                      <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-8 animate-pulse">
                        <div className="flex flex-col items-center text-center mb-6">
                          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-xl mb-4" />
                          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2" />
                        </div>
                        <div className="space-y-2 mb-6">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                        </div>
                        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                      </div>
                    ))}
                  </div>
                ) : memoizedSpecialties.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <PlusCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {searchQuery ? 'Aucune matière trouvée' : 'Aucune matière disponible'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      {searchQuery 
                        ? `Aucune matière ne correspond à "${searchQuery}". Essayez un autre terme de recherche.`
                        : 'Commencez par ajouter votre première matière.'
                      }
                    </p>
                    {searchQuery && (
                      <Button variant="outline" onClick={() => setSearchQuery('')}>
                        Effacer la recherche
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Pinned Specialties Section */}
                    {memoizedSpecialties.some(s => pinnedSpecialties.has(s.id)) && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-1.5">
                            <Pin className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Matières épinglées
                          </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {memoizedSpecialties
                            .filter(specialty => pinnedSpecialties.has(specialty.id))
                            .map((specialty) => (
                              <ExerciseCard
                                key={specialty.id}
                                specialty={specialty}
                                onEdit={isAdmin ? handleEditSpecialty : undefined}
                                onDelete={isAdmin ? handleDeleteSpecialty : undefined}
                                isPinned={true}
                                onPin={handlePin}
                                onUnpin={handleUnpin}
                              />
                            ))
                          }
                        </div>
                      </div>
                    )}

                    {/* Regular Specialties Section */}
                    {memoizedSpecialties.some(s => !pinnedSpecialties.has(s.id)) && (
                      <div>
                        {memoizedSpecialties.some(s => pinnedSpecialties.has(s.id)) && (
                          <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              Toutes les matières
                            </h2>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {memoizedSpecialties
                            .filter(specialty => !pinnedSpecialties.has(specialty.id))
                            .map((specialty) => (
                              <ExerciseCard
                                key={specialty.id}
                                specialty={specialty}
                                onEdit={isAdmin ? handleEditSpecialty : undefined}
                                onDelete={isAdmin ? handleDeleteSpecialty : undefined}
                                isPinned={false}
                                onPin={handlePin}
                                onUnpin={handleUnpin}
                              />
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Dialogs */}
            <CreateSpecialtyDialog
              isOpen={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
              onSpecialtyCreated={handleSpecialtyCreated}
            />

            <EditSpecialtyDialog
              isOpen={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
              specialty={selectedSpecialty}
              onSpecialtyUpdated={handleSpecialtyUpdated}
            />

            <UpgradeDialog
              isOpen={isUpgradeDialogOpen}
              onOpenChange={setIsUpgradeDialogOpen}
              onUpgrade={handleUpgradeComplete}
            />
          </SidebarInset>
        </div>
      </AppSidebarProvider>
    </ProtectedRoute>
  );
}
