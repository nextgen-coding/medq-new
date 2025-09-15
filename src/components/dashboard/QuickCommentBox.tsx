"use client";
import React, { useEffect, useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquarePlus, RefreshCcw, Send, Loader2 } from 'lucide-react';

interface QuickComment {
  id: string;
  content: string;
  createdAt: string;
  user?: { name?: string; email?: string };
  lecture?: { id: string; title: string };
  lectureTitle?: string; // fallback if API returns flat title
}
interface LectureLite { id: string; title: string; specialty: { id: string; name: string } }
interface SpecialtyLite { id: string; name: string; pinned?: boolean }

export const QuickCommentBox: React.FC = () => {
  const { user } = useAuth();
  const [specialties, setSpecialties] = useState<SpecialtyLite[]>([]);
  const [lectures, setLectures] = useState<LectureLite[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedLecture, setSelectedLecture] = useState(''); // still used only for posting
  const [comments, setComments] = useState<QuickComment[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [sending, setSending] = useState(false);
  const [comment, setComment] = useState('');
  const [anon, setAnon] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load specialties accessible to user
  useEffect(() => {
    let abort = false; (async () => {
      try { const r = await fetch('/api/dashboard/accessible-specialties'); const j = r.ok ? await r.json() : []; if(!abort && Array.isArray(j)){ setSpecialties(j); if (!selectedSpecialty && j.length) setSelectedSpecialty(j[0].id);} } catch {}
    })(); return () => { abort = true };
  }, [user?.id, refreshKey]);

  // Load lectures list (global list then filter by specialty name match) – could be optimized with param endpoint later
  useEffect(() => {
    let abort = false; (async () => {
      try { setLoadingLectures(true); const r = await fetch('/api/lectures/list'); const j = r.ok ? await r.json() : []; if(!abort) setLectures(j); } finally { if(!abort) setLoadingLectures(false); } })();
    return () => { abort = true };
  }, [refreshKey]);

  // Load comments when specialty changes (aggregate all lectures of that specialty)
  useEffect(() => {
    if(!selectedSpecialty){ setComments([]); return; }
    let abort = false;
    (async () => {
      setLoadingComments(true);
      try {
        const specLectures = lectures.filter(l => l.specialty.id === selectedSpecialty);
        const results: QuickComment[] = [];
        for (const lec of specLectures) {
          try {
            const r = await fetch(`/api/comments?lectureId=${lec.id}`);
            if (!r.ok) continue;
            const j = await r.json();
            if (Array.isArray(j)) {
              j.forEach((c: any) => results.push({ ...c, lecture: { id: lec.id, title: lec.title }, lectureTitle: lec.title }));
            }
          } catch { /* ignore individual lecture errors */ }
          if(abort) return; // early abort
        }
        if(!abort){
          // sort newest first
            results.sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setComments(results);
        }
      } finally { if(!abort) setLoadingComments(false); }
    })();
    return ()=> { abort = true };
  }, [selectedSpecialty, lectures]);

  const currentSpec = specialties.find(s => s.id === selectedSpecialty);
  const filteredLectures = lectures.filter(l => !currentSpec || l.specialty.id === currentSpec.id);

  const submit = async () => {
    if(!user?.id || !comment.trim() || !selectedLecture) return; setSending(true);
    try {
      const body = { lectureId: selectedLecture, userId: user.id, content: comment.trim(), isAnonymous: anon };
      const r = await fetch('/api/comments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if(r.ok){ const newC = await r.json();
        // attach lecture info for immediate display
        const lec = lectures.find(l=> l.id===selectedLecture);
        setComments(prev => [{ ...newC, lecture: lec? { id: lec.id, title: lec.title }: undefined, lectureTitle: lec?.title }, ...prev]);
        setComment(''); setAnon(false); setTimeout(()=> textareaRef.current?.focus(), 50); }
    } finally { setSending(false); }
  };

  const initialLoading = !specialties.length && !selectedSpecialty; // first load state

  return (
    <Card className="relative border border-border/50 bg-white/55 dark:bg-muted/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow flex flex-col overflow-hidden rounded-lg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/40 via-primary/10 to-primary/40" />
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
          <MessageSquarePlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Commentaire rapide
        </CardTitle>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={()=> setRefreshKey(k=>k+1)} title="Rafraîchir" aria-label="Rafraîchir">
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0 pb-4">
        {initialLoading ? (
          <div className="flex flex-col gap-4 py-4">
            <div className="flex gap-2">
              <div className="h-8 flex-1 rounded bg-muted/40 animate-pulse" />
              <div className="h-8 flex-1 rounded bg-muted/40 animate-pulse" />
            </div>
            <div className="h-24 rounded bg-muted/40 animate-pulse" />
            <div className="space-y-2">
              {[1,2,3].map(i=> <div key={i} className="h-10 rounded-md bg-muted/30 animate-pulse" />)}
            </div>
          </div>
        ) : (
          <>
            {/* Specialty selector (course selector moved below textarea) */}
            <div className="flex flex-col gap-2">
              <select
                className="w-full text-xs pl-3 pr-7 py-1.5 rounded-md border bg-white/80 dark:bg-muted/40 text-foreground dark:text-foreground border-border/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none shadow-sm hover:bg-white/95 dark:hover:bg-muted/60"
                value={selectedSpecialty}
                onChange={e=>{ setSelectedSpecialty(e.target.value); setSelectedLecture(''); }}
              >
                <option value="">Spécialité</option>
                {specialties.map(s => <option key={s.id} value={s.id}>{s.name}{s.pinned? ' ★':''}</option>)}
              </select>
            </div>

            {/* Editor */}
            <div className="flex flex-col gap-2">
              <Textarea
                ref={textareaRef}
                value={comment}
                onChange={e=> setComment(e.target.value)}
                placeholder={selectedLecture? 'Votre commentaire...' : 'Choisissez un cours pour publier un commentaire'}
                disabled={!selectedLecture}
                className="min-h-[90px] resize-none text-sm bg-background/60 disabled:opacity-50"
                onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey && comment.trim()){ e.preventDefault(); submit(); }}}
              />
              {selectedSpecialty && (
                <select
                  className="w-full text-xs pl-3 pr-7 py-1.5 rounded-md border bg-white/70 dark:bg-muted/40 text-foreground dark:text-foreground border-border/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none shadow-sm disabled:opacity-50"
                  value={selectedLecture}
                  onChange={e=> setSelectedLecture(e.target.value)}
                >
                  <option value="">Choisir un cours (pour publier)</option>
                  {filteredLectures.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              )}
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
                  <Checkbox className="h-3.5 w-3.5" checked={anon} disabled={!selectedLecture} onCheckedChange={v=> setAnon(!!v)} />
                  <span>Anonyme</span>
                </label>
                <Button size="sm" disabled={!comment.trim() || !selectedLecture || sending} onClick={submit} className="gap-1">
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {sending? 'Envoi...' : 'Envoyer'}
                </Button>
              </div>
            </div>

            {/* Comments list */}
            <div className="mt-1 space-y-2 max-h-56 overflow-y-auto pr-1">
              {loadingComments && (
                <div className="space-y-2">
                  {[1,2,3].map(i=> <div key={i} className="h-10 rounded-md bg-muted/30 animate-pulse" />)}
                </div>
              )}
              {!loadingComments && comments.map(c => {
                const courseName = c.lecture?.title || c.lectureTitle || '';
                return (
                  <div key={c.id} className="group relative p-3 rounded-md border border-border/40 bg-white/60 dark:bg-muted/40 hover:bg-white/80 dark:hover:bg-muted/60 transition-colors">
                    {courseName && (
                      <div className="mb-1 -mt-1 flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium max-w-full truncate">@{courseName}</span>
                      </div>
                    )}
                    <p className="text-xs leading-snug whitespace-pre-wrap text-foreground/90">{c.content}</p>
                    <div className="mt-1 flex justify-between items-center text-[10px] text-muted-foreground">
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      {c.user?.name && <span className="truncate max-w-[120px]">{c.user.name}</span>}
                    </div>
                  </div>
                );
              })}
              {!loadingComments && selectedSpecialty && comments.length===0 && (
                <div className="text-[11px] text-muted-foreground italic py-6 text-center border border-dashed border-border/50 rounded-md">
                  Aucun commentaire.
                </div>
              )}
              {!selectedSpecialty && (
                <div className="text-[11px] text-muted-foreground italic py-4 text-center">Choisissez une spécialité.</div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
export default QuickCommentBox;
