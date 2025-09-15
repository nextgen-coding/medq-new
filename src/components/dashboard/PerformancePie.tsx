"use client";
import React, { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// Colors aligned with dashboard theme (emerald, rose, amber)
const COLORS = ["#059669", "#dc2626", "#f59e0b"]; // tweak green to match tailwind emerald-600
const TIMEFRAMES = [1, 7, 30, 90];

export const PerformancePie: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [timeframe, setTimeframe] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('perf_timeframe');
      return saved ? parseInt(saved, 10) : 30;
    }
    return 30;
  });
  const [perf, setPerf] = useState<any>(null);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showPercent, setShowPercent] = useState(true);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

  const fetchPerf = async (days: number) => {
    setLoadingPerf(true);
    try {
      const res = await fetch(`/api/dashboard/performance?days=${days}`);
      if (res.ok) {
        const json = await res.json();
        setPerf(json);
      } else {
        setPerf(null);
      }
    } finally {
      setLoadingPerf(false);
    }
  };

  useEffect(() => { if (mounted) fetchPerf(timeframe); }, [mounted, timeframe]);
  useEffect(() => { if (mounted) window.localStorage.setItem('perf_timeframe', String(timeframe)); }, [timeframe, mounted]);

  const data = useMemo(() => {
    if (!perf) return [];
    return [
  { key: 'correct', label: 'Juste', value: perf.correct, pct: perf.percentCorrect },
  { key: 'wrong', label: 'Faux', value: perf.wrong, pct: perf.percentWrong },
  { key: 'partial', label: 'Partiel', value: perf.partial, pct: perf.percentPartial }
    ].filter(d => d.value > 0);
  }, [perf]);

  const total = perf?.total || 0;
  const successPct = perf?.percentCorrect ?? 0;

  if (!mounted || loadingPerf && !perf) {
    return (
      <Card className="relative border border-border/50 bg-white/55 dark:bg-muted/30 backdrop-blur-sm shadow-lg rounded-lg overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/40 via-primary/10 to-primary/40" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
            <PieIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col items-center justify-center min-h-[350px] gap-4">
          <div className="relative w-52 h-52">
            <div className="absolute inset-0 rounded-full bg-muted/40 animate-pulse" />
          </div>
          <div className="space-y-2 w-full max-w-xs">
            {[1,2,3].map(i=> <div key={i} className="h-8 w-full rounded-xl bg-muted/40 animate-pulse" />)}
          </div>
        </CardContent>
      </Card>
    );
  }
  // We no longer early-return on empty data so timeframe controls remain available.

  return (
    <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 group">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
  <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
          <PieIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Performance
        </CardTitle>
        <div className="flex gap-1 mt-1">
          {TIMEFRAMES.map(d => (
            <button
              key={d}
              onClick={() => setTimeframe(d)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${timeframe === d ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-transparent dark:text-slate-300 border-border/40 hover:bg-blue-500/10'}`}
              disabled={loadingPerf && timeframe === d}
            >{d}j</button>
          ))}
          <button
            onClick={() => setShowPercent(p => !p)}
            className={`ml-1 px-2 py-0.5 rounded text-[11px] font-medium border border-border/40 hover:bg-emerald-500/10 ${showPercent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-300'}`}
            title="Basculer valeurs (%) / absolues"
          >{showPercent ? '%': '#'}
          </button>
        </div>
      </CardHeader>
      {/* Layout: chart (with center stats) + legend list */}
      <CardContent className="flex-1 flex flex-col md:flex-row gap-6 md:gap-12 items-center md:items-center justify-center md:justify-start py-2">
        {/* Donut chart or empty placeholder */}
        <div className="relative" style={{width:220, height:208}}>
          {loadingPerf && !perf ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Mise à jour...</div>
          ) : total === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <div className="w-36 h-36 rounded-full border-4 border-dashed border-slate-200 dark:border-slate-600 flex items-center justify-center">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 px-2 leading-tight">Aucune donnée<br/>pour {timeframe}j</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[150px] leading-snug">Répondez à des questions pour voir vos statistiques.</p>
            </div>
          ) : (
            <>
              <PieChart width={220} height={220}>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={2}
                  onMouseEnter={(_, idx) => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  isAnimationActive
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.key}
                      fill={COLORS[index % COLORS.length]}
                      opacity={activeIndex === null || activeIndex === index ? 1 : 0.35}
                      stroke={isDark ? '#0c1320' : '#ffffff'}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  wrapperStyle={{ zIndex: 50 }}
                  contentStyle={{
                    background: '#111827',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '6px 10px'
                  }}
                  labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                  itemStyle={{ color: '#f1f5f9', fontSize: 12 }}
                  formatter={(value: any, name: any) => {
                    const item = data.find(d => d.label === name);
                    return showPercent
                      ? [ `${item?.pct ?? 0}%`, name ]
                      : [ `${value}`, name ];
                  }}
                />
              </PieChart>
              {/* Center overlay when we have data */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">{showPercent ? successPct + '%' : perf.correct}</span>
                <span className="mt-1 text-[9px] tracking-wide text-muted-foreground uppercase">{showPercent ? 'Taux de réussite' : 'Justes'}</span>
                <span className="mt-0.5 text-[9px] text-muted-foreground">{total} essais · {timeframe}j</span>
              </div>
            </>
          )}
        </div>
        {/* Legend */}
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {total === 0 ? (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-4 py-6 text-center leading-snug">
              Aucune réponse enregistrée sur cette période.<br/>Changez la durée ci-dessus ou répondez à des questions.
            </div>
          ) : (
            data.map((d, i) => (
              <div
                key={d.key}
                className={
                  `flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-border/40 backdrop-blur-sm shadow-inner transition-colors` +
                  (isDark
                    ? ' bg-gradient-to-r from-slate-900/40 to-slate-900/10'
                    : ' bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-100 hover:to-slate-100')
                }
              >
                <div className="flex items-center gap-3">
                  <span className={`w-3.5 h-3.5 rounded-sm ring-1 ${isDark ? 'ring-white/10' : 'ring-slate-300/50'}`} style={{ background: COLORS[i] }} />
                  <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{d.label}</span>
                </div>
                <div className={`text-sm font-semibold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {showPercent ? `${d.pct}%` : d.value}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformancePie;
