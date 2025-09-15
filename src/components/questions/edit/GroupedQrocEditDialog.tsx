"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Question } from '@/types';
import { toast } from '@/hooks/use-toast';

interface GroupedQrocEditDialogProps {
  caseNumber: number;
  questions: Question[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (updated: Question[]) => void;
}

type EditableSub = { id: string; text: string; answer: string; };
interface GroupReminderState { text: string; mediaUrl?: string; mediaType?: 'image' | 'video'; }

export function GroupedQrocEditDialog({ caseNumber, questions, isOpen, onOpenChange, onSaved }: GroupedQrocEditDialogProps) {
  const [subs, setSubs] = useState<EditableSub[]>([]);
  const [groupReminder, setGroupReminder] = useState<GroupReminderState>({ text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
  const mapped = questions
        .slice()
        .sort((a,b)=>(a.caseQuestionNumber||0)-(b.caseQuestionNumber||0))
        .map(q=>({
          id: q.id,
          text: q.text || '',
          answer: (q.correctAnswers || q.correct_answers || [])[0] || ''
        }));
  // All subs share same courseReminder + media; take first non-empty
  const withReminder = questions.find(q => (q as any).course_reminder || (q as any).courseReminder || (q as any).course_reminder_media_url);
  const reminderText = withReminder ? ((withReminder as any).course_reminder || (withReminder as any).courseReminder || '') : '';
  const reminderMediaUrl = withReminder ? ((withReminder as any).course_reminder_media_url || (withReminder as any).courseReminderMediaUrl) : undefined;
  const reminderMediaType: 'image' | 'video' | undefined = withReminder ? ((withReminder as any).course_reminder_media_type || (withReminder as any).courseReminderMediaType) : undefined;
  setGroupReminder({ text: reminderText, mediaUrl: reminderMediaUrl, mediaType: reminderMediaType });
      setSubs(mapped);
    }
  }, [isOpen, questions]);

