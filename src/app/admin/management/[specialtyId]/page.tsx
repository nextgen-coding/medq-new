'use client';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { BookOpen, ArrowLeft, PlusCircle, Search, X, Edit2, Trash, Save, Loader2 } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';

interface Lecture { id: string; title: string; description?: string | null; isFree?: boolean; }
interface Specialty { id: string; name: string; description?: string | null; }

export default function AdminManagementSpecialtyPage() {
  const params = useParams<{ specialtyId: string }>();
  const specialtyId = params?.specialtyId as string; // Next 15: params is a promise-like; use hook
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingSpec, setLoadingSpec] = useState(true);
  const [createVisible, setCreateVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsFree, setNewIsFree] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsFree, setEditIsFree] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const loadSpecialty = useCallback(async () => {
    try {
      setLoadingSpec(true);
      const res = await fetch(`/api/specialties/${specialtyId}`);
      if (!res.ok) throw new Error('spec');
      const data = await res.json();
      setSpecialty(data);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: 'Spécialité introuvable', variant: 'destructive' });
    } finally { setLoadingSpec(false); }
  }, [specialtyId]);

  const loadLectures = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/lectures?specialtyId=${specialtyId}&` + Date.now());
      if (!res.ok) throw new Error('lectures');
      const data = await res.json();
      setLectures(data);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: 'Impossible de charger les cours', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [specialtyId]);

  useEffect(() => { loadSpecialty(); loadLectures(); }, [loadSpecialty, loadLectures]);

  const filtered = lectures.filter(l => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return l.title?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q);
  });

  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          <div className="space-y-8">
            <div className="flex items-start flex-wrap gap-6">
              <Link href="/admin/management" className="inline-flex"><Button variant="outline" className="gap-2 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-300"><ArrowLeft className="h-4 w-4" /> Retour</Button></Link>
              <div className="flex-1 min-w-[280px]">
                {loadingSpec ? (
                  <div className="flex items-center gap-4 mb-4">
                    <Skeleton className="w-16 h-16 rounded-2xl" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-6 w-64" />
                      <Skeleton className="h-4 w-96" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20"><BookOpen className="w-8 h-8 text-white" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent truncate" title={specialty?.name}>{specialty?.name || 'Spécialité'}</h1>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">{lectures.length} cours</Badge>
                      </div>
                      {specialty?.description && <p className="text-base text-muted-foreground line-clamp-2 leading-relaxed" title={specialty.description}>{specialty.description}</p>}
                    </div>
                  </div>
                )}
                <p className="text-base text-muted-foreground">Gérez les cours de cette spécialité et administrez leurs questions d'évaluation.</p>
              </div>
              <div className="ml-auto flex gap-3 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                  <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un cours..." className="pl-10 pr-8 w-72 border-blue-200 focus:border-blue-400 focus:ring-blue-400/20" />
                  {search && <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-950/30" onClick={()=>setSearch('')}><X className="h-3 w-3" /></Button>}
                </div>
                <Button onClick={()=>setCreateVisible(v=>!v)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 px-6"><PlusCircle className="h-4 w-4 mr-2" />{createVisible ? 'Fermer' : 'Nouveau cours'}</Button>
              </div>
            </div>

            {createVisible && (
              <Card className="border-dashed border-blue-300 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <PlusCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-blue-900 dark:text-blue-100">Créer un nouveau cours</CardTitle>
                      <CardDescription>Ajoutez un cours à cette spécialité médicale.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Titre du cours *</label>
                      <Input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Ex: Physiologie cardiaque, Anatomie..." className="border-blue-200 focus:border-blue-400 focus:ring-blue-400/20" />
                    </div>
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Description</label>
                      <Input value={newDescription} onChange={e=>setNewDescription(e.target.value)} placeholder="Description du contenu du cours" className="border-blue-200 focus:border-blue-400 focus:ring-blue-400/20" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                    <input id="isFreeLecture" type="checkbox" className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500" checked={newIsFree} onChange={e=>setNewIsFree(e.target.checked)} />
                    <label htmlFor="isFreeLecture" className="text-sm font-medium text-blue-700 dark:text-blue-300">Cours gratuit et accessible à tous</label>
                  </div>
                  <div className="flex justify-end gap-3 pt-2 border-t border-blue-100">
                    <Button variant="outline" size="sm" onClick={()=>{ setCreateVisible(false); setNewTitle(''); setNewDescription(''); setNewIsFree(false); }} className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">Annuler</Button>
                    <Button size="sm" disabled={creating || !newTitle.trim()} onClick={async()=>{ if(!newTitle.trim()) return; setCreating(true); try { const res = await fetch('/api/lectures',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title:newTitle.trim(), description:newDescription.trim()||null, specialtyId, isFree:newIsFree })}); if(!res.ok) throw new Error('create-lecture'); toast({ title:'✅ Cours créé', description:'Le nouveau cours a été ajouté avec succès'}); setNewTitle(''); setNewDescription(''); setNewIsFree(false); setCreateVisible(false); loadLectures(); } catch(e){ console.error(e); toast({ title:'Erreur', description:'Impossible de créer le cours', variant:'destructive'});} finally { setCreating(false);} }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-2">{creating && <Loader2 className="h-4 w-4 animate-spin" />}<Save className="h-4 w-4" />Créer le cours</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            <Card className="shadow-lg border-blue-100 relative overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-blue-900 dark:text-blue-100">Cours disponibles ({filtered.length})</CardTitle>
                    <CardDescription>Sélectionnez un cours pour gérer ses questions d'évaluation.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_,i)=>(
                      <div key={i} className="border border-blue-100 rounded-xl p-6 space-y-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <BookOpen className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Aucun cours trouvé</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Créez votre premier cours pour commencer à ajouter des questions d'évaluation.</p>
                    <Button onClick={()=>setCreateVisible(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Créer un cours
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map(l => {
                      const isEditing = editingId === l.id;
                      return (
                        <div key={l.id} className="group border border-blue-100 rounded-xl p-6 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200 bg-gradient-to-br from-white to-blue-50/20 dark:from-background dark:to-blue-950/10 relative">
                          {!isEditing && (
                            <>
                              <Link href={`/admin/management/${specialtyId}/courses/${l.id}`} className="block">
                                <div className="mb-3">
                                  <h3 className="font-semibold text-lg mb-2 truncate text-blue-900 dark:text-blue-100" title={l.title}>{l.title}</h3>
                                  {l.isFree && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full mb-2">
                                      ✓ Gratuit
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-3 min-h-[60px] leading-relaxed mb-4" title={l.description || undefined}>{l.description || 'Aucune description disponible'}</p>
                                <div className="flex items-center text-sm text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                                  Gérer les questions 
                                  <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                                </div>
                              </Link>
                              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="outline" className="h-8 w-8 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30" onClick={()=>{ setEditingId(l.id); setEditTitle(l.title); setEditDescription(l.description||''); setEditIsFree(!!l.isFree); }}><Edit2 className="h-4 w-4" /></Button>
                                <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30" disabled={deletingId===l.id} onClick={()=> setPendingDeleteId(l.id)}>
                                  {deletingId===l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                                </Button>
                              </div>
                            </>
                          )}
                          {isEditing && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Titre du cours *</label>
                                <Input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="border-blue-200 focus:border-blue-400 focus:ring-blue-400/20" />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Description</label>
                                <textarea value={editDescription} onChange={e=>setEditDescription(e.target.value)} rows={3} className="w-full rounded-md border border-blue-200 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/20 focus-visible:border-blue-400" />
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                                <input id={`free-course-${l.id}`} type="checkbox" className="h-4 w-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500" checked={editIsFree} onChange={e=>setEditIsFree(e.target.checked)} />
                                <label htmlFor={`free-course-${l.id}`} className="text-sm font-medium text-blue-700 dark:text-blue-300">Cours gratuit</label>
                              </div>
                              <div className="flex justify-end gap-2 pt-2 border-t border-blue-100">
                                <Button size="sm" variant="outline" onClick={()=>setEditingId(null)} className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">Annuler</Button>
                                <Button size="sm" disabled={savingEdit || !editTitle.trim()} onClick={async()=>{ if(!editTitle.trim()) return; setSavingEdit(true); try { const res = await fetch(`/api/lectures/${l.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title:editTitle.trim(), description:editDescription.trim()||null, specialtyId, isFree: editIsFree })}); if(!res.ok) throw new Error('update-lecture'); toast({ title:'✅ Cours modifié', description:'Les modifications ont été sauvegardées'}); setEditingId(null); loadLectures(); } catch(e){ console.error(e); toast({ title:'Erreur', description:'Impossible de sauvegarder les modifications', variant:'destructive'});} finally { setSavingEdit(false);} }} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">{savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}<Save className="h-4 w-4" /> Sauvegarder</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </AdminLayout>
        <ConfirmationDialog
          isOpen={!!pendingDeleteId}
          onOpenChange={(open)=>{ if(!open) setPendingDeleteId(null); }}
          title="Supprimer le cours ?"
          description="Cette action supprime aussi toutes les questions de ce cours. Opération irréversible."
          confirmText="Supprimer"
          cancelText="Annuler"
          onConfirm={async()=>{ const id = pendingDeleteId; if(!id) return; setDeletingId(id); try { const res = await fetch(`/api/lectures/${id}`, { method:'DELETE'}); if(!res.ok) throw new Error('del-lecture'); toast({ title:'Supprimé', description:'Cours supprimé'}); loadLectures(); } catch(e){ console.error(e); toast({ title:'Erreur', description:'Suppression impossible', variant:'destructive'});} finally { setDeletingId(null); setPendingDeleteId(null);} }}
        />
      </AdminRoute>
    </ProtectedRoute>
  );
}
