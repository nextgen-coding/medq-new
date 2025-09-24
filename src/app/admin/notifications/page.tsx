'use client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Niveau = { id: string; name: string; order: number; _count?: { users: number } };
type Semester = { id: string; name: string; order: number; niveau: { id: string; name: string }; _count?: { users: number } };

type TargetingOptions = {
  niveaux: Niveau[];
  semesters: Semester[];
  userStatistics: {
    total: number;
    byRole: Record<string, number>;
    bySubscription: { paid: number; unpaid: number };
    byProfileCompletion: { completed: number; incomplete: number };
    byEmailVerification: { verified: number; unverified: number };
    byStatus: Record<string, number>;
  };
  roles: string[];
  subscriptionStatuses: string[];
  verificationStatuses: string[];
  accountStatuses: string[];
  notificationTypes: string[];
  notificationCategories: string[];
};

export default function AdminNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<TargetingOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [category, setCategory] = useState('system');
  const [targetAll, setTargetAll] = useState(true);
  const [combineWithAnd, setCombineWithAnd] = useState(true);

  const [niveauIds, setNiveauIds] = useState<string[]>([]);
  const [semesterIds, setSemesterIds] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [verificationStatus, setVerificationStatus] = useState<'all' | 'verified' | 'unverified'>('all');
  const [profileCompleted, setProfileCompleted] = useState<boolean | 'all'>('all');
  const [accountStatus, setAccountStatus] = useState<string[]>([]);

  const [sending, setSending] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setOptionsError(null);
        const res = await fetch('/api/admin/notifications/targeting-options', { credentials: 'include' });
        if (!res.ok) {
          const msg = res.status === 401 ? 'Non authentifié' : res.status === 403 ? 'Accès admin requis' : 'Chargement échoué';
          throw new Error(msg);
        }
        const json: TargetingOptions = await res.json();
        setOptions(json);
        setType(json.notificationTypes?.[0] ?? 'info');
        setCategory(json.notificationCategories?.[0] ?? 'system');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur inconnue';
        setOptionsError(msg);
        toast.error('Impossible de charger les options de ciblage', { description: msg });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadRecent = async () => {
    try {
      const res = await fetch('/api/admin/notifications', { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      const json = await res.json();
      setRecent(json.notifications || []);
    } catch (e) {
      // Non fatal
    }
  };

  useEffect(() => { loadRecent(); }, []);

  const selectedNiveaux = useMemo(() => new Set(niveauIds), [niveauIds]);
  const selectedSemesters = useMemo(() => new Set(semesterIds), [semesterIds]);
  const selectedRoles = useMemo(() => new Set(roles), [roles]);
  const selectedStatuses = useMemo(() => new Set(accountStatus), [accountStatus]);

  const toggleFromSet = (value: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  };

  // Allow sending as long as title and message are present; options may fail to load but default targeting still works (e.g., Tous les utilisateurs)
  const canSend = title.trim().length > 0 && message.trim().length > 0;

  const handleSend = async () => {
    if (!canSend) return;
    try {
      setSending(true);
      const targeting: any = {
        targetAll,
        combineWithAnd,
      };
      if (!targetAll) {
        if (niveauIds.length) targeting.niveauIds = niveauIds;
        if (semesterIds.length) targeting.semesterIds = semesterIds;
        if (roles.length) targeting.roles = roles;
        if (subscriptionStatus !== 'all') targeting.subscriptionStatus = subscriptionStatus;
        if (verificationStatus !== 'all') targeting.verificationStatus = verificationStatus;
        if (profileCompleted !== 'all') targeting.profileCompleted = profileCompleted;
        if (accountStatus.length) targeting.accountStatus = accountStatus;
      }

      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, message, type, category, targeting }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      toast.success(json.message || 'Notification envoyée');
      setTitle('');
      setMessage('');
      await loadRecent();
    } catch (e: any) {
      toast.error(e.message || 'Échec de l’envoi');
    } finally {
      setSending(false);
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/admin/inbox'}
                  className="text-sm border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-950/50 shadow-sm transition-all duration-200 justify-center sm:justify-start"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="sm:hidden">Retour</span>
                  <span className="hidden sm:inline">Retour à la boîte de réception</span>
                </Button>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Notifications</h1>
                  <p className="text-muted-foreground text-sm">Envoyer des notifications ciblées aux utilisateurs.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Composer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {optionsError && (
                    <div className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded p-3">
                      Les options de ciblage n'ont pas pu être chargées ({optionsError}). Vous pouvez tout de même envoyer une notification à tous les utilisateurs ou saisir vos critères manuellement.
                    </div>
                  )}
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Titre</label>
                      <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Titre de la notification" />
                      {title.trim().length === 0 && (
                        <div className="text-xs text-muted-foreground">Le titre est requis.</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Message</label>
                      <Textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Contenu du message" rows={5} />
                      {message.trim().length === 0 && (
                        <div className="text-xs text-muted-foreground">Le message est requis.</div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <Select value={type} onValueChange={setType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {(options?.notificationTypes || ['info','success','warning','error']).map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Catégorie</label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger>
                            <SelectValue placeholder="Catégorie" />
                          </SelectTrigger>
                          <SelectContent>
                            {(options?.notificationCategories || ['system','progress','lecture','achievement','question','reminder']).map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-2" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox id="targetAll" checked={targetAll} onCheckedChange={v=>setTargetAll(!!v)} />
                        <label htmlFor="targetAll" className="text-sm font-medium">Tous les utilisateurs</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="combineAnd" checked={combineWithAnd} disabled={targetAll} onCheckedChange={v=>setCombineWithAnd(!!v)} />
                        <label htmlFor="combineAnd" className="text-sm">Combiner critères avec AND</label>
                      </div>
                    </div>

                    <div className={`grid gap-4 ${targetAll ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                          <div className="text-sm font-medium mb-2">Niveaux</div>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {(options?.niveaux || []).map(n => (
                              <button key={n.id} type="button" onClick={()=>toggleFromSet(n.id, niveauIds, setNiveauIds)}
                                className={`px-2 py-1 rounded border text-xs ${selectedNiveaux.has(n.id) ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-muted'}`}>
                                <span className="block sm:hidden">{n.name.substring(0, 3)}</span>
                                <span className="hidden sm:block">{n.name}</span>
                                {n._count?.users ? <span className="ml-1 opacity-70">({n._count.users})</span> : null}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-medium mb-2">Semestres</div>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {(options?.semesters || []).map(s => (
                              <button key={s.id} type="button" onClick={()=>toggleFromSet(s.id, semesterIds, setSemesterIds)}
                                className={`px-2 py-1 rounded border text-xs ${selectedSemesters.has(s.id) ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-muted'}`}>
                                <span className="block sm:hidden">{s.niveau.name.substring(0, 2)} — {s.name.substring(0, 3)}</span>
                                <span className="hidden sm:block">{s.niveau.name} — {s.name}</span>
                                {s._count?.users ? <span className="ml-1 opacity-70">({s._count.users})</span> : null}
                              </button>
                            ))}
                          </div>
                        </div>                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <div className="text-sm font-medium mb-2">Rôles</div>
                            <div className="flex flex-wrap gap-2">
                              {(options?.roles || ['student','maintainer','admin']).map(r => (
                                <button key={r} type="button" onClick={()=>toggleFromSet(r, roles, setRoles)}
                                  className={`px-2 py-1 rounded border text-xs ${selectedRoles.has(r) ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-muted'}`}>
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Abonnement</label>
                              <Select value={subscriptionStatus} onValueChange={(v)=>setSubscriptionStatus(v as any)}>
                                <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
                                <SelectContent>
                                  {(options?.subscriptionStatuses || ['all','paid','unpaid']).map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Vérification e-mail</label>
                              <Select value={verificationStatus} onValueChange={(v)=>setVerificationStatus(v as any)}>
                                <SelectTrigger><SelectValue placeholder="Vérification" /></SelectTrigger>
                                <SelectContent>
                                  {(options?.verificationStatuses || ['all','verified','unverified']).map(v => (
                                    <SelectItem key={v} value={v}>{v}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Profil complété</label>
                              <Select value={String(profileCompleted)} onValueChange={(v)=>setProfileCompleted(v === 'all' ? 'all' : v === 'true')}>
                                <SelectTrigger><SelectValue placeholder="Profil" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">all</SelectItem>
                                  <SelectItem value="true">true</SelectItem>
                                  <SelectItem value="false">false</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <div className="text-sm font-medium mb-2">Statut du compte</div>
                              <div className="flex flex-wrap gap-2">
                                {(options?.accountStatuses || ['pending','active','suspended']).map(s => (
                                  <button key={s} type="button" onClick={()=>toggleFromSet(s, accountStatus, setAccountStatus)}
                                    className={`px-2 py-1 rounded border text-xs ${selectedStatuses.has(s) ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-muted'}`}>
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button onClick={handleSend} disabled={!canSend || sending}>{sending ? 'Envoi…' : 'Envoyer'}</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Aperçu ciblage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {loading ? (
                    <div className="text-muted-foreground">Chargement…</div>
                  ) : options ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><span>Total utilisateurs</span><Badge variant="secondary">{options.userStatistics.total}</Badge></div>
                      <div>
                        <div className="font-medium mb-1">Par rôle</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(options.userStatistics.byRole || {}).map(([k,v]) => (
                            <Badge key={k} variant="outline" className="gap-1"><span className="opacity-70">{k}</span><span className="font-semibold">{v}</span></Badge>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="font-medium mb-1">Abonnements</div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex justify-between"><span>payés</span><span className="font-medium text-foreground">{options.userStatistics.bySubscription.paid}</span></div>
                            <div className="flex justify-between"><span>non payés</span><span className="font-medium text-foreground">{options.userStatistics.bySubscription.unpaid}</span></div>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium mb-1">Profils</div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex justify-between"><span>complétés</span><span className="font-medium text-foreground">{options.userStatistics.byProfileCompletion.completed}</span></div>
                            <div className="flex justify-between"><span>incomplets</span><span className="font-medium text-foreground">{options.userStatistics.byProfileCompletion.incomplete}</span></div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="font-medium mb-1">Vérification e-mail</div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex justify-between"><span>vérifiés</span><span className="font-medium text-foreground">{options.userStatistics.byEmailVerification.verified}</span></div>
                            <div className="flex justify-between"><span>non vérifiés</span><span className="font-medium text-foreground">{options.userStatistics.byEmailVerification.unverified}</span></div>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium mb-1">Statut du compte</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(options.userStatistics.byStatus || {}).map(([k,v]) => (
                              <Badge key={k} variant="outline" className="gap-1"><span className="opacity-70">{k}</span><span className="font-semibold">{v}</span></Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">Aucune donnée</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Dernières notifications</CardTitle>
              </CardHeader>
              <CardContent>
                {recent.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucune notification pour l’instant.</div>
                ) : (
                  <div className="divide-y">
                    {recent.map((n:any) => (
                      <div key={n.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{n.title} <span className="ml-2 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span></div>
                          <div className="text-sm text-muted-foreground break-words">{n.message}</div>
                          {n.user && (
                            <div className="text-xs text-muted-foreground mt-1">→ {n.user.email} ({n.user.role})</div>
                          )}
                        </div>
                        <Badge variant={n.type === 'error' ? 'destructive' : n.type === 'success' ? 'default' : 'secondary'} className="shrink-0 capitalize">{n.type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}