  const updateSub = (id: string, patch: Partial<EditableSub>) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const handleSave = async () => {
    for (const s of subs) {
      if (!s.text.trim()) { toast({ title: 'Texte manquant', description: 'Chaque sous-question doit avoir un énoncé.', variant: 'destructive' }); return; }
      if (!s.answer.trim()) { toast({ title: 'Réponse manquante', description: 'Chaque sous-question QROC doit avoir une réponse de référence.', variant: 'destructive' }); return; }
    }
    try {
      setSaving(true);
      const updated: Question[] = [] as any;
      for (let order = 0; order < subs.length; order++) {
        const s = subs[order];
        const body: any = {
          text: s.text.trim(),
          correctAnswers: [s.answer.trim()],
          courseReminder: groupReminder.text.trim() || null,
          courseReminderMediaUrl: groupReminder.mediaUrl || null,
          courseReminderMediaType: groupReminder.mediaUrl ? (groupReminder.mediaType || 'image') : null,
          caseQuestionNumber: order + 1
        };
        const resp = await fetch(`/api/questions/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
        if (!resp.ok) { const err = await resp.json().catch(()=>({})); throw new Error(err.error || `Échec mise à jour sous-question ${order+1}`); }
        updated.push(await resp.json());
      }
      toast({ title: 'Bloc QROC mis à jour', description: `${subs.length} sous-question(s) enregistrée(s).` });
      onSaved?.(updated);
      onOpenChange(false);
    } catch(e:any) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour échouée.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={o => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Éditer Bloc QROC #{caseNumber}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
          <QuickParseGroupedQrocEdit
            subs={subs}
            updateSub={updateSub}
          />
          {subs.map((s, idx)=>(
            <div key={s.id} className="border rounded-md p-4 space-y-3 bg-muted/30">
              <div className="text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded w-fit">QROC {idx+1}</div>
              <div className="space-y-2">
                <Label>Énoncé *</Label>
                <Textarea rows={3} value={s.text} onChange={e=> updateSub(s.id,{ text: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Réponse de référence *</Label>
                <Textarea rows={2} value={s.answer} onChange={e=> updateSub(s.id,{ answer: e.target.value })} placeholder="Réponse courte (multi-lignes possible)" className="resize-y" />
              </div>
              {/* Explanation removed; shared reminder used instead */}
            </div>
          ))}
          {subs.length===0 && <p className="text-sm text-muted-foreground">Aucune sous-question.</p>}
          <div className="space-y-2 mt-4">
            <Label>Rappel du cours (optionnel)</Label>
            <div className="flex items-center gap-2 mb-1">
              <Button type="button" variant="outline" size="sm" className="relative">
                Image du rappel
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={async (e) => {
                    const file = e.currentTarget.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith('image/')) { e.currentTarget.value=''; return; }
                    const MAX = 2 * 1024 * 1024;
                    if (file.size > MAX) { toast({ title: 'Image trop lourde', description: 'Max 2 Mo', variant: 'destructive' }); e.currentTarget.value=''; return; }
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
                      setGroupReminder(r => ({ ...r, mediaUrl: dataUrl, mediaType: dataUrl ? 'image' : undefined }));
                    };
                    reader.readAsDataURL(file);
                    e.currentTarget.value='';
                  }}
                />
              </Button>
              {groupReminder.mediaUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={()=> setGroupReminder(r=> ({ ...r, mediaUrl: undefined, mediaType: undefined }))}>Supprimer l'image</Button>
              )}
            </div>
            <Textarea rows={3} value={groupReminder.text} onChange={e=> setGroupReminder(r=> ({ ...r, text: e.target.value }))} placeholder="Texte de référence partagé pour tout le bloc" />
            {groupReminder.mediaUrl && (
              <div className="mt-2 border rounded-md p-3 bg-muted/30">
                <div className="aspect-video relative bg-muted rounded-md overflow-hidden">
                  <img src={groupReminder.mediaUrl} alt="Image du rappel" className="w-full h-full object-contain" />
                </div>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground pl-1">Ajout / suppression de sous-questions non supporté dans cet éditeur.</p>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={()=> onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || subs.length===0} className="bg-blue-600 hover:bg-blue-700 text-white">{saving? 'Enregistrement...' : 'Enregistrer'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ================= Global Quick Parse (Bloc QROC) =================
function QuickParseGroupedQrocEdit({ subs, updateSub }: { subs: EditableSub[]; updateSub: (id:string, patch: Partial<EditableSub>)=> void }) {
  const [raw, setRaw] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(()=> {
    if (initialized) return;
    const lines: string[] = [];
    subs.forEach((s, idx)=> {
      lines.push(`Q${idx+1}:`);
      (s.text || '').split(/\r?\n/).forEach(l=> lines.push(l));
      lines.push(`Réponse: ${s.answer || ''}`);
      lines.push('');
    });
    setRaw(lines.join('\n').trimEnd());
    setInitialized(true);
  }, [initialized, subs]);

  const handleCopy = async () => { try { await navigator.clipboard.writeText(raw); toast({ title:'Copié', description:'Bloc QROC copié.'}); } catch { toast({ title:'Erreur', description:'Copie impossible', variant:'destructive'});} };

  const parse = () => {
    if (!raw.trim()) { toast({ title:'Vide', description:'Rien à analyser.'}); return; }
    const lines = raw.replace(/\r/g,'').split('\n');
    const header = /^Q(\d+)\s*:/i;
    const parsed: { text:string; answer:string }[] = [];
    let i=0;
    while(i<lines.length) {
      while(i<lines.length && !header.test(lines[i])) i++;
      if (i>=lines.length) break;
      i++; // past Qn:
      const textLines: string[] = [];
      while(i<lines.length && !/^Réponse:/i.test(lines[i]) && !header.test(lines[i])) { textLines.push(lines[i]); i++; }
      let answer='';
      if (i<lines.length && /^Réponse:/i.test(lines[i])) { answer = lines[i].replace(/^Réponse:\s*/i,'').trim(); i++; }
      while(i<lines.length && lines[i].trim()==='') i++; // skip blanks
      parsed.push({ text: textLines.join('\n').trim(), answer });
    }
    if (!parsed.length) { toast({ title:'Format invalide', description:'Aucune sous-question détectée.', variant:'destructive' }); return; }
    // Only update up to existing count
    parsed.forEach((p, idx)=> { if (idx < subs.length) updateSub(subs[idx].id, { text: p.text, answer: p.answer }); });
    toast({ title:'Analyse effectuée', description:'Sous-questions mises à jour.' });
  };

  return (
    <div className="space-y-2 border rounded-md p-3 bg-muted/40">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Parse rapide (Bloc complet)</h3>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>Copier</Button>
          <Button type="button" size="sm" onClick={parse}>Analyser</Button>
        </div>
      </div>
      <Textarea
        value={raw}
        onChange={e=> setRaw(e.target.value)}
        className="min-h-56 font-mono text-xs"
        placeholder={`Q1:\nÉnoncé...\nRéponse: ...\n\nQ2:\nÉnoncé...\nRéponse: ...`}
      />
      <p className="text-[10px] text-muted-foreground leading-snug">Format: Qn: puis lignes d'énoncé jusqu'à "Réponse:". Ne change pas le nombre de sous-questions.</p>
    </div>
  );
}
