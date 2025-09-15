"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, FileText, Download, Eye, Users, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { UniversalHeader } from '@/components/layout/UniversalHeader';
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

type Session = {
  id: string;
  name: string;
  pdfUrl?: string;
  correctionUrl?: string;
  createdAt: string;
  niveau?: { id: string; name: string };
  semester?: { id: string; name: string; order: number };
};

type Specialty = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  semester?: { id: string; name: string; order: number };
  sessions: Session[];
};

import { getMedicalIcon, getIconBySpecialtyName } from '@/lib/medical-icons';

export default function SpecialtySessionsPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const { user } = useAuth();
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const specialtyId = Array.isArray(params.id) ? params.id[0] : params.id;
  const specialtyNameParam = search.get('name') || undefined;

  const fetchSpecialty = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = specialtyNameParam ? `?name=${encodeURIComponent(specialtyNameParam)}` : '';
      const response = await fetch(`/api/specialties/${id}/sessions${qs}`, { cache: 'no-store' });
      if (response.ok) {
        const data: Specialty = await response.json();
        setSpecialty(data);
      } else if (response.status === 404) {
        const basicRes = await fetch(`/api/specialties/${id}`, { cache: 'no-store' });
        if (basicRes.ok) {
          const basic = await basicRes.json();
          const sessionsRes = await fetch(`/api/sessions`, { cache: 'no-store' });
          if (sessionsRes.ok) {
            const allSessions = await sessionsRes.json();
            const filtered = (allSessions || []).filter((sx: any) => sx.specialty?.id === id);
            if (filtered.length > 0) {
              setSpecialty({ ...basic, sessions: filtered });
              return;
            }
          }
          setSpecialty(null);
          setError('Spécialité introuvable (fallback)');
        } else {
          setSpecialty(null);
          setError('Spécialité introuvable');
        }
      } else {
        setError('Erreur lors du chargement des sessions');
      }
    } catch (e) {
      console.error('Failed to load specialty sessions:', e);
      setError('Erreur réseau lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [specialtyNameParam]);

  useEffect(() => {
    if (specialtyId) fetchSpecialty(specialtyId);
  }, [specialtyId, specialtyNameParam, fetchSpecialty]);

  const canViewCorrection = user?.role === 'admin' || user?.role === 'maintainer';
  const filtered = useMemo(() => {
    if (!specialty) return [];
    if (!query.trim()) return specialty.sessions;
    const q = query.toLowerCase();
    return specialty.sessions.filter(s => s.name.toLowerCase().includes(q));
  }, [query, specialty]);

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col">
            <UniversalHeader
              hideSeparator
              leftActions={(
                <Button 
                  variant="outline" 
                  size="default" 
                  onClick={() => router.push('/session')} 
                  className="group gap-2 bg-card/80 border-border hover:bg-accent hover:border-accent-foreground/20 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
                  <span className="font-medium">Retour</span>
                </Button>
              )}
            />
            <div className="flex-1 bg-gray-50 dark:bg-gray-900">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {loading ? (
                  <div className="flex items-center justify-center min-h-[40vh]">
                    <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 px-6 py-4 rounded-xl shadow-lg backdrop-blur-sm">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      <span className="text-blue-800 dark:text-blue-200 font-medium">Chargement des sessions...</span>
                    </div>
                  </div>
                ) : !specialty ? (
                  <div className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg rounded-xl p-8">
                    <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
                      <div className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                        <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-200">{error || 'Spécialité non trouvée'}</h2>
                      {specialtyId && <p className="text-xs text-blue-600 dark:text-blue-400 break-all opacity-70">ID: {String(specialtyId)}</p>}
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => router.push('/session')} 
                          size="default" 
                          variant="outline" 
                          className="group gap-2 bg-card/80 border-border hover:bg-accent hover:border-accent-foreground/20 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform duration-200" /> 
                          <span className="font-medium">Retour</span>
                        </Button>
                        {specialtyId && (
                          <Button 
                            size="default" 
                            onClick={() => fetchSpecialty(specialtyId!)} 
                            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            Réessayer
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {(specialty) && (() => {
                      return (
                        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-white/60 dark:bg-muted/40 backdrop-blur-sm shadow-lg transition-all duration-300">
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-blue-400/40 via-blue-600/10 to-blue-400/40" />
                          
                          {/* Header section with gradient */}
                          <div className="bg-gradient-to-r from-blue-50/50 to-blue-100/40 dark:from-blue-900/40 dark:to-blue-800/30 border-b border-blue-100/50 dark:border-blue-800/50 p-6">
                            <div className="flex">
                              <div className="flex-1 min-w-0">
                                <h1 className="text-2xl font-bold text-blue-900 dark:text-blue-100 ">{specialty.name}</h1>
                                <div className="flex flex-wrap gap-2 items-center mb-6">
                                  
                                  {specialty.semester && (
                                    <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-200/50 dark:border-blue-800/50">
                                      <Users className="h-3 w-3" /> Semestre {specialty.semester.order}
                                    </div>
                                  )}
                                </div>
                                {(() => {
                                  const totalSessions = specialty.sessions.length;
                                  const completedSessions = specialty.sessions.filter(s => !!s.pdfUrl).length; // heuristic
                                  const progressPct = totalSessions === 0 ? 0 : Math.round((completedSessions / totalSessions) * 100);
                                  return (
                                    <>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                          <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{totalSessions}</div>
                                          <div className="text-xs text-blue-600 dark:text-blue-400">Sessions totales</div>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                                          <div className="text-xl font-bold text-green-700 dark:text-green-300">{completedSessions}</div>
                                          <div className="text-xs text-green-600 dark:text-green-400">Terminées</div>
                                        </div>
                                        <div className="bg-medblue-50 dark:bg-medblue-900/20 rounded-lg p-4">
                                          <div className="text-xl font-bold text-medblue-700 dark:text-medblue-300">{progressPct}%</div>
                                          <div className="text-xs text-medblue-600 dark:text-medblue-400">Progression</div>
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-blue-700 dark:text-blue-300/80">Progression globale</span>
                                          <span className="font-semibold text-blue-600 dark:text-blue-400">{progressPct}%</span>
                                        </div>
                                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                          <div className="absolute inset-y-0 left-0 bg-orange-500" style={{ width: `${progressPct}%` }} />
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* Content section */}
                          {specialty.description && (
                            <div className="p-6">
                              <p className="text-sm text-blue-600 dark:text-blue-400 leading-relaxed">{specialty.description}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div className="max-w-md relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <Input placeholder="Chercher une session" value={query} onChange={e => setQuery(e.target.value)} className="pl-9 bg-white/70 dark:bg-muted/40 border-blue-200 dark:border-blue-800 focus:ring-blue-500" />
                    </div>
                    {filtered.length === 0 ? (
                      <div className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg rounded-xl p-8">
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                            <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-200">Aucune session</h3>
                          <p className="text-blue-600 dark:text-blue-400 text-center">{query ? 'Aucun résultat pour cette recherche.' : 'Cette spécialité ne contient pas encore de sessions.'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {filtered.map(session => {
                          const created = new Date(session.createdAt);
                          // Generate different gradient colors for each session based on ID hash
                          const getSessionGradient = (id: string) => {
                            let hash = 0;
                            for (let i = 0; i < id.length; i++) {
                              hash = id.charCodeAt(i) + ((hash << 5) - hash);
                            }
                            
                            const gradients = [
                              'from-blue-400 to-blue-600',
                              'from-emerald-400 to-emerald-600',
                              'from-violet-400 to-violet-600',
                              'from-orange-400 to-orange-600',
                              'from-rose-400 to-rose-600',
                              'from-cyan-400 to-cyan-600',
                              'from-indigo-400 to-indigo-600',
                              'from-teal-400 to-teal-600',
                            ];
                            
                            return gradients[Math.abs(hash) % gradients.length];
                          };

                          const sessionGradient = getSessionGradient(session.id);

                          return (
                            <div
                              key={session.id}
                              className="relative group rounded-2xl border border-border/50 bg-white/60 dark:bg-muted/40 backdrop-blur-sm overflow-hidden hover:shadow-2xl hover:shadow-blue-500/25 hover:-translate-y-2 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 shadow-lg focus-within:ring-2 focus-within:ring-blue-500/60"
                            >
                              {/* Full-card clickable overlay (only if PDF available) */}
                              {session.pdfUrl && (
                                <Link
                                  href={`/session/${specialty.id}/${session.id}/viewer`}
                                  className="absolute inset-0 z-10"
                                  aria-label={`Ouvrir la session ${session.name}`}
                                  tabIndex={0}
                                />
                              )}
                              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-blue-400/40 via-blue-600/10 to-blue-400/40" />
                              
                              {/* Header with gradient icon */}
                              <div className="p-5 border-b border-blue-100/50 dark:border-blue-800/50 bg-gradient-to-r from-blue-50/30 to-blue-100/20 dark:from-blue-900/20 dark:to-blue-800/10">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {/* Session Icon with Gradient */}
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${sessionGradient} shadow-lg border-2 border-white/20`}>
                                      <Calendar className="w-6 h-6 text-white" />
                                    </div>
                                    
                                    <div className="space-y-1 min-w-0 flex-1">
                                      <h3 className="font-bold text-sm line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors text-blue-900 dark:text-blue-100">
                                        {session.name}
                                      </h3>
                                      <p className="text-[11px] text-blue-600 dark:text-blue-400 uppercase tracking-wide font-medium">
                                        {created.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' })}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <Badge variant="outline" className="text-[10px] rounded-full px-2 py-0.5 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/30">
                                    {session.semester ? `S${session.semester.order}` : 'Exam'}
                                  </Badge>
                                </div>
                              </div>

                              {/* Content and Actions */}
                              <div className="p-5 flex flex-col h-full">
                                {/* Session Stats */}
                                <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 mb-4">
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                    <span>Session d'examen</span>
                                  </div>
                                  {session.pdfUrl && (
                                    <div className="flex items-center gap-1">
                                      <Eye className="h-3 w-3" />
                                      <span>PDF disponible</span>
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="mt-auto flex flex-col gap-2">
                                  {session.pdfUrl && (
                                    <Button
                                      size="sm"
                                      onClick={(e) => { e.stopPropagation(); router.push(`/session/${specialty.id}/${session.id}/viewer`); }}
                                      className="relative z-20 w-full justify-center text-xs bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 group"
                                    >
                                      <Eye className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                                      Voir l'examen
                                    </Button>
                                  )}
                                  {!session.pdfUrl && (
                                    <div className="text-center py-4">
                                      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-2">
                                        <FileText className="h-6 w-6 text-gray-400" />
                                      </div>
                                      <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Aucun document disponible</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </SidebarInset>
        </div>
      </AppSidebarProvider>
    </ProtectedRoute>
  );
}
