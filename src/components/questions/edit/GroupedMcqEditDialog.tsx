"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Question, Option } from '@/types';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

interface GroupedMcqEditDialogProps {
  caseNumber: number;
  questions: Question[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (updated: Question[]) => void;
}

type EditableSub = { id: string; text: string; options: Option[]; correctAnswers: string[] };

export function GroupedMcqEditDialog({ caseNumber, questions, isOpen, onOpenChange, onSaved }: GroupedMcqEditDialogProps) {
  const [subs, setSubs] = useState<EditableSub[]>([]);
  const [saving, setSaving] = useState(false);
  const [raw, setRaw] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [commonText, setCommonText] = useState('');

  useEffect(() => {
    if (isOpen) {
      const mapped = questions
        .slice()
        .sort((a,b)=>(a.caseQuestionNumber||0)-(b.caseQuestionNumber||0))
        .map(q=>({
          id: q.id,
          text: q.text || '',
          options: (q.options || []).map(o => ({ id: o.id, text: o.text, explanation: o.explanation })),
          correctAnswers: (q.correctAnswers || q.correct_answers || [])
        }));
      setSubs(mapped);
      // initialize quick parse block once per open
      setInitialized(false);
      // Common case text: take first non-empty caseText across subs
      const withCaseText = questions.find(q => (q as any).caseText && (q as any).caseText.trim());
      setCommonText(withCaseText ? ((withCaseText as any).caseText as string) : '');
    }
  }, [isOpen, questions]);

  const updateSub = (id: string, patch: Partial<EditableSub>) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const updateOption = (sid: string, oid: string, patch: Partial<Option>) => {
    setSubs(prev => prev.map(s => s.id === sid ? { ...s, options: s.options.map(o => o.id === oid ? { ...o, ...patch } : o) } : s));
  };

  const addOption = (sid: string) => {
    setSubs(prev => prev.map(s => s.id === sid ? { ...s, options: [...s.options, { id: `opt_${Math.random().toString(36).slice(2)}`, text: '', explanation: '' }] } : s));
  };

  const removeOption = (sid: string, oid: string) => {
    setSubs(prev => prev.map(s => s.id === sid ? { ...s, options: s.options.filter(o => o.id !== oid), correctAnswers: s.correctAnswers.filter(c => c !== oid) } : s));
  };

  const toggleCorrect = (sid: string, oid: string) => {
    setSubs(prev => prev.map(s => s.id === sid ? { ...s, correctAnswers: s.correctAnswers.includes(oid) ? s.correctAnswers.filter(c => c !== oid) : [...s.correctAnswers, oid] } : s));
  };

  // ---------- Quick Parse (Bloc complet) ----------
  useEffect(()=>{
    if (!isOpen || initialized) return;
    const lines: string[] = [];
    subs.forEach((s, idx)=>{
      lines.push(`Q${idx+1}:`);
      lines.push(`Énoncé: ${s.text || ''}`);
      s.options.forEach((o, oIdx)=>{
        const mark = s.correctAnswers.includes(o.id) ? 'x' : ' ';
        lines.push(`[${mark}] ${String.fromCharCode(65+oIdx)}) ${o.text || ''}`);
        if ((o.explanation||'').trim()) {
          const explLines = (o.explanation||'').split(/\r?\n/);
          lines.push(`    Explication: ${explLines[0] || ''}`);
          for (let i=1;i<explLines.length;i++) lines.push(`    ${explLines[i]}`);
        }
      });
      lines.push('');
    });
    setRaw(lines.join('\n').trimEnd());
    setInitialized(true);
  }, [isOpen, initialized, subs]);

  const handleCopy = async () => { try { await navigator.clipboard.writeText(raw); toast({ title:'Copié', description:'Bloc QCM copié.'}); } catch { toast({ title:'Erreur', description:'Copie impossible', variant:'destructive'});} };
  const parseRaw = () => {
    if (!raw.trim()) { toast({ title:'Vide', description:'Rien à analyser.'}); return; }
    const lines = raw.replace(/\r/g,'').split('\n');
    const parsed: { statement: string; options: { text:string; correct:boolean; explanation?: string }[] }[] = [];
    let i=0; const header = /^Q(\d+)\s*:/i;
    while(i<lines.length) {
      while(i<lines.length && !header.test(lines[i])) i++;
      if (i>=lines.length) break;
      i++; // past Qn:
      let statement = '';
      if (i<lines.length && /^Énoncé:/i.test(lines[i])) { statement = lines[i].replace(/^Énoncé:\s*/i,'').trim(); i++; }
      const opts: { text:string; correct:boolean; explanation?:string }[] = [];
      const optPattern = /^\[(x|X| )\]\s*([A-Z])\)\s*(.*)$/;
      const explMarker = /^\s{2,}Explication\s*[:\-]\s*(.*)$/i;
      const anyIndented = /^\s{2,}(.*)$/;
      while(i<lines.length && !header.test(lines[i])) {
        const line = lines[i];
        if (!line.trim()) { i++; break; }
        const m = line.match(optPattern);
        if (m) {
          opts.push({ text: m[3].trim(), correct: m[1].toLowerCase()==='x' }); i++; continue;
        }
        // try explanation line for last option
        if (opts.length) {
          const em = line.match(explMarker);
          if (em) { opts[opts.length-1].explanation = (opts[opts.length-1].explanation ? opts[opts.length-1].explanation + '\n' : '') + em[1]; i++; continue; }
          const ind = line.match(anyIndented);
          if (ind) { opts[opts.length-1].explanation = (opts[opts.length-1].explanation ? opts[opts.length-1].explanation + '\n' : '') + ind[1]; i++; continue; }
        }
        i++;
      }
      parsed.push({ statement, options: opts });
    }
    if (!parsed.length) { toast({ title:'Format invalide', description:'Aucune sous-question détectée.', variant:'destructive' }); return; }
    // apply onto existing sub structure only (no add/remove)
    setSubs(prev => prev.map((s, idx) => {
      const p = parsed[idx]; if (!p) return s;
      const newOptions = s.options.map((o, oIdx) => {
        const src = p.options[oIdx]; if (!src) return o;
        return { ...o, text: src.text, explanation: src.explanation || '' };
      });
      const newCorrect = new Set<string>();
      s.options.forEach((o, oIdx) => { if (oIdx < p.options.length && p.options[oIdx].correct) newCorrect.add(o.id); });
      return { ...s, text: p.statement, options: newOptions, correctAnswers: Array.from(newCorrect) };
    }));
    toast({ title:'Analyse effectuée', description:'Sous-questions mises à jour.' });
  };

