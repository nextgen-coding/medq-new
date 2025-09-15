"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { PlusCircle, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { UniversalHeader } from '@/components/layout/UniversalHeader';
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SessionSpecialtyCard } from '@/components/session/SessionSpecialtyCard';
import { ManageSessionsDialog } from '@/components/session/ManageSessionsDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Semester, Niveau } from '@/types';

type Specialty = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  iconType?: string;
  imageUrl?: string;
  semester?: { id: string; name: string; order: number };
  niveau?: { id: string; name: string };
  niveauId?: string;
  semesterId?: string;
  _count?: { sessions: number };
};

export default function SessionsPage() {
  const { user, isAdmin } = useAuth();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [filteredSpecialties, setFilteredSpecialties] = useState<Specialty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [niveauFilter, setNiveauFilter] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [updatingSpecialtyId, setUpdatingSpecialtyId] = useState<string | null>(null);

  // Filter and sort specialties when data changes
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

    // Sort alphabetically
    const sorted = filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    setFilteredSpecialties(sorted);
  }, [specialties, searchQuery]);

  // Load semesters and niveaux for admin filtering
  useEffect(() => {
    const loadFilters = async () => {
      if (!isAdmin) return;
      
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
    
    loadFilters();
  }, [isAdmin]);

  const fetchSpecialties = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      
      if (isAdmin) {
        if (niveauFilter && niveauFilter !== 'all') params.set('niveau', niveauFilter);
        if (semesterFilter && semesterFilter !== 'all') params.set('semester', semesterFilter);
      }
      
      const response = await fetch(`/api/specialties/with-sessions${params.toString() ? `?${params.toString()}` : ''}`, {
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      
      if (!response.ok) {
        throw new Error('Impossible de récupérer les sessions');
      }
      
      const data = await response.json();
      setSpecialties(data || []);
      setFilteredSpecialties(data || []);
    } catch (error) {
      console.error('Échec du chargement des spécialités:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors du chargement des sessions.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, niveauFilter, semesterFilter]);

  useEffect(() => {
    if (user) {
      fetchSpecialties();
    }
  }, [user, fetchSpecialties]);

  const handleAddSession = useCallback(() => {
    // TODO: Implement add session dialog
    toast({
      title: "Fonctionnalité à venir",
      description: "L'ajout de sessions sera disponible prochainement.",
    });
  }, []);

  const handleEditSession = useCallback((specialty: Specialty) => {
    setSelectedSpecialty(specialty);
    setIsManageDialogOpen(true);
  }, []);

  const handleSessionsChanged = useCallback(async () => {
    // Refresh the entire specialty list to update session counts
    await fetchSpecialties(true);
  }, [fetchSpecialties]);

  const handleDeleteSession = useCallback(async (specialty: Specialty) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer toutes les sessions de ${specialty.name} ?`)) return;
    
    setUpdatingSpecialtyId(specialty.id);
    
    try {
      // Optimistically update the UI first
      const originalSpecialties = [...specialties];
      const updatedSpecialties = specialties.map(s => 
        s.id === specialty.id 
          ? { ...s, _count: { ...s._count, sessions: 0 } }
          : s
      );
      setSpecialties(updatedSpecialties);
      
      const response = await fetch(`/api/sessions/by-specialty/${specialty.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Revert the optimistic update if the request failed
        setSpecialties(originalSpecialties);
        throw new Error('Impossible de supprimer les sessions');
      }

      const result = await response.json();
      
      // Refresh the data to ensure consistency
      await fetchSpecialties(true);
      
      toast({
        title: "Succès",
        description: result.message || `Toutes les sessions de ${specialty.name} ont été supprimées.`,
      });
    } catch (error) {
      console.error('Error deleting sessions:', error);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de la suppression.",
        variant: "destructive",
      });
    } finally {
      setUpdatingSpecialtyId(null);
    }
  }, [specialties, fetchSpecialties]);

  // Memoize the specialties list to prevent unnecessary re-renders
  const memoizedSpecialties = useMemo(() => {
    return [...filteredSpecialties].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [filteredSpecialties]);

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <div className="flex h-screen w-full overflow-hidden">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col overflow-hidden">
            {/* Universal Header with title and search only */}
            <UniversalHeader
              title="Sessions"
              showSearch={true}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Rechercher des sessions..."
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
                      onClick={handleAddSession}
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Ajouter une session
                    </Button>
                  </div>
                )}

                {/* Sessions Grid */}
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
                      <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {searchQuery ? 'Aucune session trouvée' : 'Aucune session disponible'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      {searchQuery 
                        ? `Aucune session ne correspond à "${searchQuery}". Essayez un autre terme de recherche.`
                        : 'Les sessions d\'exercices apparaîtront ici une fois disponibles.'
                      }
                    </p>
                    {searchQuery && (
                      <Button variant="outline" onClick={() => setSearchQuery('')}>
                        Effacer la recherche
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {memoizedSpecialties.map((specialty) => (
                      <SessionSpecialtyCard
                        key={specialty.id}
                        specialty={specialty}
                        onEdit={isAdmin ? () => handleEditSession(specialty) : undefined}
                        onDelete={isAdmin ? () => handleDeleteSession(specialty) : undefined}
                        isUpdating={updatingSpecialtyId === specialty.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SidebarInset>
        </div>
      </AppSidebarProvider>

      <ManageSessionsDialog
        isOpen={isManageDialogOpen}
        onOpenChange={setIsManageDialogOpen}
        specialty={selectedSpecialty}
        onSessionsChanged={handleSessionsChanged}
      />
    </ProtectedRoute>
  );
}
