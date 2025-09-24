"use client";

import { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, RefreshCcw, PlusCircle, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface SessionItem {
  id: string;
  name: string;
  pdfUrl?: string | null;
  correctionUrl?: string | null;
  niveau?: { id: string; name: string } | null;
  semester?: { id: string; name: string; order: number } | null;
  specialty?: { id: string; name: string } | null;
  niveauId?: string | null;
  semesterId?: string | null;
  specialtyId?: string | null;
  createdAt: string;
}

interface SpecialtyItem {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  _count?: { sessions?: number };
}

import { getMedicalIcon, getIconBySpecialtyName } from '@/lib/medical-icons';
import { CorrectionZone } from '@/components/session/CorrectionZone';

export default function SessionsAdminPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; pdfUrl: string; correctionUrl: string; niveauId: string; semester: string; specialtyName: string }>({ name: '', pdfUrl: '', correctionUrl: '', niveauId: '', semester: '', specialtyName: '' });
  const [niveaux, setNiveaux] = useState<{ id: string; name: string }[]>([]);
  const [semesters, setSemesters] = useState<{ id: string; name: string; order: number; niveauId: string }[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([]);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string | null>(null);
  const [correctionSessionId, setCorrectionSessionId] = useState<string | null>(null);
  const selectedSpecialty = useMemo(() => specialties.find(s => s.id === selectedSpecialtyId) || null, [selectedSpecialtyId, specialties]);
  const sessionsCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.forEach(s => {
      const sid = s.specialtyId || s.specialty?.id;
      if (!sid) return;
      map[sid] = (map[sid] || 0) + 1;
    });
    return map;
  }, [sessions]);

  const load = async () => {
    setLoading(true);
    try {
      const [sessionsRes, niveauxRes, semestersRes, specialtiesRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/niveaux'),
        fetch('/api/semesters'),
        fetch('/api/specialties')
      ]);
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      if (niveauxRes.ok) setNiveaux(await niveauxRes.json());
      if (semestersRes.ok) setSemesters(await semestersRes.json());
      if (specialtiesRes.ok) setSpecialties(await specialtiesRes.json());
    } catch {
      toast({ title: 'Erreur', description: 'Chargement impossible', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => setForm({ name: '', pdfUrl: '', correctionUrl: '', niveauId: '', semester: '', specialtyName: selectedSpecialty?.name || '' });

  const handleCreate = async () => {
    if (!form.name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, pdfUrl: form.pdfUrl || undefined, correctionUrl: form.correctionUrl || undefined, niveauId: form.niveauId || undefined, semester: form.semester || undefined, specialtyName: form.specialtyName || undefined }) });
      if (!res.ok) {
        const txt = await res.text();
        toast({ title: 'Échec création', description: txt, variant: 'destructive' });
        return;
      }
      resetForm();
      toast({ title: 'Session créée', description: form.name });
  setShowForm(false); // auto-close after create
  load();
    } finally { setCreating(false); }
  };

  const startEdit = (s: SessionItem) => {
    setEditingId(s.id);
    setShowForm(true);
    setForm({ name: s.name, pdfUrl: s.pdfUrl || '', correctionUrl: s.correctionUrl || '', niveauId: s.niveau?.id || '', semester: s.semester ? String(s.semester.order) : '', specialtyName: s.specialty?.name || '' });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/sessions/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, pdfUrl: form.pdfUrl || undefined, correctionUrl: form.correctionUrl || undefined, niveauId: form.niveauId || undefined, semesterId: undefined, semester: form.semester || undefined, specialtyName: form.specialtyName || undefined }) });
    if (!res.ok) {
      const txt = await res.text();
      toast({ title: 'Échec modification', description: txt, variant: 'destructive' });
      return;
    }
    toast({ title: 'Session mise à jour', description: form.name });
    setEditingId(null);
    resetForm();
  setShowForm(false); // auto-close after update
  load();
  };

  const confirmDeleteSession = (s: SessionItem) => setConfirmDelete({ id: s.id, name: s.name });
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(confirmDelete.id);
    try {
      const res = await fetch(`/api/sessions/${confirmDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast({ title: 'Échec suppression', description: await res.text(), variant: 'destructive' });
        return;
      }
      toast({ title: 'Session supprimée', description: confirmDelete.name });
      setConfirmDelete(null);
      load();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de supprimer la session', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const visibleSessions = selectedSpecialtyId ? sessions.filter(s => s.specialtyId === selectedSpecialtyId || s.specialty?.id === selectedSpecialtyId) : sessions;

  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          <div className="space-y-4 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 sm:justify-between sm:items-start">
              <div className="flex-1 min-w-0 sm:min-w-[260px]">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Gestion des sessions</h1>
                {!selectedSpecialty && <p className="text-muted-foreground text-sm">Choisissez une spécialité pour gérer ses sessions.</p>}
                {selectedSpecialty && <p className="text-sm text-muted-foreground">Spécialité : <span className="font-medium text-blue-700 dark:text-blue-300">{selectedSpecialty.name}</span></p>}
              </div>
              <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto sm:ml-auto">
                {selectedSpecialty && (
                  <Button variant="outline" size="sm" onClick={() => { setSelectedSpecialtyId(null); setShowForm(false); setEditingId(null); setCorrectionSessionId(null); }} className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30">Retour</Button>
                )}
                <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-2">
                  <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> <span className="hidden xs:inline">Actualiser</span>
                </Button>
                {selectedSpecialty && (
                  <Button onClick={()=> setShowForm(v=>!v)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 shadow flex-1 xs:flex-initial">
                    {showForm ? <X className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                    <span className="xs:hidden">{editingId ? 'Modifier' : showForm ? 'Fermer' : 'Nouvelle'}</span>
                    <span className="hidden xs:inline">{editingId ? 'Modifier session' : showForm ? 'Fermer' : 'Nouvelle session'}</span>
                  </Button>
                )}
              </div>
            </div>

            {!selectedSpecialty && (
              <Card className="border-dashed border-blue-300 bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/30 dark:to-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-blue-800 dark:text-blue-100">Spécialités ({specialties.length})</CardTitle>
                  <CardDescription>Sélectionnez une spécialité pour voir et gérer ses sessions.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
                  ) : specialties.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">Aucune spécialité</div>
                  ) : (
                    <div className="grid gap-4 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {specialties.map(sp => {
                        const iconData = sp.icon ? getMedicalIcon(sp.icon) : getIconBySpecialtyName(sp.name);
                        const IconComp = iconData.icon;
                        let hash = 0; for (let i=0;i<sp.name.length;i++) hash = sp.name.charCodeAt(i) + ((hash<<5)-hash);
                        const gradients = ['from-blue-400 to-blue-500','from-emerald-400 to-emerald-500','from-medblue-400 to-medblue-500','from-orange-400 to-orange-500','from-rose-400 to-rose-500','from-cyan-400 to-cyan-500','from-lime-400 to-lime-500','from-fuchsia-400 to-fuchsia-500','from-indigo-400 to-indigo-500','from-teal-400 to-teal-500'];
                        const g = gradients[Math.abs(hash)%gradients.length];
                        const count = (sp as any)._count?.sessions ?? sessionsCountMap[sp.id] ?? 0;
                        return (
                          <button key={sp.id} onClick={()=>{ setSelectedSpecialtyId(sp.id); resetForm(); }} className="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 text-left transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/25">
                            <div className={`w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4 rounded-xl flex items-center justify-center bg-gradient-to-br ${g} border-2 border-white/20 shadow-lg group-hover:scale-105 transition-transform`}>
                              <IconComp className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 mb-1 text-sm sm:text-base">{sp.name}</h3>
                            {sp.description && <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2 sm:mb-3">{sp.description}</p>}
                            <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />{count} session{count>1?'s':''}
                              </span>
                              <span className="ml-auto text-blue-600 dark:text-blue-400 group-hover:underline">
                                <span className="hidden xs:inline">Gérer →</span>
                                <span className="xs:hidden">→</span>
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {selectedSpecialty && showForm && (
              <Card className="border-dashed border-blue-300 bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/30 dark:to-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-blue-800 dark:text-blue-100">{editingId ? 'Modifier la session' : 'Créer une nouvelle session'}</CardTitle>
                  <CardDescription>{editingId ? 'Mettre à jour les informations de la session.' : 'Définir les informations de la session.'}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 p-4 sm:p-6">
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Nom</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="border-blue-200 focus:border-blue-400 focus:ring-blue-400/20" />
                  </div>
                  <div className="space-y-1">
                    <Label>PDF (URL)</Label>
                    <Input value={form.pdfUrl} onChange={e => setForm(f => ({ ...f, pdfUrl: e.target.value }))} className="border-blue-200 focus:border-blue-400 focus:ring-blue-400/20" />
                  </div>
                  <div className="space-y-1">
                    <Label>Correction (URL)</Label>
                    <Input value={form.correctionUrl} onChange={e => setForm(f => ({ ...f, correctionUrl: e.target.value }))} className="border-blue-200 focus:border-blue-400 focus:ring-blue-400/20" />
                  </div>
                  <div className="space-y-1">
                    <Label>Niveau</Label>
                    <Select value={form.niveauId || 'none'} onValueChange={v => setForm(f => ({ ...f, niveauId: v === 'none' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {niveaux.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Semestre</Label>
                    <Select value={form.semester || 'none'} onValueChange={v => setForm(f => ({ ...f, semester: v === 'none' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {semesters.filter(s => !form.niveauId || s.niveauId === form.niveauId).map(s => <SelectItem key={s.id} value={String(s.order)}>S{s.order}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Spécialité</Label>
                    <Input value={form.specialtyName} disabled placeholder="Spécialité sélectionnée" className="border-blue-200 bg-muted/40" />
                  </div>
                  <div className="sm:col-span-2 flex flex-col xs:flex-row gap-2 justify-end pt-2 border-t border-blue-100">
                    {editingId && <Button variant="outline" size="sm" onClick={() => { setEditingId(null); resetForm(); }} className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 order-2 xs:order-1">Annuler</Button>}
                    {!editingId && <Button size="sm" onClick={handleCreate} disabled={!form.name || creating} className="bg-blue-600 hover:bg-blue-700 text-white gap-1 order-1 xs:order-2"><Plus className="h-4 w-4" /> Créer</Button>}
                    {editingId && <Button size="sm" onClick={handleUpdate} disabled={!form.name} className="bg-blue-600 hover:bg-blue-700 text-white order-1 xs:order-2">Enregistrer</Button>}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedSpecialty && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Sessions ({visibleSessions.length})</CardTitle>
                  <CardDescription>Spécialité : {selectedSpecialty.name}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead className="hidden sm:table-cell">Niveau</TableHead>
                        <TableHead className="hidden sm:table-cell">Semestre</TableHead>
                        <TableHead className="hidden md:table-cell">PDF</TableHead>
                        <TableHead className="hidden md:table-cell">Correction</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleSessions.map(s => (
                        <TableRow key={s.id} className={editingId === s.id ? 'bg-blue-50 dark:bg-blue-950/20' : ''}>
                          <TableCell className="font-medium">
                            <div className="min-w-0">
                              <div className="font-medium">{s.name}</div>
                              <div className="text-xs text-muted-foreground sm:hidden">
                                {s.niveau?.name && <span>{s.niveau.name}</span>}
                                {s.semester && <span>{s.niveau?.name ? ' • ' : ''}S{s.semester.order}</span>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{s.niveau?.name || '-'}</TableCell>
                          <TableCell className="hidden sm:table-cell">{s.semester ? `S${s.semester.order}` : '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">{s.pdfUrl ? 'Oui' : '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">{s.correctionUrl ? 'Oui' : '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="outline" size="sm" onClick={() => startEdit(s)} disabled={deleting === s.id} className="px-2">
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setCorrectionSessionId(correctionSessionId === s.id ? null : s.id)} 
                                className={`px-2 ${correctionSessionId === s.id ? 'bg-blue-600 text-white hover:bg-blue-600/90' : ''} hidden xs:flex`}
                                disabled={deleting === s.id}
                              >
                                <span className="text-xs">Corr.</span>
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => confirmDeleteSession(s)}
                                disabled={deleting === s.id}
                                className={`px-2 ${deleting === s.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {deleting === s.id ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {visibleSessions.length === 0 && !loading && (
                        <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Aucune session</TableCell></TableRow>
                      )}
                      {loading && (
                        <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Chargement…</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {correctionSessionId && (
                  <div className="border rounded-lg p-4 bg-white/60 dark:bg-muted/40 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-sm">Correction – {visibleSessions.find(s=>s.id===correctionSessionId)?.name}</h3>
                      <Button size="sm" variant="outline" onClick={()=> setCorrectionSessionId(null)}>Fermer</Button>
                    </div>
                    <CorrectionZone sessionId={correctionSessionId} mode="admin" />
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            <ConfirmationDialog
              isOpen={!!confirmDelete}
              onOpenChange={(o) => { if (!o && !deleting) setConfirmDelete(null); }}
              title="Supprimer la session"
              description={`Êtes-vous sûr de vouloir supprimer la session '${confirmDelete?.name}' ? Cette action est irréversible.`}
              confirmText={deleting ? "Suppression..." : "Supprimer"}
              cancelText="Annuler"
              variant="destructive"
              onConfirm={handleDelete}
              disabled={!!deleting}
            />
          </div>
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}
