'use client';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { PlusCircle, Search, X, ArrowLeft, Loader2, Edit, Trash, FileText, ListPlus } from 'lucide-react';
import { QuestionForm } from '@/components/admin/QuestionForm';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface Lecture { id: string; title: string; description?: string | null; }
interface Question { id: string; text: string; type: string; options?: any[]; correctAnswers?: string[]; explanation?: string | null; caseNumber?: number | null; caseQuestionNumber?: number | null; caseText?: string | null; }
export default function CourseManagementPage() {
  const params = useParams<{ specialtyId: string; lectureId: string }>();
  const specialtyId = params?.specialtyId as string;
  const lectureId = params?.lectureId as string;
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filtered, setFiltered] = useState<Question[]>([]);
  const [search, setSearch] = useState('');
  const [loadingLecture, setLoadingLecture] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [openCreator, setOpenCreator] = useState(false); // panel visibility
  const [creationMode, setCreationMode] = useState<'single' | 'clinical_case' | 'grouped_qroc'>('single');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGroupCaseNumber, setEditingGroupCaseNumber] = useState<number | null>(null);
  const [editingGroupType, setEditingGroupType] = useState<'clinical_case' | 'grouped_qroc' | null>(null);
  const [originalGroupQuestionIds, setOriginalGroupQuestionIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<null | { key:string; label:string; questions: Question[] }>(null);
  const [caseQuestions, setCaseQuestions] = useState<Array<{ id: string; type: 'clinic_mcq' | 'clinic_croq'; text: string; options: string[]; correctAnswers: string[]; referenceAnswer?: string }>>([]);
  const [caseText, setCaseText] = useState('');
  const [caseSubmitting, setCaseSubmitting] = useState(false);

  const [groupQrocSubmitting, setGroupQrocSubmitting] = useState(false);
  const [groupQrocSubs, setGroupQrocSubs] = useState<Array<{ id:string; text:string; answer:string }>>([]);

  const resetGroupedQroc = () => { setGroupQrocSubs([]); setGroupQrocSubmitting(false); };
  const addGroupedQroc = () => { setGroupQrocSubs(prev => [...prev, { id: crypto.randomUUID(), text:'', answer:'' }]); };
  const updateGroupedQroc = (id:string, patch: Partial<{ text:string; answer:string }>) => setGroupQrocSubs(prev => prev.map(s => s.id===id? { ...s, ...patch }: s));
  const removeGroupedQroc = (id:string) => setGroupQrocSubs(prev => prev.filter(s=>s.id!==id));

  const resetCaseBuilder = () => {
    setCaseQuestions([]); setCaseText(''); setCaseSubmitting(false);
  };
  const addCaseQuestion = (type: 'clinic_mcq' | 'clinic_croq') => {
    setCaseQuestions(prev => [...prev, { id: crypto.randomUUID(), type, text: '', options: [], correctAnswers: [], referenceAnswer: '' }]);
  };
  const updateCaseQuestion = (id: string, patch: Partial<{ text: string; options: string[]; correctAnswers: string[]; type: 'clinic_mcq' | 'clinic_croq'; referenceAnswer: string }>) => {
    setCaseQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  };
  const removeCaseQuestion = (id: string) => setCaseQuestions(prev => prev.filter(q => q.id !== id));

  const submitClinicalCase = async () => {
    if (caseSubmitting) return; if (!caseText.trim() || caseQuestions.length === 0) { toast({ title:'Validation', description:'Ajoutez le texte et au moins une question', variant:'destructive' }); return; }
    // Basic validation
    for (const q of caseQuestions) {
      if (!q.text.trim()) { toast({ title:'Validation', description:'Chaque sous-question doit avoir un texte', variant:'destructive'}); return; }
      if (q.type==='clinic_mcq') {
        if (q.options.length < 2 || q.correctAnswers.length === 0) { toast({ title:'Validation', description:'QCM clinique nécessite options et réponses', variant:'destructive'}); return; }
      }
      if (q.type==='clinic_croq' && !q.referenceAnswer?.trim()) { toast({ title:'Validation', description:'Chaque QROC clinique nécessite une réponse attendue', variant:'destructive'}); return; }
    }
    setCaseSubmitting(true);
    try {
      let targetCaseNumber = editingGroupCaseNumber;
      if (!targetCaseNumber) {
        const existingCaseNumbers = questions.filter(q => (q.type==='clinic_mcq' || q.type==='clinic_croq') && (q as any).caseNumber).map(q => (q as any).caseNumber as number).filter(Boolean);
        targetCaseNumber = (existingCaseNumbers.length? Math.max(...existingCaseNumbers):0) + 1;
      }
      let order = 1;
      const currentIds = caseQuestions.map(q=>q.id);
      if (editingGroupCaseNumber && editingGroupType==='clinical_case') {
        // Determine deletions
        const toDelete = originalGroupQuestionIds.filter(id => !caseQuestions.some(q=>q.id===id));
        for (const id of toDelete) {
          await fetch(`/api/questions/${id}`, { method:'DELETE', credentials:'include' });
        }
      }
      for (const q of caseQuestions) {
        const body:any = { type: q.type, text: q.text.trim(), caseNumber: targetCaseNumber, caseText: caseText.trim(), caseQuestionNumber: order };
        if (q.type==='clinic_mcq') { body.options = q.options.map(o=>o.trim()).filter(Boolean); body.correctAnswers = q.correctAnswers; }
        if (q.type==='clinic_croq' && q.referenceAnswer?.trim()) { body.correctAnswers = [q.referenceAnswer.trim()]; }
        if (editingGroupCaseNumber && originalGroupQuestionIds.includes(q.id)) {
          // update
          await fetch(`/api/questions/${q.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(body) });
        } else {
          // create new
          await fetch('/api/questions', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ ...body, lectureId }) });
        }
        order++;
      }
      toast({ title: editingGroupCaseNumber? 'Cas clinique mis à jour' : 'Cas clinique créé', description:`${caseQuestions.length} sous-question(s)` });
      resetCaseBuilder();
      setEditingGroupCaseNumber(null); setEditingGroupType(null); setOriginalGroupQuestionIds([]);
      loadQuestions();
    } catch(e){
      console.error(e); toast({ title:'Erreur', description:'Création du cas clinique impossible', variant:'destructive'});
      setCaseSubmitting(false);
    }
  };

  const submitGroupedQroc = async () => {
    if (groupQrocSubmitting) return;
    if (groupQrocSubs.length === 0) { toast({ title:'Validation', description:'Ajoutez au moins une sous-question', variant:'destructive'}); return; }
    for (const s of groupQrocSubs) { if (!s.text.trim() || !s.answer.trim()) { toast({ title:'Validation', description:'Chaque sous-question nécessite énoncé et réponse', variant:'destructive'}); return; } }
    setGroupQrocSubmitting(true);
    try {
      let targetCaseNumber = editingGroupCaseNumber;
      if (!targetCaseNumber) {
        const existingGroupNumbers = questions.filter(q => q.type==='qroc' && (q as any).caseNumber).map(q => (q as any).caseNumber as number).filter(Boolean);
        targetCaseNumber = (existingGroupNumbers.length? Math.max(...existingGroupNumbers):0) + 1;
      }
      let order = 1;
      if (editingGroupCaseNumber && editingGroupType==='grouped_qroc') {
        const toDelete = originalGroupQuestionIds.filter(id => !groupQrocSubs.some(s=>s.id===id));
        for (const id of toDelete) { await fetch(`/api/questions/${id}`, { method:'DELETE', credentials:'include' }); }
      }
      for (const s of groupQrocSubs) {
        const body:any = { type:'qroc', text: s.text.trim(), caseNumber: targetCaseNumber, caseQuestionNumber: order, correctAnswers:[s.answer.trim()] };
        if (editingGroupCaseNumber && originalGroupQuestionIds.includes(s.id)) {
          await fetch(`/api/questions/${s.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(body) });
        } else {
          await fetch('/api/questions', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ ...body, lectureId }) });
        }
        order++;
      }
      toast({ title: editingGroupCaseNumber? 'Groupe QROC mis à jour' : 'Groupe QROC créé', description:`${groupQrocSubs.length} sous-question(s)` });
      resetGroupedQroc();
      setEditingGroupCaseNumber(null); setEditingGroupType(null); setOriginalGroupQuestionIds([]);
      loadQuestions();
    } catch(e){ console.error(e); toast({ title:'Erreur', description:'Création groupe QROC impossible', variant:'destructive'}); setGroupQrocSubmitting(false); }
  };

  const loadLecture = useCallback(async () => {
    try {
      setLoadingLecture(true);
      const res = await fetch(`/api/lectures/${lectureId}`);
      if (!res.ok) throw new Error('Failed lecture fetch');
      const data = await res.json();
      setLecture(data);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: "Impossible de charger le cours", variant: 'destructive' });
    } finally { setLoadingLecture(false); }
  }, [lectureId]);

  const loadQuestions = useCallback(async () => {
    try {
      setLoadingQuestions(true);
      const res = await fetch(`/api/questions?lectureId=${lectureId}&` + Date.now());
      if (!res.ok) throw new Error('Failed questions fetch');
      const data = await res.json();
      setQuestions(data);
      setFiltered(data);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: 'Impossible de charger les questions', variant: 'destructive' });
    } finally { setLoadingQuestions(false); }
  }, [lectureId]);

  useEffect(() => { loadLecture(); loadQuestions(); }, [loadLecture, loadQuestions]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(questions); return; }
    const q = search.toLowerCase();
    setFiltered(questions.filter(qn => qn.text?.toLowerCase().includes(q) || qn.explanation?.toLowerCase().includes(q)));
  }, [search, questions]);

  const beginCreate = () => { setEditingId(null); setOpenCreator(true); setCreationMode('single'); };
  const beginEdit = (id: string) => { setEditingId(id); setOpenCreator(true); setCreationMode('single'); setEditingGroupCaseNumber(null); setEditingGroupType(null); };
  const beginEditGroup = (group: { type:'clinical_case'|'grouped_qroc'; caseNumber:number; caseText?:string; questions: Question[] }) => {
    setEditingId(null);
    setOpenCreator(true);
    setEditingGroupCaseNumber(group.caseNumber);
    setEditingGroupType(group.type);
    if (group.type==='clinical_case') {
      setCreationMode('clinical_case');
      setCaseText(group.caseText || '');
      const mapped = group.questions.sort((a,b)=> (a.caseQuestionNumber||0)-(b.caseQuestionNumber||0)).map(q=>({ id:q.id, type: q.type as any, text:q.text, options: (q.type==='clinic_mcq'? (q.options||[]):[]), correctAnswers: q.correctAnswers||[], referenceAnswer: (q.type==='clinic_croq'?(q.correctAnswers?.[0]||''):'') }));
      setCaseQuestions(mapped as any);
      setOriginalGroupQuestionIds(group.questions.map(q=>q.id));
    } else {
      setCreationMode('grouped_qroc');
      const mapped = group.questions.sort((a,b)=> (a.caseQuestionNumber||0)-(b.caseQuestionNumber||0)).map(q=>({ id:q.id, text:q.text, answer: q.correctAnswers?.[0]||'' }));
      setGroupQrocSubs(mapped);
      setOriginalGroupQuestionIds(group.questions.map(q=>q.id));
    }
  };
  const cancelForm = () => { setEditingId(null); setOpenCreator(false); };
  const refreshAfterMutation = () => { cancelForm(); loadQuestions(); };

  const deleteQuestion = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      toast({ title: 'Supprimé', description: 'Question supprimée avec succès' });
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch (e) {
      console.error(e);
      toast({ title: 'Erreur', description: 'Suppression impossible', variant: 'destructive' });
    } finally { setDeletingId(null); }
  };

  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          <div className="space-y-8">
            <div className="flex items-center gap-4 flex-wrap">
              <Link href={`/admin/management/${specialtyId}`} className="inline-flex">
                <Button variant="outline" className="gap-2 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-300"><ArrowLeft className="h-4 w-4" /> Retour</Button>
              </Link>
              <div className="min-w-[240px]">
                <h1 className="text-3xl font-bold flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  Gestion des questions {loadingLecture && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                </h1>
                {loadingLecture ? (
                  <div className="mt-3 space-y-2">
                    <Skeleton className="h-5 w-64" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                ) : lecture && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium text-blue-700 dark:text-blue-300">Cours:</span>
                    <span className="truncate max-w-[280px] text-blue-900 dark:text-blue-100 font-medium" title={lecture.title}>{lecture.title}</span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">{questions.length} questions</Badge>
                  </div>
                )}
              </div>
              <div className="ml-auto flex gap-3 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                  <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher une question..." className="pl-10 pr-8 w-72 border-blue-200 focus:border-blue-400 focus:ring-blue-400/20" />
                  {search && <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-950/30" onClick={()=>setSearch('')}><X className="h-3 w-3" /></Button>}
                </div>
                <Button onClick={()=>{ setOpenCreator(true); setEditingId(null); setCreationMode('single'); resetCaseBuilder(); resetGroupedQroc(); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 px-6"><PlusCircle className="h-4 w-4 mr-2" />Nouvelle question</Button>
              </div>
            </div>

            <Separator />

            {openCreator && (
              <div className="border border-blue-200 rounded-xl p-6 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background shadow-lg space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    {!editingId && (
                      <>
                        <Button size="sm" variant={creationMode==='single'? 'default':'outline'} onClick={()=>{ setCreationMode('single'); resetCaseBuilder(); resetGroupedQroc(); }} className={creationMode==='single'? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'}>Question simple</Button>
                        <Button size="sm" variant={creationMode==='clinical_case'? 'default':'outline'} onClick={()=>{ setCreationMode('clinical_case'); resetGroupedQroc(); resetCaseBuilder(); }} className={`h-8 flex items-center gap-2 ${creationMode==='clinical_case'? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}><FileText className="h-4 w-4" /> Cas clinique</Button>
                        <Button size="sm" variant={creationMode==='grouped_qroc'? 'default':'outline'} onClick={()=>{ setCreationMode('grouped_qroc'); resetCaseBuilder(); resetGroupedQroc(); addGroupedQroc(); }} className={`h-8 flex items-center gap-2 ${creationMode==='grouped_qroc'? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}><ListPlus className="h-4 w-4" /> Groupe QROC</Button>
                      </>
                    )}
                    {editingId && <span className="text-lg font-semibold text-blue-900 dark:text-blue-100">Modifier la question</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={()=>{ setOpenCreator(false); setEditingId(null); resetCaseBuilder(); resetGroupedQroc(); }} className="text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/30"> <X className="h-4 w-4" /> </Button>
                  </div>
                </div>

                {creationMode==='single' && !editingId && (
                  <QuestionForm lectureId={lectureId} onComplete={()=>{ setOpenCreator(false); loadQuestions(); }} />
                )}
                {editingId && (
                  <QuestionForm lectureId={lectureId} editQuestionId={editingId} onComplete={()=>{ setEditingId(null); setOpenCreator(false); loadQuestions(); }} />
                )}
                {creationMode==='clinical_case' && !editingId && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-lg font-semibold flex items-center gap-3 text-blue-900 dark:text-blue-100"><FileText className="h-5 w-5 text-blue-600" /> {editingGroupCaseNumber? `Modifier cas clinique #${editingGroupCaseNumber}`:'Nouveau cas clinique'}</h2>
                      <Button size="sm" variant="outline" onClick={()=>addCaseQuestion('clinic_mcq')} className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">+ QCM clinique</Button>
                      <Button size="sm" variant="outline" onClick={()=>addCaseQuestion('clinic_croq')} className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">+ QROC clinique</Button>
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Présentation du cas clinique *</label>
                      <textarea value={caseText} onChange={e=>setCaseText(e.target.value)} rows={5} className="w-full rounded-md border border-blue-200 bg-background px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/20 focus-visible:border-blue-400" placeholder="Décrivez la situation clinique : anamnèse, examen physique, examens complémentaires..." />
                    </div>
                    <div className="space-y-4">
                      {caseQuestions.length === 0 && <p className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200">Ajoutez des sous-questions (QCM ou QROC) pour compléter votre cas clinique.</p>}
                      {caseQuestions.map((q,i)=>(
                        <div key={q.id} className="border border-blue-200 rounded-xl p-5 bg-white/60 dark:bg-muted/40 backdrop-blur-sm space-y-3 transition-colors shadow-sm">
                          <div className="flex items-center gap-3 text-sm uppercase tracking-wide font-semibold text-blue-700 dark:text-blue-300">
                            <span className="px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Question #{i+1}</span>
                            <span>{q.type === 'clinic_mcq' ? 'QCM Clinique' : 'QROC Clinique'}</span>
                            <Button size="sm" variant="ghost" className="ml-auto h-8 px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={()=>removeCaseQuestion(q.id)}><Trash className="h-4 w-4" /></Button>
                          </div>
                          <textarea value={q.text} onChange={e=>updateCaseQuestion(q.id,{ text:e.target.value })} rows={3} className="w-full rounded-md border border-blue-200 bg-background dark:bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/20 focus-visible:border-blue-400" placeholder={q.type==='clinic_mcq'? 'Énoncé de la question QCM clinique' : 'Énoncé de la question QROC clinique'} />
                          {q.type==='clinic_croq' && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Réponse de référence</label>
                              <input value={q.referenceAnswer} onChange={e=>updateCaseQuestion(q.id,{ referenceAnswer: e.target.value })} className="w-full rounded-md border border-blue-200 bg-background dark:bg-muted/30 px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/20 focus-visible:border-blue-400" placeholder="Réponse attendue pour cette question" />
                            </div>
                          )}
                          {q.type==='clinic_mcq' && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Options de réponse</span>
                                <Button size="sm" variant="outline" className="h-8 px-3 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30" onClick={()=>updateCaseQuestion(q.id,{ options:[...q.options,''] })}>+ Ajouter option</Button>
                              </div>
                              <div className="space-y-2">
                                {q.options.map((opt,idx)=>(
                                  <div key={idx} className="flex items-center gap-3">
                                    <input value={opt} onChange={e=>{ const copy=[...q.options]; copy[idx]=e.target.value; updateCaseQuestion(q.id,{ options:copy }); }} className="flex-1 rounded-md border border-blue-200 bg-background dark:bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/20 focus-visible:border-blue-400" placeholder={`Option ${String.fromCharCode(65+idx)}`} />
                                    <Button size="sm" variant={q.correctAnswers.includes(String.fromCharCode(65+idx))? 'default':'outline'} className={`h-10 px-4 ${q.correctAnswers.includes(String.fromCharCode(65+idx))? 'bg-green-600 hover:bg-green-700 text-white' : 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'}`} type="button" onClick={()=>{ const key=String.fromCharCode(65+idx); updateCaseQuestion(q.id,{ correctAnswers: q.correctAnswers.includes(key)? q.correctAnswers.filter(a=>a!==key): [...q.correctAnswers,key] }); }}>{String.fromCharCode(65+idx)}</Button>
                                    <Button size="sm" variant="ghost" className="h-10 px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={()=>{ const opts=[...q.options]; opts.splice(idx,1); const newCorrect = q.correctAnswers.filter(a=>a!==String.fromCharCode(65+idx)); updateCaseQuestion(q.id,{ options:opts, correctAnswers:newCorrect }); }}>✕</Button>
                                  </div>
                                ))}
                              </div>
                              <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">Cliquez sur une lettre pour marquer la réponse comme correcte (plusieurs réponses possibles).</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-blue-100">
                      <Button variant="outline" size="sm" onClick={()=>{ resetCaseBuilder(); setOpenCreator(false); }} className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">Annuler</Button>
                      <Button size="sm" disabled={caseSubmitting} onClick={submitClinicalCase} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white shadow-md px-6">{caseSubmitting? (editingGroupCaseNumber? 'Mise à jour...' : 'Création...') : (editingGroupCaseNumber? 'Mettre à jour le cas' : 'Créer le cas clinique')}</Button>
                    </div>
                  </div>
                )}
        {creationMode==='grouped_qroc' && !editingId && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-lg font-semibold flex items-center gap-3 text-blue-900 dark:text-blue-100"><ListPlus className="h-5 w-5 text-amber-600" /> {editingGroupCaseNumber? `Modifier groupe QROC #${editingGroupCaseNumber}`:'Nouveau groupe QROC'}</h2>
                      <Button size="sm" variant="outline" onClick={addGroupedQroc} className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">+ Ajouter sous-question</Button>
                    </div>
                    {groupQrocSubs.length === 0 && <p className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200">Ajoutez des sous-questions QROC pour créer un groupe thématique.</p>}
                    <div className="space-y-4">
                      {groupQrocSubs.map((s,i)=>(
                        <div key={s.id} className="border border-blue-200 rounded-xl p-5 bg-white/60 dark:bg-muted/40 backdrop-blur-sm space-y-3 transition-colors shadow-sm">
                          <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                            <span className="px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Question #{i+1}</span>
                            <span>QROC</span>
                            <Button size="sm" variant="ghost" className="ml-auto h-8 px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={()=>removeGroupedQroc(s.id)}><Trash className="h-4 w-4" /></Button>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 block">Énoncé de la question</label>
                              <textarea value={s.text} onChange={e=>updateGroupedQroc(s.id,{ text:e.target.value })} rows={3} className="w-full rounded-md border border-blue-200 bg-background dark:bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/20 focus-visible:border-blue-400" placeholder="Énoncé de la sous-question QROC" />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 block">Réponse attendue</label>
                              <textarea value={s.answer} onChange={e=>updateGroupedQroc(s.id,{ answer:e.target.value })} rows={2} className="w-full rounded-md border border-blue-200 bg-background dark:bg-muted/30 px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/20 focus-visible:border-blue-400" placeholder="Réponse de référence" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-blue-100">
                      <Button variant="outline" size="sm" onClick={()=>{ resetGroupedQroc(); setOpenCreator(false); }} className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">Annuler</Button>
                      <Button size="sm" disabled={groupQrocSubmitting} onClick={submitGroupedQroc} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white shadow-md px-6">{groupQrocSubmitting? (editingGroupCaseNumber? 'Mise à jour...' : 'Création...') : (editingGroupCaseNumber? 'Mettre à jour le groupe' : 'Créer le groupe QROC')}</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Card className="shadow-lg border-blue-100 relative overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-blue-900 dark:text-blue-100">Questions d'évaluation ({filtered.length})</CardTitle>
                    <CardDescription>Gérez les questions individuelles et les groupes de questions pour ce cours.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingQuestions ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_,i)=>(
                      <div key={i} className="border border-blue-100 rounded-xl p-4 space-y-3">
                        <div className="flex gap-4">
                          <Skeleton className="h-5 w-12" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                          </div>
                          <Skeleton className="h-8 w-20" />
                        </div>
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <PlusCircle className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Aucune question créée</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mb-6">Commencez par créer votre première question d'évaluation pour ce cours.</p>
                    <Button onClick={()=>{ setOpenCreator(true); setEditingId(null); setCreationMode('single'); resetCaseBuilder(); resetGroupedQroc(); }} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Créer une question
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      // Build grouped display list
                      const clinicGroups = new Map<number, Question[]>();
                      const qrocGroups = new Map<number, Question[]>();
                      for (const q of filtered) {
                        if (q.caseNumber) {
                          if ((q.type==='clinic_mcq' || q.type==='clinic_croq') || (q as any).caseText) {
                            const arr = clinicGroups.get(q.caseNumber) || []; arr.push(q); clinicGroups.set(q.caseNumber, arr);
                          } else if (q.type==='qroc') {
                            const arr = qrocGroups.get(q.caseNumber) || []; arr.push(q); qrocGroups.set(q.caseNumber, arr);
                          }
                        }
                      }
                      const groupedKeys = new Set<string>();
                      const items: Array<{kind:'clinical'; group:{caseNumber:number; caseText?:string; questions:Question[]}} | {kind:'grouped_qroc'; group:{caseNumber:number; questions:Question[]}} | {kind:'single'; question:Question}> = [];
                      // Clinical groups
                      clinicGroups.forEach((qs, num)=>{
                        items.push({ kind:'clinical', group:{ caseNumber:num, caseText: (qs[0] as any).caseText, questions: qs.sort((a,b)=> (a.caseQuestionNumber||0)-(b.caseQuestionNumber||0)) }});
                        groupedKeys.add('clinic-'+num);
                      });
                      // QROC groups (only if more than 1)
                      qrocGroups.forEach((qs, num)=>{
                        if (qs.length>1) { items.push({ kind:'grouped_qroc', group:{ caseNumber:num, questions: qs.sort((a,b)=> (a.caseQuestionNumber||0)-(b.caseQuestionNumber||0)) }}); groupedKeys.add('gqroc-'+num); }
                      });
                      // Singles
                      for (const q of filtered) {
                        if (q.caseNumber) {
                          if ((q.type==='clinic_mcq'||q.type==='clinic_croq') && clinicGroups.get(q.caseNumber)) continue;
                          if (q.type==='qroc' && qrocGroups.get(q.caseNumber) && (qrocGroups.get(q.caseNumber) as any).length>1) continue;
                        }
                        items.push({ kind:'single', question:q });
                      }
                      // Sort items by derived order
                      items.sort((a,b)=>{
                        const getFirstCase = (it:any)=> it.kind==='single'? 999999 + (questions.indexOf(it.question)) : it.group.caseNumber;
                        return getFirstCase(a)-getFirstCase(b);
                      });
                      return items.map((it, idx)=>{
                        if (it.kind==='single') {
                          const q = it.question;
                          return (
                            <div key={q.id} className="group border border-blue-100 rounded-xl p-5 flex flex-col gap-3 hover:border-blue-300 transition-all duration-200 bg-gradient-to-br from-white to-blue-50/20 dark:from-background dark:to-blue-950/10 shadow-sm hover:shadow-md hover:shadow-blue-500/25">
                              <div className="flex items-start gap-4">
                                <div className="text-sm font-mono text-blue-600 w-12 bg-blue-50 dark:bg-blue-950/30 rounded-lg py-1 text-center font-semibold">#{idx+1}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-base font-medium leading-relaxed line-clamp-3 text-blue-900 dark:text-blue-100 mb-2" title={q.text}>{q.text}</p>
                                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                                    <Badge variant="outline" className="px-2 py-1 border-blue-300/50 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">{q.type.toUpperCase()}</Badge>
                                    {q.options && <Badge variant="secondary" className="px-2 py-1 bg-blue-100 text-blue-700">{q.options.length} options</Badge>}
                                    {q.correctAnswers && q.correctAnswers.length>0 && <Badge variant="secondary" className="px-2 py-1 bg-emerald-100 text-emerald-700">{q.correctAnswers.length} correct</Badge>}
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                  <Button size="sm" variant="outline" onClick={()=>beginEdit(q.id)} className="h-9 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"><Edit className="h-4 w-4" /></Button>
                                  <Button size="sm" variant="outline" disabled={deletingId===q.id} onClick={()=>deleteQuestion(q.id)} className="h-9 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30">{deletingId===q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}</Button>
                                </div>
                              </div>
                              {q.explanation && <div className="pl-16"><p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed" title={q.explanation}><span className="font-medium text-blue-700 dark:text-blue-300">Explication:</span> {q.explanation}</p></div>}
                            </div>
                          );
                        }
                        const g = it.group;
                        const isClinic = it.kind==='clinical';
                        const title = isClinic? `Cas clinique #${g.caseNumber}` : `Groupe QROC #${g.caseNumber}`;
                        const bgColor = isClinic ? 'from-violet-50/50 to-white dark:from-violet-950/10 dark:to-background' : 'from-amber-50/50 to-white dark:from-amber-950/10 dark:to-background';
                        const borderColor = isClinic ? 'border-violet-300 dark:border-violet-600' : 'border-amber-300 dark:border-amber-600';
                        const iconColor = isClinic ? 'text-violet-600' : 'text-amber-600';
                        const badgeColor = isClinic ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-amber-100 text-amber-700 border-amber-200';
                        
                        return (
                          <div key={(isClinic?'clinic':'gqroc')+g.caseNumber} className={`group border-2 ${borderColor} rounded-xl p-6 flex flex-col gap-4 hover:border-blue-300 transition-all duration-200 bg-gradient-to-br ${bgColor} shadow-sm hover:shadow-md hover:shadow-blue-500/25`}>
                            <div className="flex items-start gap-4">
                              <div className="text-sm font-mono text-blue-600 w-12 bg-blue-50 dark:bg-blue-950/30 rounded-lg py-1 text-center font-semibold">#{idx+1}</div>
                              <div className="flex-1 min-w-0 space-y-3">
                                <div className="flex items-center gap-3">
                                  {isClinic ? <FileText className={`h-5 w-5 ${iconColor}`} /> : <ListPlus className={`h-5 w-5 ${iconColor}`} />}
                                  <p className="text-lg font-semibold leading-relaxed text-blue-900 dark:text-blue-100" title={title}>{title}</p>
                                </div>
                                {isClinic && (g as any).caseText && <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed bg-white/50 dark:bg-muted/20 p-3 rounded-lg border border-blue-100" title={(g as any).caseText}>{(g as any).caseText}</p>}
                                <div className="flex flex-wrap gap-2 text-xs font-medium">
                                  <Badge variant="outline" className={`px-2 py-1 ${badgeColor}`}>{isClinic? 'CAS CLINIQUE' : 'GROUPE QROC'}</Badge>
                                  <Badge variant="secondary" className="px-2 py-1 bg-blue-100 text-blue-700">{g.questions.length} sous-questions</Badge>
                                </div>
                                <div className="pl-3 space-y-2 border-l-2 border-blue-200">
                                  {g.questions.slice(0,3).map((sq,i)=>(<p key={sq.id} className="text-sm text-muted-foreground truncate leading-relaxed"><span className="font-medium text-blue-700 dark:text-blue-300 mr-2">{i+1}.</span>{sq.text}</p>))}
                                  {g.questions.length>3 && <p className="text-xs text-muted-foreground italic">+ {g.questions.length-3} autre(s) question(s)</p>}
                                </div>
                              </div>
                              <div className="flex gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <Button size="sm" variant="outline" onClick={()=>beginEditGroup({ type: isClinic?'clinical_case':'grouped_qroc', caseNumber:g.caseNumber, caseText:(g as any).caseText, questions:g.questions })} className="h-9 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"><Edit className="h-4 w-4" /></Button>
                                {/* Delete whole group via custom dialog */}
                                <Button size="sm" variant="outline" disabled={deletingId===('group-'+g.caseNumber)} onClick={()=>{ if (deletingId) return; setGroupToDelete({ key:'group-'+g.caseNumber, label: title, questions: g.questions }); }} className="h-9 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30">{deletingId===('group-'+g.caseNumber)? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}</Button>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
            <ConfirmationDialog
              isOpen={!!groupToDelete}
              onOpenChange={(open)=> { if (!open) setGroupToDelete(null); }}
              title={groupToDelete?.label || ''}
              description={`Cette action va supprimer ${groupToDelete?.questions.length || 0} sous-question(s). Action irréversible.`}
              confirmText="Supprimer"
              onConfirm={async()=>{
                if (!groupToDelete) return; const key = groupToDelete.key; setDeletingId(key); try { for (const q of groupToDelete.questions) { await fetch(`/api/questions/${q.id}`, { method:'DELETE' }); } toast({ title:'Supprimé', description:'Groupe supprimé'}); setGroupToDelete(null); loadQuestions(); } catch(e){ console.error(e); toast({ title:'Erreur', description:'Suppression impossible', variant:'destructive'}); } finally { setDeletingId(null); }
              }}
            />
          </div>
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}
