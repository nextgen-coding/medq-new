"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextInput, ImageData } from '@/components/ui/rich-text-input';
import { Question, Option } from '@/types';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';
// QuickParseQroc removed from individual sub-questions; we now use only global parser

interface ClinicalCaseEditDialogProps {
  caseNumber: number;
  questions: Question[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (updated: Question[]) => void;
}

type EditableSub = { 
  id: string; 
  type: 'clinic_mcq' | 'clinic_croq'; 
  text: string; 
  explanation: string; 
  answer: string; 
  options: Option[]; 
  correctAnswers: string[];
  images?: ImageData[];
  explanationImages?: ImageData[];
  answerImages?: ImageData[];
};

export function ClinicalCaseEditDialog({ caseNumber, questions, isOpen, onOpenChange, onSaved }: ClinicalCaseEditDialogProps) {
  const [caseText, setCaseText] = useState('');
  const [caseImages, setCaseImages] = useState<ImageData[]>([]);
  const [subs, setSubs] = useState<EditableSub[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    if (isOpen) {
      setCaseText(questions[0]?.caseText || '');
      setCaseImages([]); // Initialize empty - images will be parsed from text
      const mapped = questions.slice().sort((a,b)=>(a.caseQuestionNumber||0)-(b.caseQuestionNumber||0)).map(q=>({
        id: q.id,
        type: (q.type === 'clinic_mcq' || q.type === 'clinic_croq') ? q.type : 'clinic_mcq',
        text: q.text || '',
        explanation: q.explanation || '',
        answer: q.type === 'clinic_croq' ? (q.correctAnswers || q.correct_answers || [])[0] || '' : '',
        options: q.options?.map(o=> ({ id: o.id, text: o.text, explanation: o.explanation || '' })) || [
          { id: `opt_${Math.random().toString(36).slice(2)}`, text: '', explanation: '' },
          { id: `opt_${Math.random().toString(36).slice(2)}`, text: '', explanation: '' },
        ],
        correctAnswers: (q.correctAnswers || q.correct_answers || []),
        images: [], // Initialize empty - images will be parsed from text
        explanationImages: [], // Initialize empty - images will be parsed from explanation
        answerImages: [], // Initialize empty - images will be parsed from answer
      }));
      setSubs(mapped);
    }
  }, [isOpen, questions]);

  const updateSub = (id: string, patch: Partial<EditableSub>) => { 
    setSubs(prev => prev.map(s=> s.id===id ? { ...s, ...patch } : s)); 
  };
  const updateOption = (sid: string, oid: string, patch: Partial<Option>) => { setSubs(prev => prev.map(s=> s.id===sid ? { ...s, options: s.options.map(o=> o.id===oid? { ...o, ...patch } : o) } : s)); };
  const addOption = (sid: string) => { setSubs(prev => prev.map(s=> s.id===sid ? { ...s, options: [...s.options, { id: `opt_${Math.random().toString(36).slice(2)}`, text: '', explanation: '' }] } : s)); };
  const removeOption = (sid: string, oid: string) => { setSubs(prev => prev.map(s=> s.id===sid ? { ...s, options: s.options.filter(o=> o.id!==oid), correctAnswers: s.correctAnswers.filter(c=> c!==oid) } : s)); };
  const toggleCorrect = (sid: string, oid: string) => { setSubs(prev => prev.map(s=> s.id===sid ? { ...s, correctAnswers: s.correctAnswers.includes(oid) ? s.correctAnswers.filter(c=> c!==oid) : [...s.correctAnswers, oid] } : s)); };

