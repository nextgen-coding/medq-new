'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis, Tooltip, LabelList, Cell, ReferenceLine } from 'recharts';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ActivityPoint { date: string; total: number }
interface DailyLearningChartProps { data?: ActivityPoint[]; isLoading?: boolean; streak?: number }

const DAY_WINDOWS = [7,14,30];

export function DailyLearningChart({ data, isLoading: extLoading=false, streak }: DailyLearningChartProps) {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(()=> (typeof window!=='undefined'? parseInt(localStorage.getItem('daily_activity_days')||'7',10):7));
  const [localData, setLocalData] = useState<ActivityPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // debug mode removed (was toggled via 'bug' button)
  const [meta, setMeta] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [windowWidth, setWindowWidth] = useState<number>(1024); // Default to desktop size

  const toggleView = () => {
    setDays(prev => prev === 7 ? 30 : 7);
  };

  const viewMode = days === 7 ? '7days' : '30days';

  useEffect(() => {
    setMounted(true);
    // Set initial window width
    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
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
      } catch(e:any){ if(e.name!=='AbortError'){ setError(e.message||t('dashboard.chart.loadError', { defaultValue: 'Erreur chargement' })); setLocalData([]);} }
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
  // Responsive chart dimensions
  const getChartDimensions = () => {
    if (typeof window === 'undefined') return { height: 280, minWidth: 300 };

    const width = windowWidth;
    if (width < 640) { // Mobile
      return { height: 240, minWidth: Math.max(280, width - 16) }; // Use more conservative minWidth to prevent overflow
    } else if (width < 1024) { // Tablet
      return { height: 260, minWidth: 400 };
    } else { // Desktop
      return { height: 280, minWidth: Math.min(800, width - 100) }; // Increased from 500 to 800, with max width constraint
    }
  };

  const chartDimensions = getChartDimensions();

  // Responsive bar sizes
  const getBarSize = () => {
    if (typeof window === 'undefined') return days === 7 ? 70 : days === 14 ? 20 : 12;

    const width = windowWidth;
    const availableWidth = Math.max(width - 32, 280); // Reduced padding from 64 to 32 for mobile
    const totalBars = days;
    const minBarSize = 8;
    const maxBarSize = width >= 1024 ? (days === 7 ? 80 : days === 14 ? 35 : 20) : (days === 7 ? 70 : days === 14 ? 20 : 12); // Increased max bar sizes for desktop
    const calculatedSize = Math.max(minBarSize, Math.min(maxBarSize, (availableWidth - 40) / totalBars));

    return calculatedSize;
  };

  const barSize = getBarSize();

  // Custom tick to hide some labels to prevent overlap (especially 30j window)
  const CustomTick = (props:any) => {
    const { x, y, payload, index } = props;
    const width = windowWidth;

    // On very small screens, show fewer labels
    if (width < 480 && days >= 14 && index % 2 === 1) return null;
    if (width < 640 && days >= 30 && index % 3 !== 0) return null;
    if (width >= 640 && days === 30 && index % 2 === 1) return null;

    const fontSize = width < 640 ? 8 : width < 1024 ? 10 : 11;
    return (
      <text x={x} y={y+10} textAnchor="middle" fontSize={fontSize} fill="currentColor" className="select-none">
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

  // Mobile-optimized chart for very small screens
  const MobileChart = () => {
    const mobileData = chartData.slice(-4); // Show only last 4 days on mobile
    // Account for card padding (px-1 = 4px on each side = 8px total) + maximum buffer
    const availableWidth = windowWidth - 32; // Subtract card padding + 24px buffer for absolute safe fit
    const mobileBarSize = Math.max(14, (availableWidth) / 4); // Minimum bars for guaranteed fit

    return (
      <BarChart 
        data={mobileData} 
        width={availableWidth} // Fit within card padding
        height={chartDimensions.height} 
        margin={{ top: 8, right: 3, left: 3, bottom: 8 }} 
        barCategoryGap="3%" 
        barGap={0}
      >
        <XAxis
          dataKey="date"
          tick={{ fontSize: 8, fill: 'currentColor' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { weekday: 'short' })}
        />
        <YAxis
          tick={{ fontSize: 8, fill: 'currentColor' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          domain={[0, maxVal === 0 ? 4 : Math.max(maxVal + 1, Math.ceil(maxVal * 1.05))]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} wrapperStyle={{ pointerEvents: 'none' }} />
        {avg > 0 && <ReferenceLine y={avg} stroke="#64748b" strokeDasharray="4 4" label={{ value: t('dashboard.chart.avgLabel', { defaultValue: 'Moy.' }), position: 'right', fill: 'currentColor', fontSize: 8 }} />}
        <Bar dataKey="displayTotal" fill="#3b82f6" radius={[4, 4, 0, 0]} minPointSize={8} barSize={mobileBarSize}>
          {mobileData.map((e, i) => (
            <Cell key={i} fill={e.total === 0 ? 'rgba(59,130,246,0.25)' : '#3b82f6'} stroke={e.date === todayKey ? '#1d4ed8' : undefined} strokeWidth={e.date === todayKey ? 2 : 0} />
          ))}
          <LabelList dataKey="total" position="top" fontSize={8} className="fill-current" formatter={(v: number) => v > 0 ? v : ''} />
        </Bar>
      </BarChart>
    );
  };

  if(isLoading){
    return (
      <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg mx-0 sm:mx-auto max-w-none">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <div className="h-6 w-40 bg-muted/60 rounded animate-pulse"/>
        </CardHeader>
        <CardContent className="pb-[2px] px-1 sm:px-6">
          {/* Match loaded chart container height exactly */}
          <div 
            className="w-full relative overflow-x-auto scrollbar-hide flex justify-center" 
            style={{ 
              height: chartDimensions.height, 
              minWidth: chartDimensions.minWidth
            }}
          >
            <div className="bg-muted/60 rounded animate-pulse" style={{ width: chartDimensions.minWidth, height: chartDimensions.height }} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
  <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all mx-0 sm:mx-auto max-w-none">
              <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              {t('dashboard.chart.title', { defaultValue: 'Activité quotidienne' })}
            </CardTitle>
            <div className="flex items-center gap-2 sm:gap-3">
              {showStreak>0 && (
                <div className={`relative inline-flex items-center justify-center ${streakIsCurrent? 'animate-pulse':'opacity-75'}`}
                  title={streakIsCurrent? (maxStreak && maxStreak!==showStreak? t('dashboard.chart.currentStreakWithMax', { defaultValue: 'Série actuelle: {{current}} jours (max: {{max}})', current: showStreak, max: maxStreak }):t('dashboard.chart.currentStreak', { defaultValue: 'Série actuelle: {{streak}} jours', streak: showStreak })):t('dashboard.chart.bestStreak', { defaultValue: 'Meilleure série: {{streak}} jours', streak: showStreak })}>
                  {/* Fire emoji background */}
                  <span className="text-2xl sm:text-3xl md:text-4xl select-none filter drop-shadow-lg">🔥</span>
                  {/* Streak number overlay */}
                  <span className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-bold text-black drop-shadow-md">
                    {showStreak}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={toggleView}
                className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm font-medium"
                disabled={windowWidth < 640}
              >
                {windowWidth < 640
                  ? t('dashboard.chart.mobileView', { defaultValue: 'Vue mobile (4j)' })
                  : viewMode === '7days'
                    ? t('dashboard.chart.view30Days', { defaultValue: '30 jours' })
                    : t('dashboard.chart.view7Days', { defaultValue: '7 jours' })
                }
              </Button>
            </div>
          </div>
        </CardHeader>
      <CardContent className="pb-[2px] px-1 sm:px-6">
        <div 
          className="w-full relative overflow-hidden scrollbar-hide flex justify-center" 
          style={{ 
            height: chartDimensions.height, 
            maxWidth: windowWidth < 640 ? windowWidth - 8 : chartDimensions.minWidth
          }}
        >
          {/* Mobile scroll indicator */}
          {windowWidth < 640 && chartDimensions.minWidth > windowWidth - 32 && (
            <div className="absolute top-1 right-1 z-10 text-xs text-muted-foreground bg-background/80 px-1 rounded">
              ← →
            </div>
          )}
          <div className="relative">
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400 z-10">
                <span>{t('dashboard.chart.error', { defaultValue: 'Erreur: {{error}}', error })}</span>
                <a href={`/api/dashboard/daily-activity?days=${days}&debug=1`} target="_blank" className="text-blue-600 dark:text-blue-400 hover:underline text-xs">{t('dashboard.chart.debugApi', { defaultValue: 'Débug API' })}</a>
              </div>
            )}
            {!error && chartData.length>0 && mounted && (
              <>
                {windowWidth < 640 ? (
                  <MobileChart />
                ) : (
                  <BarChart 
                    data={chartData} 
                    key={days} 
                    width={chartDimensions.minWidth} 
                    height={chartDimensions.height} 
                    margin={{ top: 15, right: 2, left: 2, bottom: 15 }} 
                    barCategoryGap="5%" 
                    barGap={0}
                  >
                    <XAxis dataKey="date" tick={<CustomTick />} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: windowWidth < 640 ? 10 : 12, fill: 'currentColor' }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, maxVal===0? 4: Math.max(maxVal+1, Math.ceil(maxVal*1.05))]} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill:'rgba(148,163,184,0.12)'}} wrapperStyle={{pointerEvents:'none'}} />
                    {avg>0 && <ReferenceLine y={avg} stroke="#64748b" strokeDasharray="4 4" label={{ value: t('dashboard.chart.avgLabel', { defaultValue: 'Moy.' }), position: 'right', fill: 'currentColor', fontSize: 10 }} />}
                    <Bar dataKey="displayTotal" fill="#3b82f6" radius={[6,6,0,0]} minPointSize={10} barSize={barSize}>
                      {chartData.map((e,i)=>(
                        <Cell key={i} fill={e.total===0? 'rgba(59,130,246,0.25)':'#3b82f6'} stroke={e.date===todayKey? '#1d4ed8': undefined} strokeWidth={e.date===todayKey?2:0} />
                      ))}
                      <LabelList dataKey="total" position="top" fontSize={windowWidth < 640 ? 9 : 11} className="fill-current" formatter={(v:number)=> v>0? v:''} />
                    </Bar>
                  </BarChart>
                )}
              </>
            )}
            {!error && (chartData.length===0 || chartData.every(d=>d.total===0)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground z-10" style={{ width: chartDimensions.minWidth, height: chartDimensions.height }}>
                <span>{t('dashboard.chart.noActivity', { defaultValue: 'Aucune activité' })}</span>
                <a href={`/api/dashboard/daily-activity?days=${days}&debug=1`} target="_blank" className="text-blue-600 hover:underline">{t('dashboard.chart.checkApi', { defaultValue: 'Vérifier l\'API' })}</a>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}