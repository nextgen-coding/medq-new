"use client";
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, AlertCircle, Sparkles, ChevronDown, Pin, PinOff } from 'lucide-react';
import Link from "next/link";

export const CoursesToReview: React.FC = () => {
  const { coursesToReview: initialCourses, isLoading: dashboardLoading } = useDashboardData();
  const { user } = useAuth();
  const [specialties, setSpecialties] = useState<Array<{id:string; name:string; pinned?:boolean}>>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load accessible specialties (filtered by user role/niveau/semester)
  useEffect(()=>{
    let abort = false;
    const load = async()=>{
      if(!user?.id) return;
      try {
        const res = await fetch('/api/dashboard/accessible-specialties');
        const j = res.ok? await res.json(): [];
        if(!abort){
          const list = Array.isArray(j)? j: [];
          setSpecialties(list);
          // Auto select first if none selected
          if(!selectedSpecialty && list.length>0){
            setSelectedSpecialty(list[0].id);
          }
        }
      } catch {}
    };
    load();
    return ()=>{ abort=true };
  },[user?.id]);

  // Adjust selected specialty if pinned filter hides current
  useEffect(()=>{
    const visible = specialties.filter(s=> !pinnedOnly || s.pinned);
    if(visible.length===0){
      // No visible specialties, clear selection
      if(selectedSpecialty) setSelectedSpecialty('');
    } else if(!visible.find(s=> s.id=== selectedSpecialty)){
      setSelectedSpecialty(visible[0].id);
    }
  },[pinnedOnly, specialties, selectedSpecialty]);

  // Fetch courses on filter change (requires a selected specialty)
  useEffect(()=>{
    let abort = false;
    const load = async()=>{
      if(!selectedSpecialty){ setCourses([]); return; }
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('specialtyId', selectedSpecialty);
        if(pinnedOnly) params.append('pinnedOnly','1');
        const r = await fetch(`/api/dashboard/courses-to-review?${params.toString()}`);
        const j = r.ok? await r.json(): [];
        if(!abort) setCourses(j);
      } catch { if(!abort) setCourses([]); }
      finally { if(!abort) setLoading(false); }
    };
    load();
    return ()=>{ abort=true };
  },[selectedSpecialty, pinnedOnly]);

  const isLoading = dashboardLoading || loading;
  const list = courses; // always specialty-specific now
  const visibleSpecialties = specialties.filter(s=> !pinnedOnly || s.pinned);
  const currentSpec = specialties.find(s=> s.id===selectedSpecialty);

  const handleRefresh = () => {
    // force refetch by toggling selectedSpecialty temporary
    if(selectedSpecialty){
      const temp = selectedSpecialty;
      setSelectedSpecialty('');
      setTimeout(()=> setSelectedSpecialty(temp), 10);
    }
  };

  return (
  <Card
    className="relative border border-border/50 bg-white/55 dark:bg-muted/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow flex flex-col overflow-hidden rounded-lg"
    /* Taller card for more scrollable space */
  >
      {/* Accent gradient top line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/40 via-primary/10 to-primary/40" />
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
          <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          Cours à revoir
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
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hover:bg-background/60"
            onClick={handleRefresh}
            title="Rafraîchir"
            aria-label="Rafraîchir la liste des cours à revoir"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
  <p className="px-6 -mt-1 mb-3 text-xs text-muted-foreground">Vos cours &lt; 10/20 pour révision ciblée</p>
  <CardContent className="relative flex-1 flex flex-col pt-0 min-h-[460px]"> {/* ensure taller area */}
        {/* Filters */}
  <div className="flex flex-wrap items-center gap-2 mb-4 px-0.5">
          {visibleSpecialties.length>0 ? (
            <div className="relative group">
              <select
                value={selectedSpecialty}
                onChange={e=> setSelectedSpecialty(e.target.value)}
    className="text-xs pl-3 pr-7 py-1.5 rounded-md border bg-white/80 dark:bg-muted/40 text-foreground dark:text-foreground border-border/50 dark:border-border/40 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none shadow-sm transition-colors hover:bg-white/95 dark:hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundImage: 'none' }}
              >
                {visibleSpecialties.map(s=> <option key={s.id} value={s.id}>{s.name}{s.pinned? ' ★':''}</option>)}
              </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground italic">
              <AlertCircle className="w-3.5 h-3.5" />
              {pinnedOnly? 'Aucune spécialité épinglée' : 'Aucune spécialité'}
            </div>
          )}
  {/* Removed inline pinned toggle; now an icon button in header */}
          {currentSpec && (
            <Badge variant="secondary" className="text-[10px] font-medium bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary border-primary/20">
              {list.length} cours
            </Badge>
          )}
        </div>

        {pinnedOnly && visibleSpecialties.length===0 && (
          <div className="text-xs text-muted-foreground mb-3 px-1">Épinglez des spécialités pour les voir ici.</div>
        )}

        {isLoading && selectedSpecialty && (
          <div className="space-y-2 mb-2">
            {Array.from({length:5}).map((_,i)=>(
              <div key={i} className="h-9 rounded-md bg-muted/40 dark:bg-muted/30 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && selectedSpecialty && list.length === 0 && currentSpec && (
          <div className="flex flex-col items-center justify-center text-center py-10 px-6 rounded-lg border border-dashed border-border/60 bg-white/40 dark:bg-muted/40">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/15 text-amber-500 mb-3">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold mb-1 text-foreground">Rien à revoir 🎉</p>
            <p className="text-xs text-muted-foreground">Aucun cours &lt; 10/20 pour « {currentSpec.name} ».</p>
          </div>
        )}

        {/* List */}
        {list.length>0 && (
      <ul className="space-y-2 overflow-y-auto pr-1 max-h-[420px] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted/40 hover:scrollbar-thumb-muted/60">
            {list.map((c: any) => {
              const note20 = (c.averageScore/5).toFixed(1);
              return (
                <li key={c.id} className="group relative flex items-center gap-3 rounded-md border border-border/40 bg-white/60 dark:bg-muted/40 hover:bg-white/80 dark:hover:bg-muted/60 transition-colors px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <Link href={c.specialtyId? `/matieres/${c.specialtyId}/cours/${c.id}`:`/lecture/${c.id}`} className="truncate font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                      {c.title}
                    </Link>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Objectif : 15/20</div>
                  </div>
                  {(() => {
                    const val = parseFloat(note20);
                    let badgeTone = 'bg-primary/10 text-primary border-primary/25';
                    if (val < 5) badgeTone = 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25';
                    else if (val < 8) badgeTone = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25';
                    return (
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[11px] px-2 py-1 font-semibold tracking-tight backdrop-blur-sm border ${badgeTone}`}
                        aria-label={`Note moyenne ${note20} sur 20`}
                      >
                        {note20}/20
                      </Badge>
                    );
                  })()}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
export default CoursesToReview;
