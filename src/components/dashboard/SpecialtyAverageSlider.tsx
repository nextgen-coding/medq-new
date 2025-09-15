"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useDashboardData } from "@/hooks/useDashboardData";
import { BarChart3, ChevronLeft, ChevronRight, RefreshCcw, Pin, PinOff } from "lucide-react";

interface AccessibleSpecialty { id: string; name: string; pinned?: boolean }

export const SpecialtyAverageSlider: React.FC = () => {
  const { specialtyAverages, popularCourses, isLoading } = useDashboardData();
  const [specialties, setSpecialties] = useState<AccessibleSpecialty[]>([]);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [index, setIndex] = useState(0);
  const [refreshFlag, setRefreshFlag] = useState(0);

  // Fetch specialties
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const r = await fetch('/api/dashboard/accessible-specialties');
        const j = r.ok ? await r.json() : [];
        if (!abort && Array.isArray(j)) setSpecialties(j);
      } catch {/* ignore */}
    })();
    return () => { abort = true; };
  }, [refreshFlag]);

  const visible = specialties.filter(s => !pinnedOnly || s.pinned);
  // Clamp index when visibility changes
  useEffect(() => { if (index >= visible.length) setIndex(0); }, [visible.length, index]);

  const current = visible[index];

  // Compute average percent for each visible specialty (memoized map)
  const avgMap = useMemo(() => {
    const map: Record<string, number> = {};
    visible.forEach(sp => {
      // collect courses belonging to this specialty by name
      const courses = popularCourses.filter(c => c.specialty?.name === sp.name);
      if (courses.length) map[sp.id] = courses.reduce((a,b)=> a + b.averageScore, 0) / courses.length; else {
        const pre = specialtyAverages.find(sa => sa.name === sp.name);
        map[sp.id] = pre ? pre.average : 0;
      }
    });
    return map;
  }, [visible, popularCourses, specialtyAverages]);

  const percent = current ? (avgMap[current.id] || 0) : 0; // 0-100
  const out20 = (percent / 5).toFixed(2); // convert to /20
  const unfinishedHint = percent === 0 ? "Aucune progression" : "Terminez tous les cours pour une moyenne réelle";

  const next = useCallback(() => { if (visible.length) setIndex(i => (i + 1) % visible.length); }, [visible.length]);
  const prev = useCallback(() => { if (visible.length) setIndex(i => (i - 1 + visible.length) % visible.length); }, [visible.length]);
  const handleRefresh = () => setRefreshFlag(f => f + 1);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  return (
    <Card className="relative border border-border/50 bg-white/55 dark:bg-muted/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow flex flex-col overflow-hidden rounded-lg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/40 via-primary/10 to-primary/40" />
      <CardHeader className="pb-1 flex flex-row items-start justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight leading-snug bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
          <BarChart3 className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>Moyennes</span>
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant={pinnedOnly ? "secondary" : "ghost"}
            className={`h-8 w-8 ${pinnedOnly ? 'bg-primary/15 text-primary hover:bg-primary/20 dark:bg-primary/20' : ''}`}
            onClick={() => setPinnedOnly(p => !p)}
            aria-pressed={pinnedOnly}
            title={pinnedOnly ? 'Afficher toutes les spécialités' : 'Afficher seulement les épinglées'}
            aria-label="Filtrer spécialités épinglées"
          >
            {pinnedOnly ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={prev} disabled={!visible.length} aria-label="Précédent"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={next} disabled={!visible.length} aria-label="Suivant"><ChevronRight className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleRefresh} title="Rafraîchir" aria-label="Rafraîchir"><RefreshCcw className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center p-4 pt-0">
        {/* Removed centered pinned toggle; now an icon button in header */}
        {isLoading && (
          <div className="flex flex-col items-center gap-5 py-4">
            <div className="relative w-40 h-40">
              <div className="absolute inset-0 rounded-full bg-muted/40 animate-pulse" />
            </div>
            <div className="space-y-2 w-full flex flex-col items-center">
              <div className="h-3 w-32 rounded bg-muted/40 animate-pulse" />
              <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
            </div>
          </div>
        )}
        {!isLoading && !current && (
          <div className="text-xs text-muted-foreground py-6">Aucune spécialité disponible</div>
        )}
        {!isLoading && current && (
          <div className="relative flex flex-col items-center">
            <div className="text-xs text-muted-foreground mb-2 tracking-wide">{index + 1}/{visible.length}</div>
      <div className="relative w-48 h-48 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="6" className="text-muted/30 fill-none" />
                <circle
                  cx="50" cy="50" r="44" stroke="url(#gradSpecAvg)" strokeWidth="6" strokeLinecap="round" className="fill-none"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - percent / 100)}`}
                />
                <defs>
                  <linearGradient id="gradSpecAvg" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                <span className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">{out20}</span>
                <span className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">/20</span>
              </div>
            </div>
            <h3 className="-mt-1 mb-2 text-center text-lg font-semibold text-slate-800 dark:text-slate-100 leading-snug px-2 max-w-[240px] truncate" title={current.name}>{current.name}</h3>
            <p className="text-[11px] text-muted-foreground text-center max-w-[220px] leading-snug">
              {unfinishedHint}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SpecialtyAverageSlider;
