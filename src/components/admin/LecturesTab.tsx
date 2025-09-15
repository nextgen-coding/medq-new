'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Search, X } from 'lucide-react';
import { Lecture } from '@/types';
import { LectureItem } from './LectureItem';
import { CreateLectureDialog } from '@/components/lectures/CreateLectureDialog';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';

export function LecturesTab() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [filteredLectures, setFilteredLectures] = useState<Lecture[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { t } = useTranslation();

  // Filter lectures based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredLectures(lectures);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = lectures.filter(lecture => 
        lecture?.title?.toLowerCase().includes(query) ||
        lecture?.description?.toLowerCase().includes(query) ||
        lecture?.specialty?.name?.toLowerCase().includes(query)
      );
      setFilteredLectures(filtered);
    }
  }, [lectures, searchQuery]);

  const clearSearch = () => {
    setSearchQuery('');
  };

  useEffect(() => {
    fetchLectures();
  }, []);

  const fetchLectures = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/lectures?' + new Date().getTime()); // Cache busting
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched lectures:', data.length, 'items');
        setLectures(data);
        setFilteredLectures(data); // Initialize filtered lectures
      } else {
        console.error('Failed to fetch lectures');
        toast({
          title: t('common.error'),
          description: t('common.tryAgain'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching lectures:', error);
      toast({
        title: t('common.error'),
        description: t('common.tryAgain'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLecture = (id: string) => {
    setLectures(prev => prev.filter(l => l.id !== id));
  };

  const handleLectureCreated = () => {
    setRefreshKey(prev => prev + 1);
    fetchLectures();
  };

  const handleLectureUpdated = () => {
    console.log('handleLectureUpdated called in LecturesTab');
    setRefreshKey(prev => prev + 1);
    fetchLectures();
  };
  
  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end gap-4 sm:gap-6 justify-between">
        <div className="flex-1 space-y-1 sm:space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">{t('admin.manageLectures')}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {searchQuery ? 
                `Showing ${filteredLectures.length} of ${lectures.length} lectures` : 
                `${lectures.length} lectures total`}
            </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center w-full sm:w-auto">
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search lectures..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 sm:pl-10 pr-9 sm:pr-10 w-full sm:w-72 h-10 sm:h-11 rounded-xl bg-background/60 backdrop-blur border border-border/60 focus-visible:ring-blue-500"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="h-10 sm:h-11 rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 shadow-md hover:shadow-lg transition-all"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            {t('admin.addLecture')}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl border border-border/60 bg-background/40 backdrop-blur p-4 sm:p-5 animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-br from-muted/30 to-transparent" />
              <div className="relative space-y-3 sm:space-y-4">
                <div className="h-5 w-3/4 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-5/6 bg-muted rounded" />
                <div className="h-8 sm:h-9 w-28 bg-muted rounded" />
              </div>
            </div>
          ))
        ) : filteredLectures.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 sm:p-12 text-center bg-background/40 backdrop-blur">
            {searchQuery ? (
              <>
                <h3 className="text-base sm:text-lg font-semibold mb-2">No lectures found</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4 max-w-md">
                  No lectures match "{searchQuery}". Try a different search term.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSearch}
                  className="rounded-full"
                >
                  Clear search
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-base sm:text-lg font-semibold mb-2">{t('admin.noLecturesAvailable')}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
                  {t('admin.addLecture')}
                </p>
              </>
            )}
          </div>
        ) : filteredLectures.map((lecture) => (
          <LectureItem
            key={`${lecture.id}-${refreshKey}`}
            lecture={lecture}
            onDelete={handleDeleteLecture}
            onUpdate={handleLectureUpdated}
          />
        ))}
      </div>

      <CreateLectureDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onLectureCreated={handleLectureCreated}
      />
    </div>
  );
}