  const handleSave = async () => {
    if (!caseText.trim()) { toast({ title: 'Texte du cas manquant', description: 'Veuillez renseigner le texte du cas.', variant: 'destructive' }); return; }
    for (const s of subs) {
      if (!s.text.trim()) { toast({ title: 'Texte manquant', description: 'Chaque sous-question doit avoir un énoncé.', variant: 'destructive' }); return; }
      if (s.type === 'clinic_mcq') {
        const valid = s.options.filter(o=> o.text.trim());
        if (valid.length < 2) { toast({ title: 'Options insuffisantes', description: 'Chaque QCM doit avoir au moins 2 options valides.', variant: 'destructive' }); return; }
        if (s.correctAnswers.length === 0) { toast({ title: 'Bonne réponse', description: 'Sélectionnez au moins une bonne réponse par QCM.', variant: 'destructive' }); return; }
      }
      if (s.type === 'clinic_croq' && !s.answer.trim()) { toast({ title: 'Réponse manquante', description: 'Chaque QROC doit avoir une réponse.', variant: 'destructive' }); return; }
    }
    try {
      setSaving(true);
      const updated: Question[] = [] as any;

      // Helper to convert new format placeholders [IMAGE:id] to legacy format [IMAGE:url|description]
      const convertNewToLegacy = (text: string, images: ImageData[] | undefined) => {
        if (!text) return text;
        if (!/\[IMAGE:[^|\]]+\]/.test(text)) return text; // no new-format images
        if (!images || images.length === 0) return text; // cannot map ids -> leave (will show placeholders)
        return text.replace(/\[IMAGE:([^|\]]+)\]/g, (full, id) => {
          const img = images.find(i => i.id === id);
            if (!img) return full; // keep placeholder if not found
            // sanitize description (remove closing bracket or pipe)
            const safeDesc = (img.description || 'Image').replace(/\]|\|/g, ' ');
            return `[IMAGE:${img.url}|${safeDesc}]`;
        });
      };

      const legacyCaseText = convertNewToLegacy(caseText.trim(), caseImages);
      for (let order = 0; order < subs.length; order++) {
        const s = subs[order];
        const processedText = convertNewToLegacy(s.text.trim(), s.images);
        const processedExplanation = s.explanation.trim() ? convertNewToLegacy(s.explanation.trim(), s.explanationImages) : null;
        const processedAnswer = s.type === 'clinic_croq' ? convertNewToLegacy(s.answer.trim(), s.answerImages) : '';
        const base: any = { text: processedText, explanation: processedExplanation, caseText: legacyCaseText, caseQuestionNumber: order + 1 };
        if (s.type === 'clinic_mcq') { base.type='clinic_mcq'; base.options = s.options.filter(o=> o.text.trim()).map(o=> ({ id:o.id, text:o.text.trim(), explanation:o.explanation?.trim()||'' })); base.correctAnswers = s.correctAnswers; }
        else { base.type='clinic_croq'; base.correctAnswers = [processedAnswer]; base.options = []; }
        const resp = await fetch(`/api/questions/${s.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(base) });
        if (!resp.ok) { const err = await resp.json().catch(()=>({})); throw new Error(err.error || `Échec sous-question ${order+1}`); }
        updated.push(await resp.json());
      }
      toast({ title: 'Cas clinique mis à jour', description: `${subs.length} sous-question(s) enregistrée(s).` });
      onSaved?.(updated); onOpenChange(false);
    } catch(e:any) { toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour échouée.', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={o=> !saving && onOpenChange(o)}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Éditer Cas Clinique #{caseNumber}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-4">
          <QuickParseClinicalCase
            caseText={caseText}
            subs={subs}
            setCaseText={setCaseText}
            updateSub={updateSub}
            updateOption={updateOption}
            toggleCorrect={toggleCorrect}
          />
          <div className="space-y-2">
            <Label>Texte du cas *</Label>
            <RichTextInput
              value={caseText}
              onChange={setCaseText}
              images={caseImages}
              onImagesChange={setCaseImages}
              placeholder="Décrivez le cas clinique..."
              rows={4}
            />
          </div>
          {subs.map((s, idx)=>(
            <div key={s.id} className="border rounded-md p-4 space-y-4 bg-muted/30">
              <div className="text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded w-fit">Sous-question {idx+1}</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={s.type} onValueChange={(v:any)=> updateSub(s.id,{ type:v, answer:'', correctAnswers:[], options: v==='clinic_mcq' ? (s.options.length? s.options : [ {id:`opt_${Math.random().toString(36).slice(2)}`, text:'', explanation:''}, {id:`opt_${Math.random().toString(36).slice(2)}`, text:'', explanation:''} ]) : [] })}>
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinic_mcq">CAS QCM</SelectItem>
                      <SelectItem value="clinic_croq">CAS QROC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3 space-y-2">
                  <Label>Énoncé *</Label>
                  <RichTextInput
                    value={s.text}
                    onChange={(newText) => updateSub(s.id, { text: newText })}
                    images={s.images || []}
                    onImagesChange={(newImages) => updateSub(s.id, { images: newImages })}
                    placeholder="Énoncé de la sous-question..."
                    rows={3}
                  />
                </div>
              </div>
              {s.type==='clinic_mcq' && (
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
              )}
              {s.type==='clinic_croq' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Réponse de référence *</Label>
                    <RichTextInput
                      value={s.answer}
                      onChange={(newAnswer) => updateSub(s.id, { answer: newAnswer })}
                      images={s.answerImages || []}
                      onImagesChange={(newImages) => updateSub(s.id, { answerImages: newImages })}
                      placeholder="Texte attendu (vous pouvez utiliser plusieurs lignes)"
                      rows={4}
                    />
                    <p className="text-[11px] text-muted-foreground">Les retours à la ligne seront conservés.</p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Explication (optionnel)</Label>
                <RichTextInput
                  value={s.explanation}
                  onChange={(newExplanation) => updateSub(s.id, { explanation: newExplanation })}
                  images={s.explanationImages || []}
                  onImagesChange={(newImages) => updateSub(s.id, { explanationImages: newImages })}
                  placeholder="Explication détaillée..."
                  rows={3}
                />
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pl-1">Ajout / suppression de sous-questions non encore supporté.</p>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={()=> onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">{saving? 'Enregistrement...' : 'Enregistrer'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ================= Quick Parse Clinical Case (global) =================
function QuickParseClinicalCase({
  caseText,
  subs,
  setCaseText,
  updateSub,
  updateOption,
  toggleCorrect
}: {
  caseText: string;
  subs: EditableSub[];
  setCaseText: (t:string)=>void;
  updateSub: (id:string, patch: Partial<EditableSub>)=>void;
  updateOption: (sid:string, oid:string, patch: Partial<Option>)=>void;
  toggleCorrect: (sid:string, oid:string)=>void;
}) {
  const [raw, setRaw] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(()=>{
    if (initialized) return; // only initial fill
    const lines: string[] = [];
    lines.push('Case:');
    lines.push(caseText || '');
    lines.push('');
    subs.forEach((s, idx)=> {
      lines.push(`Q${idx+1}: (${s.type === 'clinic_mcq' ? 'QCM' : 'QROC'})`);
      lines.push(`Énoncé: ${s.text || ''}`);
      if (s.type === 'clinic_mcq') {
        s.options.forEach((o,oIdx)=> {
          const correct = s.correctAnswers.includes(o.id) ? 'x' : ' ';
          lines.push(`[${correct}] ${String.fromCharCode(65+oIdx)}) ${o.text || ''}`);
          if (o.explanation && o.explanation.trim()) {
            o.explanation.split(/\r?\n/).forEach((el,i)=> {
              lines.push(i===0 ? `    Explication: ${el}` : `    ${el}`);
            });
          }
        });
      } else {
        lines.push(`Réponse: ${s.answer || ''}`);
      }
      lines.push('');
    });
    setRaw(lines.join('\n').trimEnd());
    setInitialized(true);
  }, [initialized, caseText, subs]);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(raw); toast({ title:'Copié', description:'Cas clinique copié.'}); } catch { toast({ title:'Erreur', description:'Copie impossible', variant:'destructive'});} }

  const parse = () => {
    if (!raw.trim()) { toast({ title:'Vide', description:'Rien à analyser.'}); return; }
    const lines = raw.replace(/\r/g,'').split('\n');
    // Extract case text between 'Case:' and first blank line before Q1
    let i=0; let newCaseText = caseText;
    if (/^Case:/i.test(lines[0])) {
      i=1; const caseLines: string[] = [];
      while(i<lines.length && lines[i].trim() !== '') { caseLines.push(lines[i]); i++; }
      newCaseText = caseLines.join('\n').trim();
      // skip blank lines
      while(i<lines.length && lines[i].trim()==='') i++;
    }
    const optPattern = /^\[(x|X| )\]\s*([A-Z])\)\s*(.*)$/;
    const explMarker = /^(Explication|Explanation|Justification|Pourquoi|Raison)\s*[:\-]\s*/i;
    const indented = /^\s{2,}(.*)$/;
    // For each existing sub, parse sequentially blocks starting with Qn:
    subs.forEach((s, idx)=> {
      const qHeader = new RegExp(`^Q${idx+1}:(?:\\s*\\((QCM|QROC)\\))?`, 'i');
      // find start index from current i
      while(i<lines.length && !qHeader.test(lines[i])) i++;
      if (i>=lines.length) return; // no more
      // Optionally capture type override (ignored: we don't allow changing types here)
      i++; // move past header
      // parse until next Q header or EOF
      const blockStart = i;
      let blockEnd = lines.length;
      for (let j=i; j<lines.length; j++){
        if (new RegExp(`^Q${idx+2}:`, 'i').test(lines[j])) { blockEnd = j; break; }
      }
      const block = lines.slice(blockStart, blockEnd);
      // Parse Énoncé line
      let bi=0; let statement = s.text;
      if (/^Énoncé:/i.test(block[bi]||'')) {
        statement = block[bi].replace(/^Énoncé:\s*/i,''); bi++;
      }
      if (s.type === 'clinic_mcq') {
        const desiredOpts: { text:string; correct:boolean; explanation?:string }[] = [];
        for (; bi<block.length; bi++) {
          const line = block[bi];
            if (!line.trim()) continue;
          if (/^Réponse:/i.test(line)) continue; // ignore stray
          const m = line.match(optPattern);
          if (m) {
            desiredOpts.push({ text: m[3].trim(), correct: m[1].toLowerCase()==='x' });
          } else if (desiredOpts.length) {
            // explanation continuation
            let explLine = line;
            const marker = explLine.match(explMarker);
            if (marker) explLine = explLine.replace(explMarker,'').trim();
            else {
              const ind = line.match(indented); if (ind) explLine = ind[1];
            }
            const last = desiredOpts[desiredOpts.length-1];
            last.explanation = last.explanation ? `${last.explanation}\n${explLine}` : explLine;
          }
        }
        // apply updates
        updateSub(s.id, { text: statement });
        // Map onto existing options count only
        s.options.forEach((o, oIdx)=> {
          if (oIdx < desiredOpts.length) {
            const d = desiredOpts[oIdx];
            if (d.text !== undefined) updateOption(s.id, o.id, { text: d.text });
            if (d.explanation !== undefined) updateOption(s.id, o.id, { explanation: d.explanation });
          }
        });
        // Correct answers sync
        const desiredCorrectIds = new Set<string>();
        s.options.forEach((o, oIdx)=> { if (oIdx < desiredOpts.length && desiredOpts[oIdx].correct) desiredCorrectIds.add(o.id); });
        s.options.forEach(o=> {
          const should = desiredCorrectIds.has(o.id);
          const is = s.correctAnswers.includes(o.id);
          if (should !== is) toggleCorrect(s.id, o.id);
        });
      } else { // clinic_croq
        // find line starting Réponse:
        let answer = s.answer;
        for (; bi<block.length; bi++) {
          const line = block[bi];
          if (/^Réponse:/i.test(line)) { answer = line.replace(/^Réponse:\s*/i,'').trim(); break; }
        }
        updateSub(s.id, { text: statement, answer });
      }
      i = blockEnd; // continue after block
    });
    setCaseText(newCaseText);
    toast({ title:'Analyse effectuée', description:'Cas & sous-questions mis à jour.' });
  };

  return (
    <div className="space-y-2 border rounded-md p-3 bg-muted/40">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Parse rapide (Cas complet)</h3>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>Copier</Button>
          <Button type="button" size="sm" onClick={parse}>Analyser</Button>
        </div>
      </div>
      <Textarea
        value={raw}
        onChange={e=> setRaw(e.target.value)}
        className="min-h-60 font-mono text-xs"
        placeholder={`Case:\nTexte du cas...\n\nQ1: (QCM)\nÉnoncé: ...\n[ ] A) Option A\n[x] B) Option B\n    Explication: justification B\n[ ] C) Option C\n\nQ2: (QROC)\nÉnoncé: ...\nRéponse: texte attendu`}
      />
      <p className="text-[10px] text-muted-foreground leading-snug">
        Format: commencer par "Case:" puis chaque sous-question "Qn: (QCM|QROC)". Options QCM: [x] A) texte (x = bonne). Lignes indentées ou précédées d'un marqueur deviennent l'explication. QROC: ajoutez "Réponse:". Le nombre de sous-questions et d'options ne peut pas être modifié ici.
      </p>
    </div>
  );
}
