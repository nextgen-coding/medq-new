"use client";
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Search, X, ChevronRight, Edit, Trash2, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Specialty, Lecture } from '@/types';
import { toast } from '@/hooks/use-toast';
import { CreateSpecialtyDialog } from '@/components/specialties/CreateSpecialtyDialog';
import { EditSpecialtyDialog } from '@/components/specialties/EditSpecialtyDialog';
import { CreateLectureDialog } from '@/components/lectures/CreateLectureDialog';
import { EditLectureDialog } from '@/components/lectures/EditLectureDialog';
import { QuestionManagementDialog } from '@/components/questions/QuestionManagementDialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMedicalIcon } from '@/lib/medical-icons';

// DEPRECATED: Replaced by dedicated route pages under
// /admin/management, /admin/management/[specialtyId], and
// /admin/management/[specialtyId]/courses/[lectureId].
// Keep temporarily for reference until all legacy modal code is removed.
export function ManagementTab({ initialSpecialtyId }: { initialSpecialtyId?: string } = {}) {
  // Specialties state
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(true);
  const [openCreateSpecialty, setOpenCreateSpecialty] = useState(false);
  const [editSpecialty, setEditSpecialty] = useState<Specialty | null>(null);

  // Lectures state for selected specialty
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [lectureSearch, setLectureSearch] = useState('');
  const [isLoadingLectures, setIsLoadingLectures] = useState(false);
  const [openCreateLecture, setOpenCreateLecture] = useState(false);
  const [editLecture, setEditLecture] = useState<Lecture | null>(null);

  // Questions state for selected lecture
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [openQuestions, setOpenQuestions] = useState(false);
  const [openOrganizer, setOpenOrganizer] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    (async () => {
      await fetchSpecialties();
      if (initialSpecialtyId) {
        const found = specialties.find(s => s.id === initialSpecialtyId);
        if (found) {
          handleSelectSpecialty(found);
        } else {
          // try fetch lectures anyway to reflect selection when list updates
          await fetchLectures(initialSpecialtyId);
        }
      }
    })();
    // We intentionally exclude specialties from deps to avoid rerun after set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpecialtyId]);

  const fetchSpecialties = async () => {
    try {
      setIsLoadingSpecialties(true);
      const res = await fetch('/api/specialties?' + Date.now());
      if (!res.ok) throw new Error('Failed to fetch specialties');
      const data = await res.json();
      setSpecialties(data);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load specialties', variant: 'destructive' });
    } finally {
      setIsLoadingSpecialties(false);
    }
  };

  const filteredSpecialties = useMemo(() => {
    const q = specialtySearch.trim().toLowerCase();
    if (!q) return specialties;
    return specialties.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.niveau?.name?.toLowerCase().includes(q)
    );
  }, [specialties, specialtySearch]);

  const handleSelectSpecialty = async (s: Specialty) => {
    setSelectedSpecialty(s);
    setSelectedLecture(null);
    setOpenQuestions(false);
    await fetchLectures(s.id);
  };

  const fetchLectures = async (specialtyId: string) => {
    try {
      setIsLoadingLectures(true);
      const res = await fetch(`/api/lectures?specialtyId=${specialtyId}&` + Date.now());
      if (!res.ok) throw new Error('Failed to fetch lectures');
      const data = await res.json();
      setLectures(data);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load lectures', variant: 'destructive' });
    } finally {
      setIsLoadingLectures(false);
    }
  };

  const filteredLectures = useMemo(() => {
    const q = lectureSearch.trim().toLowerCase();
    if (!q) return lectures;
    return lectures.filter(l =>
      l.title?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q)
    );
  }, [lectures, lectureSearch]);

  const handleDeleteSpecialty = async (specialty: Specialty) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Specialty',
      description: `Are you sure you want to delete "${specialty.name}"? This will permanently delete all its courses and questions. This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/specialties/${specialty.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete specialty');
          
          toast({ title: 'Success', description: 'Specialty deleted successfully' });
          await fetchSpecialties();
          
          // If the deleted specialty was selected, clear selection
          if (selectedSpecialty?.id === specialty.id) {
            setSelectedSpecialty(null);
            setLectures([]);
          }
        } catch (e) {
          console.error(e);
          toast({ title: 'Error', description: 'Failed to delete specialty', variant: 'destructive' });
        }
      }
    });
  };

  const handleDeleteLecture = async (lecture: Lecture) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Course',
      description: `Are you sure you want to delete "${lecture.title}"? This will permanently delete all its questions. This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/lectures/${lecture.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete lecture');
          
          toast({ title: 'Success', description: 'Course deleted successfully' });
          if (selectedSpecialty) {
            await fetchLectures(selectedSpecialty.id);
          }
        } catch (e) {
          console.error(e);
          toast({ title: 'Error', description: 'Failed to delete course', variant: 'destructive' });
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Specialties section */}
      <Card className="border-blue-200/50 dark:border-blue-900/40">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div>
              <CardTitle className="text-blue-700 dark:text-blue-400">Specialties</CardTitle>
              <CardDescription className="text-blue-700/70 dark:text-blue-300/70">Pick a specialty to manage its courses and questions</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500/70" />
                <Input value={specialtySearch} onChange={e=>setSpecialtySearch(e.target.value)} placeholder="Search specialties..." className="pl-10 pr-8 w-64 border-blue-200 focus-visible:ring-blue-500 dark:border-blue-800" />
                {specialtySearch && (
                  <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-blue-600" onClick={()=>setSpecialtySearch('')}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Button onClick={()=>setOpenCreateSpecialty(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <PlusCircle className="h-4 w-4 mr-2" /> New Specialty
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingSpecialties ? (
            <p className="text-sm text-muted-foreground">Loading specialties...</p>
          ) : filteredSpecialties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No specialties</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredSpecialties.map(s => {
                const mi = getMedicalIcon(s.icon);
                const Icon = mi.icon;
                return (
          <div key={s.id} className={`group border rounded-xl p-4 hover:border-blue-300/70 hover:shadow-sm transition ${selectedSpecialty?.id === s.id ? 'border-blue-500 ring-1 ring-blue-200' : 'border-blue-100 dark:border-blue-900/40'}`}>
                    <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mi.color} ${mi.darkColor} bg-opacity-15 ring-1 ring-blue-200/50`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={()=>handleSelectSpecialty(s)}>
                        <div className="font-semibold truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{s.description || '—'}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 cursor-pointer" onClick={()=>handleSelectSpecialty(s)} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditSpecialty(s)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteSpecialty(s)} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lectures section (conditional) */}
      {selectedSpecialty && (
        <Card className="border-blue-200/50 dark:border-blue-900/40">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
              <div>
                <CardTitle className="text-blue-700 dark:text-blue-400">Courses in {selectedSpecialty.name}</CardTitle>
                <CardDescription className="text-blue-700/70 dark:text-blue-300/70">Manage courses and open questions modal</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500/70" />
                  <Input value={lectureSearch} onChange={e=>setLectureSearch(e.target.value)} placeholder="Search courses..." className="pl-10 pr-8 w-64 border-blue-200 focus-visible:ring-blue-500 dark:border-blue-800" />
                  {lectureSearch && (
                    <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-blue-600" onClick={()=>setLectureSearch('')}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Button onClick={()=>setOpenCreateLecture(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                  <PlusCircle className="h-4 w-4 mr-2" /> New Course
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingLectures ? (
              <p className="text-sm text-muted-foreground">Loading courses...</p>
            ) : filteredLectures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courses</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredLectures.map(l => (
                  <div key={l.id} className="border rounded-xl p-4 border-blue-100 dark:border-blue-900/40">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{l.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{l.description || '—'}</div>
                      </div>
                      <div className="flex items-center gap-1 ml-3">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => { setSelectedLecture(l); setOpenQuestions(true); }} 
                          className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                        >
                          Questions
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => { setSelectedLecture(l); setOpenOrganizer(true); setOpenQuestions(true); }} 
                          className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                        >
                          Organiser
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditLecture(l)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteLecture(l)} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateSpecialtyDialog isOpen={openCreateSpecialty} onOpenChange={setOpenCreateSpecialty} onSpecialtyCreated={fetchSpecialties} />
      {editSpecialty && (
        <EditSpecialtyDialog specialty={editSpecialty} isOpen={!!editSpecialty} onOpenChange={(o)=>!o && setEditSpecialty(null)} onSpecialtyUpdated={fetchSpecialties} />
      )}
      <CreateLectureDialog 
        isOpen={openCreateLecture} 
        onOpenChange={setOpenCreateLecture} 
        onLectureCreated={() => selectedSpecialty && fetchLectures(selectedSpecialty.id)}
        preselectedSpecialty={selectedSpecialty || undefined}
      />
      {editLecture && (
        <EditLectureDialog 
          lecture={editLecture} 
          isOpen={!!editLecture} 
          onOpenChange={(o)=>!o && setEditLecture(null)} 
          onLectureUpdated={() => selectedSpecialty && fetchLectures(selectedSpecialty.id)}
        />
      )}
      {selectedLecture && (
        <QuestionManagementDialog 
          lecture={selectedLecture} 
          isOpen={openQuestions} 
          onOpenChange={(o)=>{ setOpenQuestions(o); if(!o) setOpenOrganizer(false); }}
          initialOrganizerOpen={openOrganizer}
        />
      )}
      
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
