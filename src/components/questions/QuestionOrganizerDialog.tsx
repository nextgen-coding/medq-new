'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Lecture, Question } from '@/types';
import { GripVertical, Save, Undo2, Package, MoveLeft, Pencil } from 'lucide-react';
import { GroupedQrocEditDialog } from './edit/GroupedQrocEditDialog';
import { RichTextDisplay, extractPlainText } from '@/components/ui/rich-text-display';

// Base types we organize into 3 high-level columns:
// 1. mcq (single QCM)
// 2. qroc (single QROC + grouped QROC blocks)
// 3. clinical (clinical case groups)
type BaseType = 'mcq' | 'qroc';
type ColumnKey = 'mcq' | 'qroc' | 'clinical';

interface OrganizerProps {
  lecture: Lecture;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

type OrganizerEntry =
  | { kind: 'single'; question: Question }
  | { kind: 'group'; groupKind: 'grouped_qroc' | 'clinical_case'; caseNumber: number; questions: Question[] };

type GroupEntry = Extract<OrganizerEntry, { kind: 'group' }>;

interface DragToken {
  id: string; // 'q:<id>' for single, 'g:<groupKind>:<caseNumber>' for group, 'gq:<questionId>' for single inside grouped qroc maybe
  column: ColumnKey;
  // For convenience when dropping
  payload: OrganizerEntry | { kind: 'single-detached'; question: Question; fromGroup?: { groupKind: 'grouped_qroc'; caseNumber: number } };
}

export function QuestionOrganizerDialog({ lecture, isOpen, onOpenChange, onSaved }: OrganizerProps) {
  // Previously: PCEM1 / PCEM2 flattened clinical cases; now we always expose the clinical column
  const isPreclinical = false; // keep variable for layout references; forced to false to always show Cas Cliniques
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  // ref for confirmation overlay focus trap
  const confirmOverlayRef = useRef<HTMLDivElement | null>(null);

  // columns state
  const [columns, setColumns] = useState<Record<ColumnKey, OrganizerEntry[]>>({ mcq: [], qroc: [], clinical: [] });
  // Grouped QROC edit dialog state
  const [editingGrouped, setEditingGrouped] = useState<null | { caseNumber: number; questions: Question[] }>(null);

  const dragItem = useRef<DragToken | null>(null);
  const overEntryId = useRef<string | null>(null); // target entry token id
  const overColumn = useRef<ColumnKey | null>(null);
  const overAfter = useRef<boolean>(false);

  // In-group drag (reordering questions inside a group)
  const groupDrag = useRef<{ caseNumber: number; groupKind: 'grouped_qroc' | 'clinical_case'; questionId: string } | null>(null);
  const groupOverQuestionId = useRef<string | null>(null);
  const groupOverAfter = useRef<boolean>(false);

  // Type change confirmation state
  const [pendingTypeChange, setPendingTypeChange] = useState<null | {
    sourceCol: ColumnKey | null;
    targetCol: ColumnKey;
    entry: OrganizerEntry;
    targetEntryId: string | null;
    after: boolean;
    fromGroup?: { groupKind: 'grouped_qroc' | 'clinical_case'; caseNumber: number; questionId: string };
    clinicalCaseNumber?: number;
  }>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchQuestions();
  }, [isOpen, lecture.id]);

  // Focus first actionable element when confirmation modal opens
  useEffect(() => {
    if (pendingTypeChange && confirmOverlayRef.current) {
      // slight delay to ensure elements rendered
      setTimeout(() => {
        const first = confirmOverlayRef.current?.querySelector<HTMLElement>('select,button');
        first?.focus();
      }, 0);
    }
  }, [pendingTypeChange]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/questions?lectureId=${lecture.id}`);
      if (!res.ok) throw new Error('Failed to load questions');
      const data: Question[] = await res.json();
      setQuestions(data);
  // Removed auto-flatten of clinical cases so they can always be organized explicitly
      // Build groups
      const groupedQrocMap = new Map<number, Question[]>();
      data.filter(q => q.type === 'qroc' && q.caseNumber).forEach(q => {
        const arr = groupedQrocMap.get(q.caseNumber!) || [];
        arr.push(q);
        groupedQrocMap.set(q.caseNumber!, arr);
      });
  const groupedQrocEntries: GroupEntry[] = [];
      const singleQroc: Question[] = [];
      for (const q of data.filter(q => q.type === 'qroc')) {
        if (q.caseNumber && groupedQrocMap.get(q.caseNumber)?.length! > 1) {
          // skip singles here; group handled later
          continue;
        }
        if (!q.caseNumber) singleQroc.push(q);
        else if (groupedQrocMap.get(q.caseNumber)!.length === 1) singleQroc.push(q); // degenerated group
      }
      for (const [cn, arr] of groupedQrocMap.entries()) {
        if (arr.length > 1) {
          // stable order by caseQuestionNumber then id
            arr.sort((a,b)=> (a.caseQuestionNumber||0)-(b.caseQuestionNumber||0) || a.id.localeCompare(b.id));
          groupedQrocEntries.push({ kind: 'group', groupKind: 'grouped_qroc', caseNumber: cn, questions: arr });
        }
      }
      // Clinical cases grouping (always enabled now)
      let clinicalEntries: GroupEntry[] = [];
      const clinicalMap = new Map<number, Question[]>();
      data.filter(q => (q.type === 'clinic_mcq' || q.type === 'clinic_croq') && q.caseNumber).forEach(q => {
        const arr = clinicalMap.get(q.caseNumber!) || [];
        arr.push(q);
        clinicalMap.set(q.caseNumber!, arr);
      });
      for (const [cn, arr] of clinicalMap.entries()) {
        arr.sort((a,b)=> (a.caseQuestionNumber||0)-(b.caseQuestionNumber||0) || a.id.localeCompare(b.id));
        clinicalEntries.push({ kind: 'group', groupKind: 'clinical_case', caseNumber: cn, questions: arr });
      }
      const mcqEntries: OrganizerEntry[] = data.filter(q => q.type === 'mcq').sort((a,b)=>(a.number??0)-(b.number??0) || a.id.localeCompare(b.id)).map(q => ({ kind: 'single', question: q }));
      const qrocSingles: OrganizerEntry[] = singleQroc.sort((a,b)=>(a.number??0)-(b.number??0) || a.id.localeCompare(b.id)).map(q => ({ kind: 'single', question: q }));
      // Combine singles + groups for qroc column (groups appear after singles by default)
  const qrocColumn: OrganizerEntry[] = [...qrocSingles, ...groupedQrocEntries.sort((a,b)=> a.caseNumber - b.caseNumber)];
  setColumns({ mcq: mcqEntries, qroc: qrocColumn, clinical: clinicalEntries.sort((a,b)=> a.caseNumber - b.caseNumber) });
  // Removed dissolving of clinical cases for preclinical niveaux
  setDirty(false);
    } catch (e) {
      console.error(e);
  safeToast({ title: 'Erreur', description: "Chargement des questions impossible.", variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const originalHash = useMemo(() => JSON.stringify(columns), [questions]);

  const hasChanges = useMemo(() => originalHash !== JSON.stringify(columns), [columns, originalHash]);

  const buildToken = (entry: OrganizerEntry, column: ColumnKey): DragToken => {
    if (entry.kind === 'single') return { id: `q:${entry.question.id}`, column, payload: entry };
    return { id: `g:${entry.groupKind}:${entry.caseNumber}`, column, payload: entry };
  };

  // Safe toast wrapper
  const safeToast = (cfg: Parameters<typeof toast>[0]) => {
    if (typeof window !== 'undefined') requestAnimationFrame(() => toast(cfg)); else toast(cfg);
  };

  // Sanitize columns: remove duplicate question ids inside a group, dissolve invalid groups
  const sanitizeColumns = (cols: Record<ColumnKey, OrganizerEntry[]>): Record<ColumnKey, OrganizerEntry[]> => {
    const clone: Record<ColumnKey, OrganizerEntry[]> = { mcq: [...cols.mcq], qroc: [], clinical: [] } as any;
    // process qroc groups
    for (const entry of cols.qroc) {
      if (entry.kind === 'group') {
        const seen = new Set<string>();
        const cleaned: Question[] = [];
        for (const q of entry.questions) {
          if (!seen.has(q.id)) { seen.add(q.id); cleaned.push(q); }
        }
        if (entry.groupKind === 'grouped_qroc') {
          if (cleaned.length <= 1) {
            // dissolve
            cleaned.forEach(q => { q.caseNumber = null as any; q.caseQuestionNumber = null as any; clone.qroc.push({ kind:'single', question: q }); });
            continue;
          }
          cleaned.forEach((q,i)=> { q.caseNumber = entry.caseNumber as any; q.caseQuestionNumber = i+1 as any; });
        }
        clone.qroc.push({ ...entry, questions: cleaned });
      } else {
        clone.qroc.push(entry);
      }
    }
    // clinical groups
    for (const entry of cols.clinical) {
      if (entry.kind === 'group') {
        const seen = new Set<string>();
        const cleaned: Question[] = [];
        for (const q of entry.questions) {
          if (!seen.has(q.id)) { seen.add(q.id); cleaned.push(q); }
        }
        cleaned.forEach((q,i)=> { q.caseNumber = entry.caseNumber as any; q.caseQuestionNumber = i+1 as any; });
        clone.clinical.push({ ...entry, questions: cleaned });
      } else clone.clinical.push(entry);
    }
    return clone;
  };

  const onDragStartEntry = (entry: OrganizerEntry, column: ColumnKey) => (e: React.DragEvent) => {
    if (pendingTypeChange) { e.preventDefault(); return; }
    dragItem.current = buildToken(entry, column);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragItem.current.id);
    (e.currentTarget as HTMLElement).classList.add('opacity-60');
  };

  const onDragEndEntry = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('opacity-60');
    // do not reset dragItem here because onDrop uses it; html5 triggers dragend after drop
  };

  const onDragOverColumn = (type: ColumnKey) => (e: React.DragEvent) => {
    e.preventDefault();
    overColumn.current = type;
    if ((columns[type] || []).length === 0) overEntryId.current = null;
  };

  const onDragOverItem = (type: ColumnKey, id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    overColumn.current = type;
    overEntryId.current = id;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    overAfter.current = e.clientY > midpoint; // true => drop after this item
  };

  // Stabilize target on drag enter as well (helps when dragover fires on container afterwards)
  const onDragEnterItem = (col: ColumnKey, id: string) => (e: React.DragEvent) => {
    overColumn.current = col;
    overEntryId.current = id;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    overAfter.current = e.clientY > midpoint;
  };

  const onDrop = () => {
    // If dropping a question being dragged within a group onto a column (extraction)
    if (groupDrag.current && overColumn.current) {
      const g = groupDrag.current;
      const targetCol = overColumn.current;
      // Only allow extraction of grouped_qroc questions for now
      if (g.groupKind === 'grouped_qroc') {
        const targetEntryId = overEntryId.current; // could be null or group/single id
        const after = overAfter.current;
        // If target column is qroc: extract as single (type remains qroc)
        if (targetCol === 'qroc') {
          extractFromGroupAndInsert(g, targetCol, targetEntryId, after);
        } else if (targetCol === 'mcq') {
          // extraction + type change confirmation
            const grp = findGroup('qroc', g.caseNumber, g.groupKind);
            const question = grp?.questions.find(q => q.id === g.questionId);
            if (question) {
              const tempEntry: OrganizerEntry = { kind:'single', question: { ...question } };
              setPendingTypeChange({ sourceCol: null, targetCol: 'mcq', entry: tempEntry, targetEntryId, after, fromGroup: { ...g } });
            }
        }
      } else if (g.groupKind === 'clinical_case') {
        // Support two behaviors:
        // 1. Drop into base column (conversion) -> same as before (clinic_mcq->mcq, clinic_croq->qroc)
        // 2. Drop inside clinical column onto another clinical case group -> move question between cases (no toast)
        const grp = findGroup('clinical', g.caseNumber, 'clinical_case');
        const question = grp?.questions.find(q => q.id === g.questionId);
        if (!question) { groupDrag.current = null; return; }
        if (targetCol === 'clinical') {
          const targetEntryId = overEntryId.current;
            if (targetEntryId && targetEntryId.startsWith('g:clinical_case:')) {
              const parts = targetEntryId.split(':');
              const targetCaseNum = Number(parts[2]);
              if (!isNaN(targetCaseNum) && targetCaseNum !== g.caseNumber) {
                setColumns(prev => {
                  const next: Record<ColumnKey, OrganizerEntry[]> = { mcq:[...prev.mcq], qroc:[...prev.qroc], clinical:[...prev.clinical] };
                  const sourceIdx = next.clinical.findIndex(e => e.kind==='group' && (e as any).caseNumber===g.caseNumber);
                  const destIdx = next.clinical.findIndex(e => e.kind==='group' && (e as any).caseNumber===targetCaseNum);
                  if (sourceIdx>=0 && destIdx>=0) {
                    const sourceGroup = next.clinical[sourceIdx] as GroupEntry;
                    const destGroup = next.clinical[destIdx] as GroupEntry;
                    const qIndex = sourceGroup.questions.findIndex(q => q.id === question.id);
                    if (qIndex>=0) {
                      const [moved] = sourceGroup.questions.splice(qIndex,1);
                      moved.caseNumber = destGroup.caseNumber as any;
                      destGroup.questions.push(moved);
                      // Re-index caseQuestionNumber in both groups
                      sourceGroup.questions.forEach((q,i)=> q.caseQuestionNumber = i+1 as any);
                      destGroup.questions.forEach((q,i)=> q.caseQuestionNumber = i+1 as any);
                      // Remove empty source group
                      if (sourceGroup.questions.length===0) next.clinical.splice(sourceIdx,1);
                    }
                  }
                  return next;
                });
              }
            }
          groupDrag.current = null; overEntryId.current = null; return;
        }
        // Conversion to base columns
        const desiredCol = question.type === 'clinic_mcq' ? 'mcq' : 'qroc';
        if (targetCol === desiredCol) {
          const targetEntryId = overEntryId.current;
          const after = overAfter.current;
          const tempEntry: OrganizerEntry = { kind:'single', question: { ...question } };
          setPendingTypeChange({ sourceCol: null, targetCol: desiredCol, entry: tempEntry, targetEntryId, after, fromGroup: { ...g } });
        } // else silently ignore incompatible drop instead of error toast
      }
      groupDrag.current = null; groupOverQuestionId.current = null; overEntryId.current = null; return;
    }
    if (groupDrag.current) return; // ignore other scenarios
    if (!dragItem.current || !overColumn.current) return;
    const targetCol = overColumn.current;
    const targetEntryId = overEntryId.current; // token id of entry drop target
    const dragId = dragItem.current.id;
    const sourceCol = dragItem.current.column;
  // moved dirty state handling to explicit mutation points
  setColumns(prev => {
      const next: Record<ColumnKey, OrganizerEntry[]> = { mcq: [...prev.mcq], qroc: [...prev.qroc], clinical: [...prev.clinical] };
      const sourceArr = next[sourceCol];
      const sourceIdx = sourceArr.findIndex(e => buildToken(e, sourceCol).id === dragId);
      if (sourceIdx < 0) return prev; // nothing to move
      let entry: OrganizerEntry = sourceArr[sourceIdx];
      sourceArr.splice(sourceIdx, 1);

      if (entry.kind === 'group' && entry.groupKind === 'clinical_case' && targetCol !== 'clinical') {
        // Convert whole clinical case to base singles
        const clinicalQuestions = entry.questions;
        const counts = { clinic_mcq: 0, clinic_croq: 0 };
        clinicalQuestions.forEach(q => { if (q.type === 'clinic_mcq') counts.clinic_mcq++; else if (q.type === 'clinic_croq') counts.clinic_croq++; });
        // Decide insertion index in target column for those mapping to targetCol
        const targetArrForDrop = next[targetCol];
        let insertionIndex = targetEntryId ? targetArrForDrop.findIndex(e => buildToken(e, targetCol).id === targetEntryId) : targetArrForDrop.length;
        if (insertionIndex < 0) insertionIndex = targetArrForDrop.length;
        if (targetEntryId && overAfter.current) insertionIndex = Math.min(insertionIndex + 1, targetArrForDrop.length);
        // Remove group fully (already spliced out of sourceArr earlier)
        // Insert converted questions maintaining original order
        let offset = 0;
        clinicalQuestions.forEach(q => {
          const baseCol: ColumnKey = q.type === 'clinic_mcq' ? 'mcq' : 'qroc';
          const converted: Question = { ...q, type: (q.type === 'clinic_mcq' ? 'mcq' : 'qroc') as any, caseNumber: null as any, caseQuestionNumber: null as any };
          const entryObj: OrganizerEntry = { kind: 'single', question: converted };
          if (baseCol === targetCol) {
            targetArrForDrop.splice(insertionIndex + offset, 0, entryObj);
            offset++;
          } else {
            // push to its own base column end
            next[baseCol].push(entryObj);
          }
        });
        safeToast({ title: 'Cas clinique dissous', description: `Converti en ${counts.clinic_mcq} QCM et ${counts.clinic_croq} QROC.`, variant: 'default' });
        dragItem.current = null; overEntryId.current = null; overColumn.current = null; overAfter.current = false;
        return sanitizeColumns(next);
      }
      dragItem.current = null;
      overEntryId.current = null;
      overColumn.current = null;
      overAfter.current = false;
      if ((entry as any).kind === 'single') {
        const originalType = (entry as any).question.type as string;
        let mappingTargetType = originalType;
        if (targetCol === 'mcq') mappingTargetType = 'mcq';
        else if (targetCol === 'qroc') mappingTargetType = 'qroc';
        else if (targetCol === 'clinical') mappingTargetType = originalType === 'mcq' ? 'clinic_mcq' : originalType === 'qroc' ? 'clinic_croq' : originalType;
        if (mappingTargetType !== originalType) {
          sourceArr.splice(sourceIdx,0,entry);
          if (targetCol === 'clinical') {
            const groups = prev.clinical.filter(g => g.kind==='group') as GroupEntry[];
            let defCase: number | undefined;
            if (targetEntryId && targetEntryId.startsWith('g:clinical_case:')) {
              const parts = targetEntryId.split(':');
              const maybe = Number(parts[2]);
              if (!isNaN(maybe)) defCase = maybe;
            }
            if (defCase === undefined) {
              const max = groups.reduce((m,g)=> Math.max(m,g.caseNumber),0);
              defCase = max + 1;
            }
            setPendingTypeChange({ sourceCol, targetCol, entry, targetEntryId, after: overAfter.current, clinicalCaseNumber: defCase });
          } else {
            setPendingTypeChange({ sourceCol, targetCol, entry, targetEntryId, after: overAfter.current });
          }
          return prev;
        }
      }
  const targetArr = next[targetCol];
      let insertAt = targetEntryId ? targetArr.findIndex(e => buildToken(e, targetCol).id === targetEntryId) : targetArr.length;
      if (insertAt < 0) insertAt = targetArr.length;
      if (targetEntryId && overAfter.current) insertAt = Math.min(insertAt + 1, targetArr.length);
  targetArr.splice(insertAt, 0, entry);
  return sanitizeColumns(next);
    });
    dragItem.current = null;
    overEntryId.current = null;
    overColumn.current = null;
    overAfter.current = false;
    setDirty(true);
  };

  // In-group drag handlers
  const onGroupQuestionDragStart = (group: GroupEntry, q: Question) => (e: React.DragEvent) => {
    if (pendingTypeChange) { e.preventDefault(); return; }
    e.stopPropagation();
    groupDrag.current = { caseNumber: group.caseNumber, groupKind: group.groupKind, questionId: q.id };
  };
  const onGroupQuestionDragOver = (group: GroupEntry, targetQ: Question) => (e: React.DragEvent) => {
    if (!groupDrag.current) return;
    if (groupDrag.current.caseNumber !== group.caseNumber || groupDrag.current.groupKind !== group.groupKind) return; // only same group reorder for now
    e.preventDefault();
    e.stopPropagation();
    groupOverQuestionId.current = targetQ.id;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    groupOverAfter.current = e.clientY > midpoint;
  };
  const onGroupQuestionDrop = (group: GroupEntry) => (e: React.DragEvent) => {
    if (!groupDrag.current) return;
    if (groupDrag.current.caseNumber !== group.caseNumber) return;
    e.preventDefault();
    e.stopPropagation();
    const dragQId = groupDrag.current.questionId;
    const targetId = groupOverQuestionId.current;
    if (!targetId || targetId === dragQId) {
      groupDrag.current = null; groupOverQuestionId.current = null; return;
    }
  setColumns(prev => {
      const next: Record<ColumnKey, OrganizerEntry[]> = { mcq: [...prev.mcq], qroc: [...prev.qroc], clinical: [...prev.clinical] };
      const colKey: ColumnKey = group.groupKind === 'clinical_case' ? 'clinical' : 'qroc';
      const groupIdx = next[colKey].findIndex(e => e.kind==='group' && (e as any).caseNumber === group.caseNumber && (e as any).groupKind === group.groupKind);
      if (groupIdx < 0) return prev;
      const grp = next[colKey][groupIdx] as GroupEntry;
      const qs = [...grp.questions];
      const fromIdx = qs.findIndex(q => q.id === dragQId);
      const toIdx = qs.findIndex(q => q.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moving] = qs.splice(fromIdx,1);
      let insertAt = toIdx;
      if (groupOverAfter.current && toIdx >= 0) insertAt = toIdx + (fromIdx < toIdx ? 0 : 1);
      if (insertAt > qs.length) insertAt = qs.length;
      qs.splice(insertAt,0,moving);
      // Update caseQuestionNumber sequentially
      qs.forEach((q,i)=> { q.caseQuestionNumber = i+1; });
  (next[colKey][groupIdx] as any).questions = qs;
  return sanitizeColumns(next);
    });
    groupDrag.current = null;
    groupOverQuestionId.current = null;
    groupOverAfter.current = false;
    setDirty(true);
  };

  const revert = () => { fetchQuestions(); };

  // Extraction and group modifications
  const extractQuestion = (group: GroupEntry, q: Question) => {
  setColumns(prev => {
      const next: Record<ColumnKey, OrganizerEntry[]> = { mcq:[...prev.mcq], qroc:[...prev.qroc], clinical:[...prev.clinical] };
      const colKey: ColumnKey = group.groupKind==='clinical_case' ? 'clinical' : 'qroc';
      const gIdx = next[colKey].findIndex(e => e.kind==='group' && (e as any).caseNumber===group.caseNumber && (e as any).groupKind===group.groupKind);
      if (gIdx<0) return prev;
      const grp = next[colKey][gIdx] as GroupEntry;
      const qIdx = grp.questions.findIndex(x=>x.id===q.id);
      if (qIdx<0) return prev;
      const [removed] = grp.questions.splice(qIdx,1);
      removed.caseNumber = null as any;
      removed.caseQuestionNumber = null as any;
      if (group.groupKind==='grouped_qroc') {
        // insert after group
        const insertAt = gIdx+1;
        next.qroc.splice(insertAt,0,{ kind:'single', question: removed });
      } else {
  safeToast({ title:'Info', description:'Extraction depuis cas clinique non supportée.' });
      }
      if (grp.questions.length <=1 && group.groupKind==='grouped_qroc') {
        if (grp.questions.length===1){
          const last = grp.questions[0];
          last.caseNumber = null as any; last.caseQuestionNumber = null as any;
          next[colKey].splice(gIdx,1,{ kind:'single', question:last });
        } else {
          next[colKey].splice(gIdx,1);
        }
      } else {
        grp.questions.forEach((qq,i)=> { qq.caseQuestionNumber = i+1; });
      }
  return sanitizeColumns(next);
    });
    setDirty(true);
  };

  // Helper to find group entry in current state (read-only)
  const findGroup = (col: ColumnKey, caseNumber: number, groupKind: 'grouped_qroc' | 'clinical_case') => {
    const list = columns[col];
    return list.find(e => e.kind==='group' && e.groupKind===groupKind && e.caseNumber===caseNumber) as GroupEntry | undefined;
  };

  // Extract via drag drop: remove from group and insert as single at chosen position in target column
  const extractFromGroupAndInsert = (g: { groupKind:'grouped_qroc'|'clinical_case'; caseNumber:number; questionId:string }, targetCol: ColumnKey, targetEntryId: string | null, after: boolean) => {
  setColumns(prev => {
      const next: Record<ColumnKey, OrganizerEntry[]> = { mcq:[...prev.mcq], qroc:[...prev.qroc], clinical:[...prev.clinical] };
      const sourceCol: ColumnKey = g.groupKind==='clinical_case' ? 'clinical' : 'qroc';
      const arr = next[sourceCol];
      const grpIdx = arr.findIndex(e => e.kind==='group' && (e as any).groupKind===g.groupKind && (e as any).caseNumber===g.caseNumber);
      if (grpIdx<0) return prev;
      const grp = arr[grpIdx] as GroupEntry;
      const qIdx = grp.questions.findIndex(q => q.id === g.questionId);
      if (qIdx<0) return prev;
      const [removed] = grp.questions.splice(qIdx,1);
      removed.caseNumber = null as any; removed.caseQuestionNumber = null as any;
      // Dissolve if needed (grouped_qroc only)
      if (grp.groupKind==='grouped_qroc' && grp.questions.length <=1) {
        if (grp.questions.length===1) {
          const last = grp.questions[0];
          last.caseNumber = null as any; last.caseQuestionNumber = null as any;
          arr.splice(grpIdx,1,{ kind:'single', question:last });
        } else { arr.splice(grpIdx,1); }
      } else {
        grp.questions.forEach((qq,i)=> { qq.caseQuestionNumber = i+1; });
      }
      // Insert removed as single in target column
      const targetArr = next[targetCol];
      let insertAt = targetEntryId ? targetArr.findIndex(e => buildToken(e, targetCol).id === targetEntryId) : targetArr.length;
      if (insertAt < 0) insertAt = targetArr.length;
      if (targetEntryId && after) insertAt = Math.min(insertAt+1, targetArr.length);
      targetArr.splice(insertAt,0,{ kind:'single', question: removed });
  return sanitizeColumns(next);
    });
    setDirty(true);
  };

  const addSingleToGroup = (question: Question, targetGroup: GroupEntry) => {
    if (targetGroup.groupKind!=='grouped_qroc') return;
  setColumns(prev => {
      const next: Record<ColumnKey, OrganizerEntry[]> = { mcq:[...prev.mcq], qroc:[...prev.qroc], clinical:[...prev.clinical] };
      const singleIdx = next.qroc.findIndex(e => e.kind==='single' && (e as any).question.id===question.id);
      if (singleIdx<0) return prev;
      next.qroc.splice(singleIdx,1);
      const grpIdx = next.qroc.findIndex(e => e.kind==='group' && (e as any).groupKind==='grouped_qroc' && (e as any).caseNumber===targetGroup.caseNumber);
      if (grpIdx<0) return prev;
      const grp = next.qroc[grpIdx] as GroupEntry;
  // Avoid duplication if already in group (shouldn't happen but safety)
  if (grp.questions.some(q => q.id === question.id)) return prev;
      question.caseNumber = targetGroup.caseNumber as any;
      question.caseQuestionNumber = grp.questions.length+1 as any;
      grp.questions.push(question);
  return sanitizeColumns(next);
    });
    setDirty(true);
  };

  const confirmTypeChange = () => {
    if (!pendingTypeChange) return;
    const { sourceCol, targetCol, entry, targetEntryId, after, fromGroup, clinicalCaseNumber } = pendingTypeChange;
    if (entry.kind !== 'single') { setPendingTypeChange(null); return; }
  setColumns(prev => {
      const next: Record<ColumnKey, OrganizerEntry[]> = { mcq:[...prev.mcq], qroc:[...prev.qroc], clinical:[...prev.clinical] };
      if (sourceCol) {
        const sArr = next[sourceCol];
        const sIdx = sArr.findIndex(e => e.kind==='single' && (e as any).question.id===entry.question.id);
        if (sIdx>=0) sArr.splice(sIdx,1);
      }
      if (fromGroup) {
        const sc: ColumnKey = fromGroup.groupKind==='clinical_case' ? 'clinical' : 'qroc';
        const list = next[sc];
        const grpIdx = list.findIndex(e => e.kind==='group' && (e as any).groupKind===fromGroup.groupKind && (e as any).caseNumber===fromGroup.caseNumber);
        if (grpIdx>=0) {
          const grp = list[grpIdx] as GroupEntry;
          const qIdx = grp.questions.findIndex(q => q.id === fromGroup.questionId);
          if (qIdx>=0) grp.questions.splice(qIdx,1);
          if (grp.groupKind==='grouped_qroc' && grp.questions.length <=1) {
            if (grp.questions.length===1) {
              const last = grp.questions[0]; last.caseNumber=null as any; last.caseQuestionNumber=null as any;
              list.splice(grpIdx,1,{ kind:'single', question:last });
            } else list.splice(grpIdx,1);
          } else {
            grp.questions.forEach((qq,i)=> { qq.caseQuestionNumber = i+1; });
          }
        }
      }
      if (targetCol === 'clinical') {
        if (isPreclinical) { // disallow in preclinical context
          setPendingTypeChange(null);
          return prev;
        }
        entry.question.type = entry.question.type === 'mcq' ? 'clinic_mcq' : 'clinic_croq';
        const targetCase = clinicalCaseNumber || 1;
        let existingIdx = next.clinical.findIndex(e => e.kind==='group' && (e as any).caseNumber===targetCase);
        if (existingIdx === -1) {
          entry.question.caseNumber = targetCase as any; entry.question.caseQuestionNumber = 1 as any;
          const newGroup: GroupEntry = { kind:'group', groupKind:'clinical_case', caseNumber: targetCase, questions:[entry.question] };
          let insertAt = targetEntryId ? next.clinical.findIndex(e => buildToken(e,'clinical').id===targetEntryId) : next.clinical.length;
          if (insertAt<0) insertAt = next.clinical.length;
          if (targetEntryId && after) insertAt = Math.min(insertAt+1, next.clinical.length);
          next.clinical.splice(insertAt,0,newGroup);
        } else {
          const grp = next.clinical[existingIdx] as GroupEntry;
            entry.question.caseNumber = grp.caseNumber as any; entry.question.caseQuestionNumber = grp.questions.length+1 as any;
          grp.questions.push(entry.question);
        }
      } else {
        entry.question.type = (targetCol==='mcq' ? 'mcq':'qroc') as any;
        if (targetCol==='qroc') { entry.question.caseNumber=null as any; entry.question.caseQuestionNumber=null as any; }
        const tArr = next[targetCol];
        let insertAt = targetEntryId ? tArr.findIndex(e => buildToken(e,targetCol).id===targetEntryId) : tArr.length;
        if (insertAt<0) insertAt = tArr.length;
        if (targetEntryId && after) insertAt = Math.min(insertAt+1, tArr.length);
        tArr.splice(insertAt,0,entry);
      }
  return sanitizeColumns(next);
    });
    setPendingTypeChange(null);
    setDirty(true);
  };
  const cancelTypeChange = () => setPendingTypeChange(null);

  const save = async () => {
    try {
      setSaving(true);
      const tasks: Promise<Response>[] = [];
      // Build sequential numbering for single mcq and qroc (flatten qroc with groups)
      let mcqCounter = 1;
      columns.mcq.forEach(e => { if (e.kind==='single') { e.question.number = mcqCounter++; } });
      let qrocCounter = 1;
      columns.qroc.forEach(e => {
        if (e.kind==='single') { e.question.number = qrocCounter++; }
        else if (e.kind==='group') { e.questions.forEach(q=> { q.number = qrocCounter++; }); }
      });
      // Prepare payloads
      const addUpdate = (q: Question) => {
        // Force clinical types to base in preclinical niveaux
        if (isPreclinical && (q.type === 'clinic_mcq' || q.type === 'clinic_croq')) {
          q.type = (q.type === 'clinic_mcq' ? 'mcq' : 'qroc') as any;
          q.caseNumber = null as any; q.caseQuestionNumber = null as any; q.caseText = null as any;
        }
        const targetType = q.type; // already mutated / normalized
        // Clean answers when converting types
        let correct: string[] = Array.isArray(q.correctAnswers)? [...q.correctAnswers!] : (Array.isArray((q as any).correct_answers)? (q as any).correct_answers: []);
        if (targetType === 'mcq') {
          // ensure correct answers remain consistent with options else clear
          const optIds = new Set((q.options||[]).map(o=>o.id));
          correct = correct.filter(id => optIds.has(id));
        } else if (targetType === 'qroc') {
          // keep at most first answer
          correct = correct.slice(0,1);
        }
        const payload: any = {
          id: q.id,
          lectureId: lecture.id,
          type: targetType,
          text: q.text,
          options: (targetType === 'mcq') ? (q.options||[]) : [],
          correctAnswers: correct,
          explanation: q.explanation ?? null,
          courseReminder: (q as any).courseReminder ?? (q as any).course_reminder ?? null,
          number: q.number ?? null,
          session: q.session ?? null,
          mediaUrl: (q as any).mediaUrl ?? (q as any).media_url ?? null,
          mediaType: (q as any).mediaType ?? (q as any).media_type ?? null,
          courseReminderMediaUrl: (q as any).courseReminderMediaUrl ?? (q as any).course_reminder_media_url ?? null,
          courseReminderMediaType: (q as any).courseReminderMediaType ?? (q as any).course_reminder_media_type ?? null,
          caseNumber: (q.type === 'clinic_mcq' || q.type === 'clinic_croq') ? q.caseNumber ?? null : (q.type === 'qroc' && q.caseNumber ? q.caseNumber : null),
          caseText: (q.type === 'clinic_mcq' || q.type === 'clinic_croq') ? q.caseText ?? null : null,
          caseQuestionNumber: (q.type === 'clinic_mcq' || q.type === 'clinic_croq' || q.type === 'qroc') ? q.caseQuestionNumber ?? null : null,
        };
        tasks.push(fetch('/api/questions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
      };
      // Iterate columns
      columns.mcq.forEach(e => { if (e.kind==='single') addUpdate(e.question); });
      columns.qroc.forEach(e => { if (e.kind==='single') addUpdate(e.question); else if (e.kind==='group') e.questions.forEach(addUpdate); });
      columns.clinical.forEach(e => { if (e.kind==='group') e.questions.forEach(addUpdate); });

      const res = await Promise.all(tasks);
      const failed = res.filter(r => !r.ok);
      if (failed.length) {
        let msg = 'Échec partiel lors de la sauvegarde.';
        try { const j = await failed[0].json(); msg = j.error || msg; } catch {}
        throw new Error(msg);
      }
  safeToast({ title: 'Ordre enregistré', description: 'La réorganisation a été sauvegardée.' });
      if (onSaved) onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
  safeToast({ title: 'Erreur', description: e instanceof Error ? e.message : "Échec de la sauvegarde.", variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const query = search.toLowerCase();
  const matchEntry = (e: OrganizerEntry) => {
    if (query === '') return true;
    if (e.kind === 'single') return extractPlainText(e.question.text || '').toLowerCase().includes(query);
    return e.questions.some(q => extractPlainText(q.text || '').toLowerCase().includes(query));
  };

  const typeBadge = (q: Question) => {
    if (q.type === 'mcq') return 'q-qcm';
    if (q.type === 'qroc') return 'q-qroc';
    if (q.type === 'clinic_mcq') return 'c-qcm';
    if (q.type === 'clinic_croq') return 'c-qroc';
    return q.type;
  };

  const ColumnView: React.FC<{ title: string; col: ColumnKey; entries: OrganizerEntry[] }> = ({ title, col, entries }) => {
    const display = entries.filter(matchEntry);
    return (
      <div className="flex-1 min-w-[260px]">
        <Card onDragOver={onDragOverColumn(col)} onDrop={onDrop}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>{title}</span>
              <span className="text-xs text-muted-foreground">{display.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {display.map((entry, idx) => {
              if (entry.kind === 'single') {
                const tokenId = buildToken(entry, col).id;
                return (
                  <div
                    key={tokenId}
                    className="p-2 rounded-md border bg-card hover:bg-muted/50 flex items-start gap-2 group"
                    onDragOver={onDragOverItem(col, tokenId)}
                    onDragEnter={onDragEnterItem(col, tokenId)}
                    onDrop={onDrop}
                  >
                    <span
                      className="mt-0.5 flex-shrink-0 text-muted-foreground cursor-grab active:cursor-grabbing"
                      draggable={!pendingTypeChange}
                      onDragStart={onDragStartEntry(entry, col)}
                      onDragEnd={onDragEndEntry}
                      onMouseDown={e=> e.stopPropagation()}
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground flex items-center gap-2">#{idx + 1}<span className="px-1 rounded bg-muted text-[10px] uppercase tracking-wide">{typeBadge(entry.question)}</span></div>
                      <div className="text-sm line-clamp-2"><RichTextDisplay text={entry.question.text || ''} /></div>
                      {/* Type change buttons removed; only bloc select remains */}
                      {col==='qroc' && (
                        <div className="mt-1">
                          <select
                            className="text-[10px] border rounded px-1 py-0.5 bg-background"
                            defaultValue=""
                            onChange={e => {
                              const val = e.target.value; if (!val) return;
                              const grp = columns.qroc.find(g => g.kind==='group' && (g as any).caseNumber===Number(val)) as GroupEntry | undefined;
                              if (grp) addSingleToGroup(entry.question, grp);
                              e.target.value='';
                            }}
                          >
                            <option value="">Ajouter au bloc…</option>
                            {columns.qroc.filter(g=> g.kind==='group' && g.groupKind==='grouped_qroc').map(g => (
                              <option key={(g as any).caseNumber} value={(g as any).caseNumber}>Bloc #{(g as any).caseNumber}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              // group
              const tokenId = buildToken(entry, col).id;
              return (
                <div key={tokenId} className="rounded-md border bg-muted/30">
                  <div
                    className="p-2 border-b flex items-center gap-2 bg-muted/50"
                    onDragOver={onDragOverItem(col, tokenId)}
                    onDragEnter={onDragEnterItem(col, tokenId)}
                    onDrop={onDrop}
                  >
                    <span
                      className="text-muted-foreground cursor-grab active:cursor-grabbing"
                      draggable={!pendingTypeChange}
                      onDragStart={onDragStartEntry(entry, col)}
                      onDragEnd={onDragEndEntry}
                      onMouseDown={e=> e.stopPropagation()}
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <Package className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-medium">{entry.groupKind === 'grouped_qroc' ? `Bloc QROC #${entry.caseNumber}` : `Cas Clinique #${entry.caseNumber}`}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{entry.questions.length} éléments</span>
                      {entry.groupKind === 'grouped_qroc' && (
                        <button
                          type="button"
                          onClick={(e)=> { e.stopPropagation(); setEditingGrouped({ caseNumber: entry.caseNumber, questions: entry.questions.map(q=> ({ ...q })) }); }}
                          className="p-1 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground"
                          title="Éditer le bloc (parse rapide)"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="p-2 space-y-1">
                    {entry.questions.map((q,qi) => (
                      <div
                        key={`${entry.caseNumber}-${q.id}-${qi}`}
                        className="text-xs line-clamp-1 flex items-center gap-2 rounded px-1 py-0.5 border border-transparent hover:border-muted-foreground/30 cursor-move group/item"
                        draggable={!pendingTypeChange}
                        onDragStart={onGroupQuestionDragStart(entry, q)}
                        onDragOver={onGroupQuestionDragOver(entry, q)}
                        onDragEnter={onGroupQuestionDragOver(entry, q)}
                        onDrop={onGroupQuestionDrop(entry)}
                      >
                        <span className="px-1 rounded bg-white/40 dark:bg-black/20 border text-[10px] uppercase">{typeBadge(q)}</span>
                        <span className="flex-1">{q.text}</span>
                        {entry.groupKind==='grouped_qroc' && (
                          <button
                            type="button"
                            className="opacity-0 group-hover/item:opacity-100 transition text-[10px] px-1 py-0.5 border rounded hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(ev)=> { ev.stopPropagation(); extractQuestion(entry, q); }}
                            title="Extraire du bloc"
                          >
                            <MoveLeft className="w-3 h-3" />
                          </button>
                        )}
                        {/* Clinical revert buttons removed; use drag to convert with confirmation */}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {display.length === 0 && (
              <div className="text-xs text-muted-foreground py-6 text-center">Aucune question</div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={open => { if (!pendingTypeChange) onOpenChange(open); }}>
      <DialogContent className={`max-w-6xl max-h-[95vh] overflow-hidden flex flex-col p-0 ${pendingTypeChange ? 'pointer-events-none opacity-90' : ''}`} aria-hidden={pendingTypeChange ? 'true' : undefined}>
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b">
          <DialogTitle className="flex items-center justify-between w-full">
            <span>Organiser les questions – {lecture.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-4 pb-2 flex items-center gap-3">
          <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={revert} disabled={(!hasChanges && !dirty) || saving}>
              <Undo2 className="h-4 w-4 mr-1" /> Réinitialiser
            </Button>
            <Button onClick={save} disabled={(!hasChanges && !dirty) || saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 pt-2">
          {loading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`}>
              <ColumnView title="QCM" col="mcq" entries={columns.mcq} />
              <ColumnView title="QROC & Blocs" col="qroc" entries={columns.qroc} />
              <ColumnView title="Cas Cliniques" col="clinical" entries={columns.clinical} />
            </div>
          )}
        </div>
      </DialogContent>
      {pendingTypeChange && (
        <div
          ref={confirmOverlayRef}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirmation changement type"
          tabIndex={-1}
          onKeyDown={e => {
            if (e.key === 'Tab') {
              const focusables = Array.from(confirmOverlayRef.current?.querySelectorAll<HTMLElement>('button,select') || []).filter(el => !el.hasAttribute('disabled'));
              if (focusables.length === 0) return;
              const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
              e.preventDefault();
              if (e.shiftKey) {
                const prev = (currentIndex - 1 + focusables.length) % focusables.length;
                focusables[prev].focus();
              } else {
                const next = (currentIndex + 1) % focusables.length;
                focusables[next].focus();
              }
            }
            if (e.key === 'Escape') cancelTypeChange();
          }}
        >
          <div className="bg-background border rounded-md shadow-lg p-6 w-full max-w-sm space-y-4 pointer-events-auto">
            <h3 className="text-sm font-medium">Changer le type ?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Vous allez changer le type de la question de <strong>{pendingTypeChange.entry.kind==='single' ? pendingTypeChange.entry.question.type : ''}</strong> vers <strong>{pendingTypeChange.targetCol==='clinical' ? (pendingTypeChange.entry.kind==='single' && pendingTypeChange.entry.question.type==='mcq' ? 'clinic_mcq' : 'clinic_croq') : (pendingTypeChange.targetCol==='mcq' ? 'mcq' : 'qroc')}</strong>.<br/>Certaines données incompatibles seront supprimées.
            </p>
            {pendingTypeChange.targetCol==='clinical' && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium">Cas clinique cible</label>
                <select
                  className="w-full border rounded px-2 py-1 text-xs bg-background"
                  value={pendingTypeChange.clinicalCaseNumber}
                  onChange={e=> setPendingTypeChange(prev => prev ? { ...prev, clinicalCaseNumber: Number(e.target.value) } : prev)}
                >
                  {(columns.clinical.filter(g=> g.kind==='group') as GroupEntry[]).map(g => (
                    <option key={(g as any).caseNumber} value={(g as any).caseNumber}>Cas {(g as any).caseNumber} (ajouter)</option>
                  ))}
                  {(() => { const groups = columns.clinical.filter(g=> g.kind==='group') as GroupEntry[]; const next = groups.reduce((m,g)=> Math.max(m,g.caseNumber),0)+1; return <option value={next}>Nouveau cas {next}</option>; })()}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={cancelTypeChange}>Annuler</Button>
              <Button size="sm" onClick={confirmTypeChange}>Confirmer</Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
    {editingGrouped ? (
      <GroupedQrocEditDialog
        caseNumber={editingGrouped.caseNumber}
        questions={editingGrouped.questions}
        isOpen={true}
        onOpenChange={(o)=> { if(!o) setEditingGrouped(null); }}
        onSaved={()=> { setEditingGrouped(null); fetchQuestions(); onSaved?.(); }}
      />
    ) : null}
    </>
  );
}