  const handleSave = async () => {
    for (const s of subs) {
      if (!s.text.trim()) { toast({ title: 'Texte manquant', description: 'Chaque sous-question doit avoir un énoncé.', variant: 'destructive' }); return; }
      const valid = s.options.filter(o=> (o.text||'').trim());
      if (valid.length < 2) { toast({ title: 'Options insuffisantes', description: 'Chaque QCM doit avoir au moins 2 options valides.', variant: 'destructive' }); return; }
      if (s.correctAnswers.length === 0) { toast({ title: 'Bonne réponse', description: 'Sélectionnez au moins une bonne réponse par QCM.', variant: 'destructive' }); return; }
    }
    try {
      setSaving(true);
      const updated: Question[] = [] as any;
      for (let order = 0; order < subs.length; order++) {
        const s = subs[order];
        const body: any = {
          text: s.text.trim(),
          options: s.options.filter(o=> (o.text||'').trim()).map(o=> ({ id: o.id, text: o.text.trim(), explanation: (o.explanation||'').trim() })),
          correctAnswers: s.correctAnswers,
          caseText: (commonText || '').trim() || null,
          caseQuestionNumber: order + 1
        };
        const resp = await fetch(`/api/questions/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
        if (!resp.ok) { const err = await resp.json().catch(()=>({})); throw new Error(err.error || `Échec mise à jour sous-question ${order+1}`); }
        updated.push(await resp.json());
      }
      toast({ title: 'Bloc QCM mis à jour', description: `${subs.length} sous-question(s) enregistrée(s).` });
      onSaved?.(updated);
      onOpenChange(false);
    } catch(e:any) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour échouée.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={o => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Éditer Bloc QCM #{caseNumber}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
          <div className="space-y-2">
            <Label>Texte commun (optionnel)</Label>
            <Textarea rows={3} value={commonText} onChange={e=> setCommonText(e.target.value)} placeholder="Texte commun affiché en haut du bloc" />
          </div>
          {/* Quick Parse (Bloc complet) */}
          <div className="space-y-2 border rounded-md p-3 bg-muted/40">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold">Parse rapide (Bloc complet)</h3>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCopy}>Copier</Button>
                <Button type="button" size="sm" onClick={parseRaw}>Analyser</Button>
              </div>
            </div>
            <Textarea
              value={raw}
              onChange={e=> setRaw(e.target.value)}
              className="min-h-56 font-mono text-xs"
              placeholder={`Q1:\nÉnoncé: ...\n[x] A) ...\n    Explication: ... (optionnel)\n[ ] B) ...\n\nQ2:\nÉnoncé: ...\n[ ] A) ...\n[x] B) ...`}
            />
            <p className="text-[10px] text-muted-foreground leading-snug">Format: Qn:, Énoncé:, puis options "[x] A)" (x = bonne). Lignes indentées ou "Explication:" s'attachent à l'option précédente.</p>
          </div>
          {subs.map((s, idx)=>(
            <div key={s.id} className="border rounded-md p-4 space-y-3 bg-muted/30">
              <div className="text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded w-fit">QCM {idx+1}</div>
              <div className="space-y-2">
                <Label>Énoncé *</Label>
                <Textarea rows={3} value={s.text} onChange={e=> updateSub(s.id,{ text: e.target.value })} />
              </div>
              <div className="space-y-3">
                {s.options.map((o,oIdx)=>(
                  <div key={o.id} className="flex items-start gap-2 border rounded-md p-2">
                    <div className="pt-2 text-xs w-5 text-center">{String.fromCharCode(65+oIdx)}</div>
                    <div className="flex-1 space-y-2">
                      <Input placeholder={`Option ${oIdx+1}`} value={o.text} onChange={e=> updateOption(s.id,o.id,{ text: e.target.value })} />
                      <Textarea
                        placeholder="Explication (optionnel)"
                        value={o.explanation||''}
                        onChange={(e) => updateOption(s.id, o.id, { explanation: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="flex flex-col gap-2 items-center">
                      <label className="text-xs flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={s.correctAnswers.includes(o.id)} onChange={()=> toggleCorrect(s.id,o.id)} />Bonne</label>
                      <Button type="button" size="sm" variant="ghost" disabled={s.options.length<=2} onClick={()=> removeOption(s.id,o.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={()=> addOption(s.id)} className="w-full"><Plus className="h-3 w-3 mr-1" /> Ajouter une option</Button>
              </div>
            </div>
          ))}
          {subs.length===0 && <p className="text-sm text-muted-foreground">Aucune sous-question.</p>}
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
