'use client';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { BookOpen, Search, X, PlusCircle, Save, Edit2, Trash, Loader2 } from 'lucide-react';
import { SpecialtyIconPicker, getSpecialtyIcon } from '@/components/admin/SpecialtyIconPicker';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface Specialty { id: string; name: string; description?: string | null; icon?: string | null; isFree?: boolean; }

export default function AdminManagementPage() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsFree, setNewIsFree] = useState(false);
  const [newIcon, setNewIcon] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsFree, setEditIsFree] = useState(false);
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/specialties?t=' + Date.now(), { cache: 'no-store' as RequestCache });
      if (!res.ok) throw new Error('load');
      const data = await res.json();
      setSpecialties(data || []);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: 'Impossible de charger les spécialités', variant: 'destructive' });
    } finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); }, [load]);

  const filtered = specialties.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
  });

  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          <div className="space-y-8">
            <div className="flex flex-wrap gap-4 justify-between items-start">
              <div className="flex-1 min-w-[280px] text-left">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
                  <BookOpen className="w-9 h-9 text-white" />
                </div>
                <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Gestion des spécialités</h1>
                <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">Créez et gérez les spécialités médicales, organisez leurs cours et administrez les questions d'évaluation.</p>
              </div>
              <div className="flex gap-3 items-center ml-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                  <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher une spécialité..." className="pl-10 pr-8 w-72 border-blue-200 focus:border-blue-400 focus:ring-blue-400/20" />
                  {search && <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-950/30" onClick={()=>setSearch('')}><X className="h-3 w-3" /></Button>}
                </div>
                <Button onClick={()=>setShowCreate(v=>!v)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 px-6"><PlusCircle className="h-4 w-4" /> {showCreate ? 'Fermer' : 'Nouvelle spécialité'}</Button>
              </div>
            </div>

            {showCreate && (
              <Card className="border-dashed border-blue-300 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <PlusCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-blue-900 dark:text-blue-100">Créer une nouvelle spécialité</CardTitle>
                      <CardDescription>Définissez les informations de base de la spécialité médicale.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Nom de la spécialité *</label>
                      <Input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Ex: Cardiologie, Neurologie..." className="border-blue-200 focus:border-blue-400 focus:ring-blue-400/20" />
                    </div>
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <SpecialtyIconPicker value={newIcon || undefined} onChange={v=>setNewIcon(v)} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Description</label>
                      <textarea value={newDescription} onChange={e=>setNewDescription(e.target.value)} rows={3} className="w-full rounded-md border border-blue-200 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/20 focus-visible:border-blue-400" placeholder="Description détaillée de la spécialité..." />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                    <input id="isFreeNew" type="checkbox" checked={newIsFree} onChange={e=>setNewIsFree(e.target.checked)} className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500" />
                    <label htmlFor="isFreeNew" className="text-sm font-medium text-blue-700 dark:text-blue-300">Contenu gratuit pour tous les utilisateurs</label>
                  </div>
                  <div className="flex justify-end gap-3 pt-2 border-t border-blue-100">
                    <Button variant="outline" size="sm" onClick={()=>{ setShowCreate(false); setNewName(''); setNewDescription(''); setNewIsFree(false); }} className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">Annuler</Button>
                    <Button size="sm" disabled={creating || !newName.trim()} onClick={async()=>{
                      if(!newName.trim()) return; setCreating(true); try { const res = await fetch('/api/specialties',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:newName.trim(), description:newDescription.trim()||null, isFree:newIsFree, icon:newIcon })}); if(!res.ok) throw new Error('create'); toast({ title:'✅ Spécialité créée', description:'La nouvelle spécialité a été ajoutée avec succès' }); setNewName(''); setNewDescription(''); setNewIsFree(false); setNewIcon(null); setShowCreate(false); load(); } catch(e){ console.error(e); toast({ title:'Erreur', description:"Impossible de créer la spécialité", variant:'destructive'});} finally { setCreating(false);} }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-2">{creating && <Loader2 className="h-4 w-4 animate-spin" />}<Save className="h-4 w-4" />Créer la spécialité</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-lg border-blue-100">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-blue-900 dark:text-blue-100">Spécialités médicales ({filtered.length})</CardTitle>
                    <CardDescription>Sélectionnez une spécialité pour gérer ses cours et questions.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      <p className="text-base text-blue-600 font-medium">Chargement des spécialités...</p>
                    </div>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Aucune spécialité trouvée</h3>
                    <p className="text-muted-foreground mb-4">Commencez par créer votre première spécialité médicale.</p>
                    <Button onClick={()=>setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Créer une spécialité
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map(s => {
                      const isEditing = editingId === s.id;
                      return (
                        <div key={s.id} className="group border border-blue-100 rounded-xl p-6 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200 bg-gradient-to-br from-white to-blue-50/20 dark:from-background dark:to-blue-950/10 relative">
                          {!isEditing && (
                            <>
                              <Link href={`/admin/management/${s.id}`} className="block">
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-lg">
                                    {getSpecialtyIcon(s.icon)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-lg mb-1 truncate text-blue-900 dark:text-blue-100" title={s.name}>{s.name}</h3>
                                    {s.isFree && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full mb-2">
                                        ✓ Gratuit
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-3 min-h-[60px] leading-relaxed" title={s.description || undefined}>{s.description || 'Aucune description disponible'}</p>
                                <div className="mt-4 flex items-center text-sm text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                                  Gérer les cours 
                                  <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                                </div>
                              </Link>
                              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="outline" className="h-8 w-8 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30" onClick={()=>{ setEditingId(s.id); setEditName(s.name); setEditDescription(s.description||''); setEditIsFree(!!s.isFree); setEditIcon(s.icon||null); }}><Edit2 className="h-4 w-4" /></Button>
                                <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30" disabled={deletingId===s.id} onClick={()=> setPendingDeleteId(s.id)}>
                                  {deletingId===s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                                </Button>
                              </div>
                            </>
                          )}
                          {isEditing && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Nom de la spécialité *</label>
                                <Input value={editName} onChange={e=>setEditName(e.target.value)} className="border-blue-200 focus:border-blue-400 focus:ring-blue-400/20" />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Description</label>
                                <textarea value={editDescription} onChange={e=>setEditDescription(e.target.value)} rows={3} className="w-full rounded-md border border-blue-200 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/20 focus-visible:border-blue-400" />
                              </div>
                              <div className="space-y-2">
                                <SpecialtyIconPicker value={editIcon || undefined} onChange={v=>setEditIcon(v)} />
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                                <input id={`free-${s.id}`} type="checkbox" className="h-4 w-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500" checked={editIsFree} onChange={e=>setEditIsFree(e.target.checked)} />
                                <label htmlFor={`free-${s.id}`} className="text-sm font-medium text-blue-700 dark:text-blue-300">Contenu gratuit</label>
                              </div>
                              <div className="flex justify-end gap-2 pt-2 border-t border-blue-100">
                                <Button size="sm" variant="outline" onClick={()=>{ setEditingId(null); }} className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">Annuler</Button>
                                <Button size="sm" disabled={savingEdit || !editName.trim()} onClick={async()=>{ if(!editName.trim()) return; setSavingEdit(true); try { const res = await fetch('/api/specialties',{ method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:s.id, name:editName.trim(), description: editDescription.trim()||null, isFree: editIsFree, icon: editIcon })}); if(!res.ok) throw new Error('upd'); toast({ title:'✅ Spécialité modifiée', description:'Les modifications ont été sauvegardées'}); setEditingId(null); load(); } catch(e){ console.error(e); toast({ title:'Erreur', description:'Impossible de sauvegarder les modifications', variant:'destructive'});} finally { setSavingEdit(false);} }} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">{savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}<Save className="h-4 w-4" /> Sauvegarder</Button>
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
          title="Supprimer la spécialité ?"
          description="Cette action est définitive. Vous ne pouvez pas supprimer une spécialité qui contient des cours."
          confirmText="Supprimer"
          cancelText="Annuler"
          onConfirm={async()=>{ const id = pendingDeleteId; if(!id) return; setDeletingId(id); try { const res = await fetch(`/api/specialties?id=${id}`,{ method:'DELETE'}); if(!res.ok) throw new Error('del'); // optimistic removal
            setSpecialties(prev=> prev.filter(s=>s.id!==id));
            toast({ title:'Supprimé', description:'Spécialité supprimée'}); // refresh in background to stay in sync
            load();
          } catch(e){ console.error(e); toast({ title:'Erreur', description:'Suppression impossible (cours existants ?)', variant:'destructive'});} finally { setDeletingId(null); setPendingDeleteId(null);} }}
        />
      </AdminRoute>
    </ProtectedRoute>
  );
}
