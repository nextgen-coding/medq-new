'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell, ReferenceLine } from 'recharts';
import { useEffect, useState } from 'react';

export interface ActivityPoint { date: string; total: number }
interface DailyLearningChartProps { data?: ActivityPoint[]; isLoading?: boolean; streak?: number }

const DAY_WINDOWS = [7,14,30];

export function DailyLearningChart({ data, isLoading: extLoading=false, streak }: DailyLearningChartProps) {
  const [days, setDays] = useState<number>(()=> (typeof window!=='undefined'? parseInt(localStorage.getItem('daily_activity_days')||'7',10):7));
  const [localData, setLocalData] = useState<ActivityPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // debug mode removed (was toggled via 'bug' button)
  const [meta, setMeta] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(()=>{ if(typeof window!=='undefined') localStorage.setItem('daily_activity_days', String(days)); },[days]);

  useEffect(()=>{
    if(data && data.length) return;
    const controller = new AbortController();
    (async()=>{
      try {
        setLoading(true); setError(null);
  const url = `/api/dashboard/daily-activity?days=${days}`;
        const r = await fetch(url,{signal:controller.signal});
        if(!r.ok) throw new Error('HTTP '+r.status);
        const j = await r.json();
        if(Array.isArray(j)) setLocalData(j as any);
  else if(j.dailyData) { setLocalData(j.dailyData.map((d:any)=> ({ date:d.date, total:d.total })) ); setMeta(j); }
        else setLocalData([]);
      } catch(e:any){ if(e.name!=='AbortError'){ setError(e.message||'Erreur chargement'); setLocalData([]);} }
      finally { setLoading(false); }
    })();
    return ()=>controller.abort();
  },[days,data]);

  const todayKey = new Date(Date.now()- new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  const rawData = (data && data.length? data: localData).map(d=> ({ ...d, total: d.total||0 }));
  // Fill missing days to keep consistent width & guarantee a bar position
  const filledData = (()=>{
    const map = new Map(rawData.map(d=> [d.date, d.total]));
    const arr: {date:string; total:number; displayTotal:number}[] = [];
    const now = new Date();
    for(let i=days-1;i>=0;i--){
      const d = new Date(now); d.setDate(d.getDate()-i);
      const key = new Date(d.getTime()- d.getTimezoneOffset()*60000).toISOString().slice(0,10); // UTC day key
      const t = map.get(key) || 0;
      arr.push({ date:key, total:t, displayTotal: t>0? t: 0.0001 });
    }
    return arr;
  })();
  const chartData = filledData;
  const isLoading = extLoading || loading || !mounted;
  const total = chartData.reduce((a,b)=> a + b.total, 0);
  const avg = meta?.metrics?.avgPerWindow ?? (days? total/days:0);
  // Local streak computation (current & max) as fallback if backend values missing / zero
  const computeLocalStreaks = () => {
    let current = 0; let max = 0; let run = 0;
    for(const d of chartData){
      if(d.total>0){ run++; if(run>max) max=run; } else { run=0; }
    }
    // current streak is the streak ending on the most recent day
    // Recompute from end backwards
    for(let i=chartData.length-1;i>=0;i--){
      if(chartData[i].total>0) current++; else break;
    }
    return { current, max };
  };
  const localStreaks = computeLocalStreaks();
  const backendCurrent = meta?.metrics?.streakCurrent ?? 0;
  const backendMax = meta?.metrics?.maxStreak ?? 0;
  const propStreak = typeof streak === 'number'? streak: 0;
  const currentStreak = propStreak || backendCurrent || localStreaks.current;
  const maxStreak = Math.max(backendMax, localStreaks.max, currentStreak);
  // Decide what to show: prefer current streak if >0 else show max streak (with dim style)
  const showStreak = currentStreak>0? currentStreak: (maxStreak>0? maxStreak: 0);
  const streakIsCurrent = showStreak === currentStreak;
  const maxVal = Math.max(0, ...chartData.map(d=> d.total));

  // Adaptive date formatting (shorter for larger windows)
  const formatDate = (ds:string)=> {
    const d = new Date(ds);
    if(days>=30) return d.toLocaleDateString('fr-FR',{ day:'numeric' }); // just day number
    if(days>=14) return d.toLocaleDateString('fr-FR',{ weekday:'short', day:'numeric' }).replace(/\.$/,'');
    return d.toLocaleDateString('fr-FR',{ weekday:'short', day:'numeric' });
  };

  // Custom tick to hide some labels to prevent overlap (especially 30j window)
  const CustomTick = (props:any) => {
    const { x, y, payload, index } = props;
    if(days===30 && index % 2 === 1) return null; // show every other day
    return (
      <text x={x} y={y+10} textAnchor="middle" fontSize={11} fill="currentColor" className="select-none">
        {formatDate(payload.value)}
      </text>
    );
  };

  const CustomTooltip = ({active,payload,label}: any)=>{
    if(active && payload && payload.length){
      return (
        <div className="bg-white/95 dark:bg-muted/95 border border-border/50 rounded-xl p-2.5 text-xs shadow-lg backdrop-blur-sm">
          <div className="font-semibold mb-1">{new Date(label).toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'short'})}</div>
          <div className="flex justify-between"><span>Total</span><span className="font-semibold text-blue-600 dark:text-blue-400">{payload[0].value}</span></div>
        </div>
      );
    }
    return null;
  };

  if(isLoading){
    return <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg"><CardHeader><div className="h-6 w-40 bg-muted/60 rounded animate-pulse"/></CardHeader><CardContent><div className="h-[300px] bg-muted/60 rounded animate-pulse"/></CardContent></Card>;
  }

  return (
  <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all">
      <CardHeader className="pb-3">
    <CardTitle className="flex items-center gap-3 flex-wrap text-lg font-semibold tracking-tight">
          <span className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Activité quotidienne
          </span>
          {showStreak>0 && (
            <div className={`relative inline-flex items-center justify-center ${streakIsCurrent? 'animate-pulse':'opacity-75'}`}
              title={streakIsCurrent? (maxStreak && maxStreak!==showStreak? `Série actuelle: ${showStreak} jours (max: ${maxStreak})`:`Série actuelle: ${showStreak} jours`):`Meilleure série: ${showStreak} jours`}>
              {/* Fire emoji background */}
              <span className="text-4xl select-none filter drop-shadow-lg">🔥</span>
              {/* Streak number overlay */}
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-black drop-shadow-md">
                {showStreak}
              </span>
            </div>
          )}
          <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">Moy: {avg.toFixed(1)}/j</span>
          <div className="flex items-center gap-1">
            {DAY_WINDOWS.map(d => (
              <button key={d} onClick={()=>setDays(d)} className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${days===d? 'bg-blue-600 text-white border-blue-600 shadow-sm':'bg-transparent dark:text-slate-300 border-border/40 hover:bg-blue-500/10'}`}>{d}j</button>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-[2px]">
        <div className="w-full h-[280px] relative" style={{ minWidth: '300px', minHeight: '280px' }}>
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400">
              <span>Erreur: {error}</span>
              <a href={`/api/dashboard/daily-activity?days=${days}&debug=1`} target="_blank" className="text-blue-600 dark:text-blue-400 hover:underline text-xs">Débug API</a>
            </div>
          )}
          {!error && chartData.length>0 && mounted && (
            <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={280}>
              <BarChart data={chartData} key={days} margin={{ top: 15, right: 2, left: 2, bottom: 15 }} barCategoryGap="5%" barGap={0} width={800} height={280}>
                <XAxis dataKey="date" tick={<CustomTick />} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, maxVal===0? 4: Math.max(maxVal+1, Math.ceil(maxVal*1.05))]} />
                <Tooltip content={<CustomTooltip />} cursor={{fill:'rgba(148,163,184,0.12)'}} wrapperStyle={{pointerEvents:'none'}} />
                {avg>0 && <ReferenceLine y={avg} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Moy.', position: 'right', fill: 'currentColor', fontSize: 10 }} />}
                <Bar dataKey="displayTotal" fill="#3b82f6" radius={[6,6,0,0]} minPointSize={10} barSize={days===7?70: days===14?20:12}>
                  {chartData.map((e,i)=>(
                    <Cell key={i} fill={e.total===0? 'rgba(59,130,246,0.25)':'#3b82f6'} stroke={e.date===todayKey? '#1d4ed8': undefined} strokeWidth={e.date===todayKey?2:0} />
                  ))}
                  <LabelList dataKey="total" position="top" fontSize={11} className="fill-current" formatter={(v:number)=> v>0? v:''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {!error && (chartData.length===0 || chartData.every(d=>d.total===0)) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>Aucune activité</span>
              <a href={`/api/dashboard/daily-activity?days=${days}&debug=1`} target="_blank" className="text-blue-600 hover:underline">Vérifier l'API</a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}