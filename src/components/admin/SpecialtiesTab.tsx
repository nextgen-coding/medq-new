'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Search, X } from 'lucide-react';
import { Specialty } from '@/types';
import { SpecialtyItem } from './SpecialtyItem';
import { CreateSpecialtyDialog } from '@/components/specialties/CreateSpecialtyDialog';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';

export function SpecialtiesTab() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [filteredSpecialties, setFilteredSpecialties] = useState<Specialty[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key
  const { t } = useTranslation();

  // Filter specialties based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSpecialties(specialties);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = specialties.filter(specialty => 
        specialty?.name?.toLowerCase().includes(query) ||
        specialty?.description?.toLowerCase().includes(query) ||
        specialty?.niveau?.name?.toLowerCase().includes(query)
      );
      setFilteredSpecialties(filtered);
    }
  }, [specialties, searchQuery]);

  const clearSearch = () => {
    setSearchQuery('');
  };

  useEffect(() => {
    fetchSpecialties();
  }, []);

  const fetchSpecialties = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/specialties?' + new Date().getTime()); // Cache busting
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched specialties:', data.length, 'items'); // Debug log
        console.log('First specialty:', data[0]); // Debug log
        setSpecialties(data);
        setFilteredSpecialties(data); // Initialize filtered specialties
      } else {
        console.error('Failed to fetch specialties');
        toast({
          title: t('common.error'),
          description: t('common.tryAgain'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching specialties:', error);
      toast({
        title: t('common.error'),
        description: t('common.tryAgain'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSpecialty = (id: string) => {
    setSpecialties(prev => prev.filter(s => s.id !== id));
  };

  const handleSpecialtyCreated = () => {
    setRefreshKey(prev => prev + 1); // Force refresh
    fetchSpecialties();
  };

  const handleSpecialtyUpdated = () => {
    console.log('handleSpecialtyUpdated called in SpecialtiesTab'); // Debug log
    setRefreshKey(prev => prev + 1); // Force refresh
    fetchSpecialties();
  };
  
  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Modern Header / Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 sm:gap-6 justify-between">
        <div className="flex-1">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">{t('admin.manageSpecialties')}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {searchQuery ? 
              `Showing ${filteredSpecialties.length} of ${specialties.length} specialties` : 
              `${specialties.length} specialties total`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center w-full sm:w-auto">
          {/* Modern Search Bar */}
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search specialties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 sm:pl-11 pr-9 sm:pr-11 w-full sm:w-80 h-10 sm:h-11 rounded-xl border-border focus:border-blue-500 focus:ring-blue-500 bg-background shadow-sm"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100 rounded-full"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="h-10 sm:h-11 px-5 sm:px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            {t('specialties.addSpecialty')}
          </Button>
        </div>
      </div>
      
      {/* Modern Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="border-0 shadow-lg bg-card rounded-2xl p-5 sm:p-6 animate-pulse">
              <div className="space-y-3 sm:space-y-4">
                <div className="h-5 w-3/4 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-5/6 bg-muted rounded" />
                <div className="h-8 sm:h-9 w-24 sm:w-28 bg-muted rounded" />
              </div>
            </div>
          ))
        ) : filteredSpecialties.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-8 sm:p-12 text-center bg-card">
            {searchQuery ? (
              <>
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Search className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">No specialties found</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 max-w-md">
                  No specialties match "{searchQuery}". Try a different search term.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSearch}
                  className="border-border text-foreground hover:bg-muted rounded-lg"
                >
                  Clear search
                </Button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <PlusCircle className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">{t('admin.noSpecialtiesAvailable')}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
                  {t('specialties.addSpecialty')}
                </p>
              </>
            )}
          </div>
        ) : filteredSpecialties.map((specialty) => (
          <SpecialtyItem
            key={`${specialty.id}-${refreshKey}`}
            specialty={specialty}
            onDelete={handleDeleteSpecialty}
            onUpdate={handleSpecialtyUpdated}
          />
        ))}
      </div>

      <CreateSpecialtyDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSpecialtyCreated={handleSpecialtyCreated}
      />
    </div>
  );
}
