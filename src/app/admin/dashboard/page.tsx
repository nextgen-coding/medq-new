'use client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Users, Activity, BookOpen, Clock, ListChecks, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Lazy import chart.js components only on client (avoid SSR issues)
const BarBase = dynamic(() => import('react-chartjs-2').then(m => m.Bar), { ssr: false, loading: () => <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">Chargement du graphique...</div> });
const LineBase = dynamic(() => import('react-chartjs-2').then(m => m.Line), { ssr: false, loading: () => <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">Chargement...</div> });

// Provide typed wrappers so TS knows these accept data/options props
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BarChartComp = (props: any) => <BarBase {...props} />;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LineChartComp = (props: any) => <LineBase {...props} />;

// Register Chart.js (done dynamically to avoid SSR issues)
// We guard inside component
let chartRegistered = false;

interface KeyMetric { label: string; value: string | number; delta?: number; icon: React.ReactNode; color: string; }

interface DashboardData {
  totals: { users: number; questions: number; sessions: number; comments: number; reportsOpen: number; activities24h: number };
  dailyActive: { date: string; count: number }[];
  activityLast7: { label: string; questions: number; sessions: number; reports: number }[];
  topSpecialties: { name: string; questions: number }[];
  userGrowth: { date: string; count: number }[];
  usersByRole: { role: string; count: number }[];
  usersByNiveau: { name: string; count: number }[];
  usersBySemester: { name: string; count: number }[];
  profileCompletion: { completed: number; incomplete: number };
  subscriptionStatus: { active: number; inactive: number };
  topActiveUsers: { email: string; activity: number }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'7' | '30'>('7');

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/admin/stats?range=${range}`);
        if (!res.ok) throw new Error('failed');
        const json = await res.json();
        setData(json);
      } catch (e:any) { setError('Impossible de charger les statistiques'); }
      finally { setLoading(false); }
    };
    load();
  }, [range]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !chartRegistered) {
      import('chart.js').then(Chart => {
        const { Chart: C, BarElement, BarController, LineController, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler } = Chart;
        C.register(BarElement, BarController, LineController, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler);
        chartRegistered = true;
      });
    }
  }, []);

  const metrics: KeyMetric[] = data ? [
    { label: 'Utilisateurs', value: data.totals.users, icon: <Users className="h-5 w-5" />, color: 'from-blue-500 to-blue-600' },
    { label: 'Questions', value: data.totals.questions, icon: <ListChecks className="h-5 w-5" />, color: 'from-indigo-500 to-indigo-600' },
    { label: 'Sessions', value: data.totals.sessions, icon: <FileText className="h-5 w-5" />, color: 'from-cyan-500 to-cyan-600' },
    { label: 'Commentaires', value: data.totals.comments, icon: <BookOpen className="h-5 w-5" />, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Signalements ouverts', value: data.totals.reportsOpen, icon: <Activity className="h-5 w-5" />, color: 'from-orange-500 to-orange-600' },
    { label: 'Activité 24h', value: data.totals.activities24h, icon: <Clock className="h-5 w-5" />, color: 'from-pink-500 to-pink-600' }
  ] : [];

  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          <div className="space-y-8">
            <div className="flex flex-wrap justify-between gap-4 items-end">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Tableau de bord</h1>
                <p className="text-muted-foreground text-sm">Aperçu global de l'activité et du contenu.</p>
              </div>
              <div className="flex gap-2">
                <Button variant={range==='7'?'default':'outline'} size="sm" onClick={()=>setRange('7')}>7 jours</Button>
                <Button variant={range==='30'?'default':'outline'} size="sm" onClick={()=>setRange('30')}>30 jours</Button>
              </div>
            </div>

            {error && <div className="text-sm text-red-600 bg-red-100 dark:bg-red-900/30 p-3 rounded border border-red-300 dark:border-red-800">{error}</div>}

            <div className="grid gap-6 md:grid-cols-3 xl:grid-cols-6">
              {loading && !data ? Array.from({length:6}).map((_,i)=>(
                <div key={i} className="h-28 animate-pulse rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/40 dark:from-blue-950/30 dark:to-blue-900/10 border border-blue-200/60 dark:border-blue-800/40" />
              )) : metrics.map(m => (
                <Card key={m.label} className="relative overflow-hidden group">
                  <div className={cn('absolute inset-0 opacity-90 bg-gradient-to-br', m.color)} />
                  <div className="absolute inset-0 bg-grid-white/[0.05] dark:bg-grid-white/[0.03]" />
                  <CardContent className="relative p-4 flex flex-col h-28 justify-between text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium opacity-90">{m.label}</span>
                      <div className="p-2 bg-white/20 rounded-lg backdrop-blur group-hover:scale-110 transition-transform">{m.icon}</div>
                    </div>
                    <div className="text-2xl font-semibold tracking-tight">{m.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-100 text-base">Activité quotidienne utilisateurs</CardTitle>
                </CardHeader>
                <CardContent>
                  {data && data.dailyActive.length > 0 && chartRegistered ? (
                    <LineChartComp data={{
                      labels: data.dailyActive.map(d=>d.date.slice(5)),
                      datasets: [{
                        label: 'Utilisateurs actifs',
                        data: data.dailyActive.map(d=>d.count),
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37,99,235,0.15)',
                        tension: 0.35,
                        fill: true,
                        pointRadius: 3,
                      }]
                    }} options={{ responsive:true, plugins:{ legend:{ display:false }}, scales:{ x:{ grid:{ display:false }}, y:{ beginAtZero:true }}}} />
                  ) : <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">{loading ? 'Chargement...' : 'Aucune donnée'}</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-100 text-base">Top spécialités (questions)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data?.topSpecialties.slice(0,6).map(s => (
                      <div key={s.name} className="flex items-center gap-3">
                        <div className="flex-1 text-sm truncate">{s.name}</div>
                        <div className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">{s.questions}</div>
                      </div>
                    )) || <div className="text-xs text-muted-foreground">Aucune donnée</div>}
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* Advanced User Analytics */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-100 text-base">Croissance utilisateurs</CardTitle>
                </CardHeader>
                <CardContent>
                  {data && data.userGrowth?.length > 0 && chartRegistered ? (
                    <LineChartComp data={{
                      labels: data.userGrowth.map(d=>d.date.slice(5)),
                      datasets:[{
                        label: 'Inscriptions',
                        data: data.userGrowth.map(d=>d.count),
                        borderColor: '#059669',
                        backgroundColor: 'rgba(5,150,105,0.15)',
                        tension: .35,
                        fill: true,
                        pointRadius: 3
                      }]
                    }} options={{ responsive:true, plugins:{ legend:{ display:false }}, scales:{ x:{ grid:{ display:false }}, y:{ beginAtZero:true }}}} />
                  ) : <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">{loading? 'Chargement...':'Aucune donnée'}</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-100 text-base">Rôles</CardTitle>
                </CardHeader>
                <CardContent>
                  {data && data.usersByRole?.length>0 && chartRegistered ? (
                    <BarChartComp data={{
                      labels: data.usersByRole.map(r=>r.role),
                      datasets:[{ label:'Utilisateurs', data: data.usersByRole.map(r=>r.count), backgroundColor: 'rgba(59,130,246,0.8)' }]
                    }} options={{ responsive:true, plugins:{ legend:{ display:false }}, scales:{ x:{ grid:{ display:false }}, y:{ beginAtZero:true }}}} />
                  ) : <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">{loading? 'Chargement...':'Aucune donnée'}</div>}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-100 text-base">Niveaux</CardTitle>
                </CardHeader>
                <CardContent>
                  {data && data.usersByNiveau?.length>0 && chartRegistered ? (
                    <BarChartComp data={{
                      labels: data.usersByNiveau.map(n=>n.name),
                      datasets:[{ label:'Utilisateurs', data: data.usersByNiveau.map(n=>n.count), backgroundColor: 'rgba(99,102,241,0.8)' }]
                    }} options={{ responsive:true, plugins:{ legend:{ display:false }}, scales:{ x:{ grid:{ display:false }}, y:{ beginAtZero:true }}}} />
                  ) : <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">{loading? 'Chargement...':'Aucune donnée'}</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-100 text-base">Semestres</CardTitle>
                </CardHeader>
                <CardContent>
                  {data && data.usersBySemester?.length>0 && chartRegistered ? (
                    <BarChartComp data={{
                      labels: data.usersBySemester.map(n=>n.name),
                      datasets:[{ label:'Utilisateurs', data: data.usersBySemester.map(n=>n.count), backgroundColor: 'rgba(14,165,233,0.8)' }]
                    }} options={{ responsive:true, plugins:{ legend:{ display:false }}, scales:{ x:{ grid:{ display:false }}, y:{ beginAtZero:true }}}} />
                  ) : <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">{loading? 'Chargement...':'Aucune donnée'}</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-100 text-base">Profil & Abonnements</CardTitle>
                </CardHeader>
                <CardContent>
                  {data ? (
                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between"><span>Profils complétés</span><span className="font-semibold">{data.profileCompletion.completed}</span></div>
                      <div className="flex justify-between"><span>Profils incomplets</span><span className="font-semibold">{data.profileCompletion.incomplete}</span></div>
                      <div className="h-px bg-muted" />
                      <div className="flex justify-between"><span>Abonnements actifs</span><span className="font-semibold">{data.subscriptionStatus.active}</span></div>
                      <div className="flex justify-between"><span>Sans abonnement</span><span className="font-semibold">{data.subscriptionStatus.inactive}</span></div>
                      <div className="h-px bg-muted" />
                      <div>
                        <p className="mb-2 font-medium">Top utilisateurs actifs (7j)</p>
                        <ul className="space-y-1 text-xs">
                          {data.topActiveUsers.map(u=> (
                            <li key={u.email} className="flex justify-between"><span className="truncate max-w-[140px]">{u.email}</span><span className="font-medium">{u.activity}</span></li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">{loading? 'Chargement...':'Aucune donnée'}</div>}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-100 text-base">Activité (Questions / Sessions / Reports)</CardTitle>
                </CardHeader>
                <CardContent>
                  {data && data.activityLast7.length>0 && chartRegistered ? (
                    <BarChartComp data={{
                      labels: data.activityLast7.map(a=>a.label),
                      datasets:[
                        { label: 'Questions', data: data.activityLast7.map(a=>a.questions), backgroundColor: 'rgba(99,102,241,0.8)' },
                        { label: 'Sessions', data: data.activityLast7.map(a=>a.sessions), backgroundColor: 'rgba(6,182,212,0.8)' },
                        { label: 'Reports', data: data.activityLast7.map(a=>a.reports), backgroundColor: 'rgba(249,115,22,0.8)' },
                      ]
                    }} options={{responsive:true, scales:{ x:{ grid:{ display:false }}, y:{ beginAtZero:true }}, plugins:{ legend:{ position:'bottom' }}}} />
                  ) : <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">{loading ? 'Chargement...' : 'Aucune donnée'}</div>}
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-100 text-base">Logs (idées futures)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>• Dernières connexions</li>
                    <li>• Dernières sessions ajoutées</li>
                    <li>• Rapports récents en attente</li>
                    <li>• Progressions notables</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}
