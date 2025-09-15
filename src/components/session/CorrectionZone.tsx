"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { SessionCorrectionData, SessionCorrectionSubmission } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from '@/components/ui/drawer';
import { Plus, Save, UploadCloud, Table as TableIcon, PenLine, CheckCircle, Loader2, Eye, EyeOff, ClipboardList, Trash2, X, FileText, MinusCircle, XCircle, Link, GripVertical, ChevronUp, ChevronDown, Edit2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { saveCorrection, saveSubmission, getCorrection } from '@/app/actions/correction';

interface CorrectionZoneProps {
  sessionId: string;
  mode: 'admin' | 'maintainer' | 'student';
  onQuestionLink?: (questionId: string, questionNumber?: number) => void;
  pdfLinks?: Array<{
    id: string;
    page: number;
    x: number;
    y: number;
    title: string;
    timestamp: number;
  }>;
  onNavigateToLink?: (linkId: string) => void;
  onUserModeChange?: (isUserMode: boolean) => void;
}

// Empty template
const emptyData: SessionCorrectionData = { tables: [], texts: [], medicalQuestions: [] };

export function CorrectionZone({ sessionId, mode, onQuestionLink, pdfLinks = [], onNavigateToLink, onUserModeChange }: CorrectionZoneProps) {
  const isEditor = mode === 'admin' || mode === 'maintainer';
  const { user } = useAuth();

  // Helper function to find existing link for a question
  const findLinkForQuestion = useCallback((questionTitle: string, questionNumber?: number) => {
    if(!pdfLinks || pdfLinks.length===0) return undefined;
    const norm = (s:string)=> s.toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9 ]/g,'').trim();
    const normalizedTitle = norm(questionTitle||'');
    let candidates = pdfLinks;

    // 1. Prefer exact number match with boundary: "Question {n}" at start
    if(questionNumber){
      const exactPattern = new RegExp(`^\\s*question\\s*${questionNumber}(?:\\b|[^0-9])`, 'i');
      const startMatches = candidates.filter(l=> exactPattern.test(l.title));
      if(startMatches.length===1) return startMatches[0];
      if(startMatches.length>1){
        // If multiple, choose shortest title (least ambiguous)
        return startMatches.sort((a,b)=> a.title.length - b.title.length)[0];
      }
      // Fallback: contains pattern anywhere
      const anywherePattern = new RegExp(`question\\s*${questionNumber}(?:\\b|[^0-9])`, 'i');
      const anyMatches = candidates.filter(l=> anywherePattern.test(l.title));
      if(anyMatches.length===1) return anyMatches[0];
      if(anyMatches.length>1) return anyMatches.sort((a,b)=> a.title.length - b.title.length)[0];
    }

    // 2. Try normalized textual similarity (prefix containment)
    if(normalizedTitle){
      const scored = candidates.map(l=>{
        const ln = norm(l.title);
        let score = 0;
        if(ln===normalizedTitle) score += 100;
        if(ln.startsWith(normalizedTitle)) score += 50;
        if(normalizedTitle && ln.includes(normalizedTitle)) score += 25;
        // small length difference bonus
        score -= Math.abs(ln.length - normalizedTitle.length);
        return {l, score};
      }).filter(x=> x.score>0);
      if(scored.length){
        scored.sort((a,b)=> b.score - a.score);
        return scored[0].l;
      }
    }

    // 3. Fallback: first link (avoid undefined) – but better return undefined so caller can decide
    return undefined;
  }, [pdfLinks]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false); // still used to persist user answers, no scoring
  // showReference: for editors default to true, for students false. In test mode for editors we start hidden like a student.
  const [showReference, setShowReference] = useState(isEditor);
  const [data, setData] = useState<SessionCorrectionData>(emptyData);
  const [userAnswers, setUserAnswers] = useState<SessionCorrectionSubmission['answers']>({ tables: [], texts: [], medicalAnswers: [], clinicalCaseAnswers: [] });
  // Scoring removed – we only persist answers now
  // Manual save helpers - autosave removed
  const [dirty, setDirty] = useState(false);


  // Track validation state
  const [isValidated, setIsValidated] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  // Self-evaluation workflow state
  const [reviewIndex, setReviewIndex] = useState<number | null>(null); // index within pendingSelfEvalIds
  const [pendingSelfEvalIds, setPendingSelfEvalIds] = useState<string[]>([]); // ordered QROC ids
  // Simple per-QROC manual validation (correct / incorrect / partial) replacing old self-eval
  const [qrocEvaluations, setQrocEvaluations] = useState<{ id: string; status: 'correct' | 'incorrect' | 'partial' }[]>([]);
  const setQrocEvaluation = (id: string, status: 'correct' | 'incorrect' | 'partial') => {
    setQrocEvaluations(prev => {
      const existing = prev.find(e => e.id === id);
      if (existing) return prev.map(e => e.id === id ? { ...e, status } : e);
      return [...prev, { id, status }];
    });
  };
  const getQrocEvaluation = (id: string) => qrocEvaluations.find(e => e.id === id);

  // Editor test (user) mode flag
  const [editorTestMode, setEditorTestMode] = useState(false);
  // QCM editing dialog state
  const [editingQcmId, setEditingQcmId] = useState<string | null>(null);
  // Copy-paste dialog state
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteResult, setPasteResult] = useState<string | null>(null);
  
  // Mobile navigation state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  // Sequential user navigation state (index across all questions in user view)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const questionRefs = (globalThis as any).questionRefs || [];
  (globalThis as any).questionRefs = questionRefs;

  const allUserQuestions = () => {
    const meds = (data.medicalQuestions || []).map((q:any)=>({ kind:'medical', parentId:null, q }));
    const clinical = (data.clinicalCases||[]).flatMap((c:any)=> {
      // Include clinical case description as a separate navigation item, then its questions
      const caseDescription = { kind:'clinical-case', parentId:null, q: c }; // The case description itself
      const caseQuestions = (c.questions||[]).map((q:any)=>({ kind:'clinical', parentId:c.id, q }));
      return [caseDescription, ...caseQuestions];
    });
    return [...meds, ...clinical];
  };

  // Editing allowed only in real editor mode (not in simulated user mode)
  const canEdit = isEditor && !editorTestMode;
  const isUserView = !isEditor || editorTestMode; // real student or simulated user mode

  // Auto focus active question input (only in user view, not validated)
  useEffect(()=>{
    if(!isUserView || isValidated) return;
    const list = allUserQuestions();
    if(activeQuestionIndex < 0 || activeQuestionIndex >= list.length) return;
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const ref = questionRefs[activeQuestionIndex];
      if(ref && ref.focus) {
        ref.focus();
        try { 
          // Scroll within the correction zone container instead of the whole page
          const correctionContainer = document.querySelector('.correction-zone-scroll');
          if (correctionContainer && ref.getBoundingClientRect) {
            const containerRect = correctionContainer.getBoundingClientRect();
            const refRect = ref.getBoundingClientRect();
            const scrollTop = refRect.top - containerRect.top + correctionContainer.scrollTop - 100; // Center with offset
            correctionContainer.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
          } else {
            ref.scrollIntoView({ behavior:'smooth', block:'center'});
          }
        } catch(e) {
          console.warn('Scroll error:', e);
        }
      } else {
        // Fallback: try to find any focusable element for this question
        const cur = list[activeQuestionIndex];
        if(cur) {
          let fallbackElement = null;
          if(cur.kind === 'medical') {
            if(cur.q.type === 'qcm') {
              fallbackElement = document.getElementById(`qcm-${cur.q.id}-a`);
            } else {
              fallbackElement = document.querySelector(`textarea[placeholder*="Votre réponse"]`);
            }
          } else if(cur.kind === 'clinical-case') {
            // For clinical case descriptions, find the case description element or any focusable element in the case
            const caseIndex = (data.clinicalCases || []).indexOf(cur.q);
            fallbackElement = document.querySelector(`[data-clinical-case-index="${caseIndex}"]`) || 
                             document.getElementById(`voir-case-${caseIndex}`) ||
                             document.querySelector('.clinical-case-description');
          } else if(cur.kind === 'clinical') {
            if(cur.q.type === 'qcm') {
              fallbackElement = document.getElementById(`clinical-qcm-${cur.q.id}-a`);
            } else {
              fallbackElement = document.querySelector(`textarea[placeholder*="Votre réponse"]`);
            }
          }
          if(fallbackElement && (fallbackElement as any).focus) {
            (fallbackElement as any).focus();
          }
        }
      }
    }, 50);
  },[activeQuestionIndex, isUserView, isValidated, data]);

  // Auto navigate PDF to linked question when changing active question in user mode
  const lastLinkIdRef = useRef<string | null>(null);
  useEffect(()=>{
    if(!isUserView || isValidated) return;
    const list = allUserQuestions();
    if(activeQuestionIndex < 0 || activeQuestionIndex >= list.length) return;
    const cur = list[activeQuestionIndex];
    
    try {
      let targetId = null;
      
      if(cur.kind === 'medical'){
        // Use same logic as the "Voir" button for medical questions
        const questionNumber = cur.q.question?.match(/Question\s*n?°?\s*(\d+)/i)?.[1] ||
                              cur.q.question?.match(/(\d+)/)?.[1] ||
                              ((data.medicalQuestions || []).indexOf(cur.q) + 1).toString();
        const existingLink = findLinkForQuestion(`Question ${questionNumber}`, parseInt(questionNumber));
        targetId = existingLink?.id || null;
      } else if(cur.kind === 'clinical-case'){
        // For clinical case description, programmatically click the case-level "Voir" button
        setTimeout(() => {
          const caseIndex = (data.clinicalCases || []).indexOf(cur.q);
          const caseVoirButton = document.getElementById(`voir-case-${caseIndex}`) as HTMLButtonElement;
          if(caseVoirButton) {
            caseVoirButton.click();
          }
        }, 100);
        return; // Exit early for clinical case descriptions since we're using button clicks
      } else if(cur.kind === 'clinical'){
        // For clinical case questions, programmatically click the "Voir" button
        setTimeout(() => {
          // Find the clinical case and question index
          const clinicalCase = (data.clinicalCases || []).find(c => c.id === cur.parentId);
          if(clinicalCase) {
            const qIndex = clinicalCase.questions.findIndex(q => q.id === cur.q.id);
            const caseIndex = (data.clinicalCases || []).indexOf(clinicalCase);
            
            // Try to find and click the question-specific "Voir" button first
            const questionVoirButton = document.getElementById(`voir-case-${caseIndex}-question-${qIndex}`) as HTMLButtonElement;
            
            if(questionVoirButton) {
              questionVoirButton.click();
            } else {
              // Fallback: click the case-level "Voir" button
              const caseVoirButton = document.getElementById(`voir-case-${caseIndex}`) as HTMLButtonElement;
              if(caseVoirButton) {
                caseVoirButton.click();
              }
            }
          }
        }, 100);
        return; // Exit early for clinical cases since we're using button clicks
      }
      
      // Handle medical questions with direct navigation
      if(targetId && targetId !== lastLinkIdRef.current){
        lastLinkIdRef.current = targetId;
        setTimeout(()=>{ 
          if(onNavigateToLink) {
            onNavigateToLink(targetId);
          }
        }, 80);
      }
    } catch(e){
      console.warn('Auto-navigation error:', e);
    }
  },[activeQuestionIndex, isUserView, isValidated, data, findLinkForQuestion, onNavigateToLink]);

  // Shortcut: 'r' to restart attempt after validation in user view
  useEffect(()=>{
    if(!isUserView) return;
    const handler = (e:KeyboardEvent) => {
      if(e.key.toLowerCase()==='r' && isValidated){
        e.preventDefault();
        resetValidation();
      }
    };
    window.addEventListener('keydown', handler);
    return ()=> window.removeEventListener('keydown', handler);
  },[isUserView, isValidated]);

  const validateButtonRef = useRef<HTMLButtonElement|null>(null);
  const scoreDisplayRef = useRef<HTMLDivElement|null>(null);

  // After validation: removed auto QROC evaluation - user can manually evaluate if needed
  // useEffect(()=>{
  //   if(!isValidated || reviewIndex===null) return;
  //   const handle = (e:KeyboardEvent)=>{
  //     const currentId = pendingSelfEvalIds[reviewIndex];
  //     if(['1','2','3'].includes(e.key)){
  //       setValidationResults((prev:any)=> ({
  //         ...prev,
  //         selfEvaluation: { ...(prev?.selfEvaluation||{}), [currentId]: e.key }
  //       }));
  //     } else if(e.key==='Enter'){
  //       e.preventDefault();
  //       const next = reviewIndex + 1;
  //       if(next < pendingSelfEvalIds.length){
  //         setReviewIndex(next);
  //         setTimeout(()=>{
  //           const el = document.querySelector(`[data-qroc-self='${pendingSelfEvalIds[next]}']`) as HTMLElement | null;
  //           el?.scrollIntoView({behavior:'smooth', block:'center'});
  //         },40);
  //       } else {
  //         setReviewIndex(null);
  //         window.scrollTo({top:0, behavior:'smooth'});
  //       }
  //     }
  //   };
  //   window.addEventListener('keydown', handle);
  //   return ()=> window.removeEventListener('keydown', handle);
  // },[isValidated, reviewIndex, pendingSelfEvalIds]);

  const goToNextQuestion = () => {
    const next = activeQuestionIndex + 1;
    const total = allUserQuestions().length;
    if(next < total){
      setActiveQuestionIndex(next);
    } else {
      // focus validate button
      setTimeout(()=>{
        const btn = validateButtonRef.current || document.getElementById('validate-button') as HTMLButtonElement | null;
        btn?.focus();
      },40);
    }
  };

  const registerQuestionRef = (idx:number) => (el:any) => {
    questionRefs[idx] = el;
  };

  // moved earlier

  // Central dirty marker
  const markDirty = () => setDirty(true);

  // Drag state for DnD
  const [dragState, setDragState] = useState<{ isDragging: boolean; draggedIndex: number | null; draggedType: string | null; dropZoneIndex: number | null; dropZoneType: string | null }>(
    { isDragging: false, draggedIndex: null, draggedType: null, dropZoneIndex: null, dropZoneType: null }
  );

  // Initial load of existing correction (if any)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await getCorrection(sessionId);
        if (!cancelled && result && result.success && result.correction?.data) {
          setData(result.correction.data as any);
          // If there are stored user answers, load them (optional future enhancement)
        }
      } catch (e) {
        console.error('Failed to load correction data', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);
  // Add medical QROC question
  const addMedicalQROCQuestion = () => {
    const questionId = crypto.randomUUID();
    const questionCount = (data.medicalQuestions || []).length + 1;
    setData(d => ({
      ...d,
      medicalQuestions: [
        ...(d.medicalQuestions || []),
        {
          id: questionId,
          questionNumber: questionCount.toString(),
          type: 'qroc',
          question: `Question ${questionCount}: `,
          correctAnswers: [''],
          explanation: ''
        }
      ]
    }));
    markDirty();
    
    // Auto-switch removed for no-tabs mobile (QROC)
  };

  // Placeholder add QCM question (since referenced in buttons). Adjust logic as needed.
  const addMedicalQCMQuestion = () => {
    const questionId = crypto.randomUUID();
    const questionCount = (data.medicalQuestions || []).length + 1;
    setData(d => ({
      ...d,
      medicalQuestions: [
        ...(d.medicalQuestions || []),
        {
          id: questionId,
          questionNumber: questionCount.toString(),
          type: 'qcm',
            question: `Question ${questionCount}: `,
          correctAnswers: [],
          options: ['a) Option A', 'b) Option B', 'c) Option C', 'd) Option D'],
          explanation: ''
        } as any
      ]
    }));
    markDirty();
    
    // Auto-switch removed for no-tabs mobile (QCM)
  };

  // Legacy alias if used elsewhere
  const addMedicalQCM = addMedicalQCMQuestion;

  // Copy-paste parsing functions
  const parseQCMQuestion = (text: string) => {
    const lines = text.trim().split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 3) return null; // Need at least question + 2 options
    
    const questionLine = lines[0];
    const optionLines = lines.slice(1);
    
    // Parse options (a, b, c, d, e)
    const options: {[key: string]: string} = {};
    const availableOptions: string[] = [];
    const correctAnswers: string[] = [];
    
    for (const line of optionLines) {
      // Only support ## marker for correct answers
      const match = line.match(/^([a-e])[.)]\s*(.+?)(\s*##)?$/i);
      if (match) {
        const letter = match[1].toLowerCase();
        let text = match[2].trim();
        const isCorrect = !!match[3]; // ## indicates correct answer
        
        // Clean up text - remove any trailing ## markers that might have been included
        text = text.replace(/##\s*$/g, '').trim();
        
        options[letter] = text;
        availableOptions.push(letter);
        if (isCorrect) {
          correctAnswers.push(letter);
        }
      } else {
        // Try format where ## is at the beginning: ## a) Option text
        const prefixMatch = line.match(/^##\s*([a-e])[.)]\s*(.+)$/i);
        if (prefixMatch) {
          const letter = prefixMatch[1].toLowerCase();
          const text = prefixMatch[2].trim();
          
          options[letter] = text;
          availableOptions.push(letter);
          correctAnswers.push(letter); // If ## prefix exists, it's correct
        }
      }
    }
    
    if (availableOptions.length < 2) return null;
    
    return {
      type: 'qcm' as const,
      question: questionLine,
      options: availableOptions.map(letter => `${letter}) ${options[letter]}`),
      correctAnswers,
      explanation: ''
    };
  };

  const parseQROCQuestion = (text: string) => {
    const lines = text.trim().split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) return null; // Need at least question + answer
    
    const questionLine = lines[0];
    const answerLines = lines.slice(1);
    
    // Look for answers marked with "Réponse:" or similar
    const answers: string[] = [];
    let explanation = '';
    
    for (const line of answerLines) {
      if (line.toLowerCase().startsWith('réponse:') || line.toLowerCase().startsWith('rep:') || line.toLowerCase().startsWith('answer:')) {
        answers.push(line.replace(/^(réponse|rep|answer):\s*/i, '').trim());
      } else if (line.toLowerCase().startsWith('explication:') || line.toLowerCase().startsWith('exp:')) {
        explanation = line.replace(/^(explication|exp):\s*/i, '').trim();
      } else if (!answers.length) {
        // If no "Réponse:" prefix found, treat all lines as answers
        answers.push(line);
      }
    }
    
    return {
      type: 'qroc' as const,
      question: questionLine,
      correctAnswers: answers.length > 0 ? answers : [''],
      explanation
    };
  };

  const parseClinicalCase = (text: string) => {
    const sections = text.trim().split(/\n\s*\n/).filter(section => section.trim());
    if (sections.length < 2) return null; // Need at least case description + 1 question
    
    const caseDescription = sections[0].trim();
    const questionSections = sections.slice(1);
    
    const questions: any[] = [];
    
    for (const section of questionSections) {
      // Try to parse as QCM first
      const qcm = parseQCMQuestion(section);
      if (qcm) {
        questions.push({
          id: crypto.randomUUID(),
          ...qcm
        });
        continue;
      }
      
      // Try to parse as QROC
      const qroc = parseQROCQuestion(section);
      if (qroc) {
        questions.push({
          id: crypto.randomUUID(),
          ...qroc
        });
      }
    }
    
    if (questions.length === 0) return null;
    
    return {
      title: 'Cas Clinique',
      enonce: caseDescription,
      questions
    };
  };

  const handlePasteContent = async () => {
    if (!pasteText.trim()) {
      setPasteResult('Veuillez coller du contenu à analyser.');
      return;
    }
    
    try {
      const text = pasteText.trim();
      let addedQCM = 0;
      let addedQROC = 0;
      let addedCases = 0;
      
      // Split by separators: "---", "===", or multiple empty lines
      const sections = text.split(/\n\s*(?:---+|===+)\s*\n|\n\s*\n\s*\n/).filter(s => s.trim());
      
      for (const section of sections) {
        const cleanSection = section.trim();
        
        // Check for explicit type declarations at the beginning
        const typeMatch = cleanSection.match(/^(QCM|QROC|CAS\s*CLINIQUE)\s*:?\s*\n/i);
        let explicitType = null;
        let contentToProcess = cleanSection;
        
        if (typeMatch) {
          explicitType = typeMatch[1].toLowerCase().replace(/\s+/g, '_');
          contentToProcess = cleanSection.substring(typeMatch[0].length).trim();
        }
        
        // Process based on explicit type or auto-detection
        if (explicitType === 'qcm' || (!explicitType && shouldParseAsQCM(contentToProcess))) {
          const qcm = parseQCMQuestion(contentToProcess);
          if (qcm) {
            const questionId = crypto.randomUUID();
            const questionCount = (data.medicalQuestions || []).length + addedQCM + addedQROC + 1;
            setData(d => ({
              ...d,
              medicalQuestions: [
                ...(d.medicalQuestions || []),
                {
                  id: questionId,
                  questionNumber: questionCount.toString(),
                  ...qcm
                }
              ]
            }));
            addedQCM++;
            continue;
          }
        }
        
        if (explicitType === 'qroc' || (!explicitType && shouldParseAsQROC(contentToProcess))) {
          const qroc = parseQROCQuestion(contentToProcess);
          if (qroc) {
            const questionId = crypto.randomUUID();
            const questionCount = (data.medicalQuestions || []).length + addedQCM + addedQROC + 1;
            setData(d => ({
              ...d,
              medicalQuestions: [
                ...(d.medicalQuestions || []),
                {
                  id: questionId,
                  questionNumber: questionCount.toString(),
                  ...qroc
                }
              ]
            }));
            addedQROC++;
            continue;
          }
        }
        
        if (explicitType === 'cas_clinique' || (!explicitType && shouldParseAsClinicalCase(contentToProcess))) {
          const clinicalCase = parseClinicalCase(contentToProcess);
          if (clinicalCase) {
            const caseId = crypto.randomUUID();
            setData(d => ({
              ...d,
              clinicalCases: [...(d.clinicalCases || []), {
                id: caseId,
                ...clinicalCase
              }]
            }));
            addedCases++;
            continue;
          }
        }
      }
      
      // Build result message
      const results = [];
      if (addedQCM > 0) results.push(`${addedQCM} QCM`);
      if (addedQROC > 0) results.push(`${addedQROC} QROC`);
      if (addedCases > 0) results.push(`${addedCases} Cas Clinique(s)`);
      
      if (results.length > 0) {
        setPasteResult(`✅ Ajouté: ${results.join(', ')}`);
        markDirty();
        
        // Auto-switch to appropriate section on mobile based on what was added
        if (typeof window !== 'undefined' && window.innerWidth < 640) { // sm breakpoint
          if (addedCases > 0) {
            // Auto-switch removed for no-tabs mobile
          } else if (addedQCM > 0 || addedQROC > 0) {
            // Auto-switch removed for no-tabs mobile
          }
        }
        
        setTimeout(() => {
          setShowPasteDialog(false);
          setPasteText('');
          setPasteResult(null);
        }, 2000);
      } else {
        setPasteResult('❌ Aucune question valide détectée. Vérifiez le format et les séparateurs.');
      }
      
    } catch (error) {
      console.error('Parse error:', error);
      setPasteResult('❌ Erreur lors de l\'analyse du contenu');
    }
  };

  // Helper functions for type detection
  const shouldParseAsQCM = (content: string): boolean => {
    return content.includes('##') || /\n\s*[a-e]\)/i.test(content);
  };

  const shouldParseAsQROC = (content: string): boolean => {
    return content.toLowerCase().includes('réponse:');
  };

  const shouldParseAsClinicalCase = (content: string): boolean => {
    const hasMultipleQuestions = (content.match(/(?:Question\s*\d+|^\d+\.|\n\s*[a-e]\)|Réponse\s*:)/gmi) || []).length > 1;
    const hasCasePattern = content.toLowerCase().includes('patient') || 
                           content.toLowerCase().includes('cas') ||
                           content.toLowerCase().includes('histoire') ||
                           hasMultipleQuestions;
    return hasCasePattern && content.includes('\n\n');
  };

  // Update medical question
  const updateMedicalQuestion = (questionId: string, field: string, value: any) => {
    setData(d => ({
      ...d,
      medicalQuestions: (d.medicalQuestions || []).map(q => 
        q.id === questionId ? { ...q, [field]: value } : q
      )
    }));
    markDirty();
  };

  // Manage available options for QCM questions (medical & clinical)
  const getAvailableOptions = (question: any): string[] => {
    return (question as any).availableOptions || ['a', 'b', 'c', 'd', 'e'];
  };

  const updateQuestionById = (d: any, questionId: string, updater: (q: any) => any) => {
    return {
      ...d,
      medicalQuestions: (d.medicalQuestions || []).map((q: any) => q.id === questionId ? updater(q) : q),
      clinicalCases: (d.clinicalCases || []).map((c: any) => ({
        ...c,
        questions: (c.questions || []).map((q: any) => q.id === questionId ? updater(q) : q)
      }))
    };
  };

  const addOption = (questionId: string, optionLetter: string) => {
    setData(d => updateQuestionById(d, questionId, (q: any) => {
      const currentOptions = getAvailableOptions(q);
      if (currentOptions.includes(optionLetter)) return q;
      const newOptions = [...currentOptions, optionLetter].sort((a, b) => a.localeCompare(b));
      return { ...q, availableOptions: newOptions };
    }));
    markDirty();
  };

  const removeOption = (questionId: string, optionLetter: string) => {
    setData(d => updateQuestionById(d, questionId, (q: any) => {
      const currentOptions = getAvailableOptions(q);
      if (!currentOptions.includes(optionLetter)) return q;
      const newOptions = currentOptions.filter((opt: string) => opt !== optionLetter);
      const newCorrectAnswers = (q.correctAnswers || []).filter((ans: string) => ans !== optionLetter);
      return {
        ...q,
        availableOptions: newOptions.length > 0 ? newOptions : ['a'],
        correctAnswers: newCorrectAnswers
      };
    }));
    markDirty();
  };

  // Delete medical question
  const deleteMedicalQuestion = (questionId: string) => {
    setData(d => ({
      ...d,
      medicalQuestions: (d.medicalQuestions || []).filter(q => q.id !== questionId)
    }));
    markDirty();
  };

  // Toggle correct answer for QCM (medical & clinical)
  const toggleCorrectAnswer = (questionId: string, optionLetter: string) => {
    setData(d => updateQuestionById(d, questionId, (q: any) => {
      if (q.type !== 'qcm') return q;
      const currentAnswers = q.correctAnswers || [];
      const isSelected = currentAnswers.includes(optionLetter);
      return {
        ...q,
        correctAnswers: isSelected
          ? currentAnswers.filter((a: string) => a !== optionLetter)
          : [...currentAnswers, optionLetter]
      };
    }));
    markDirty();
  };

  // Clinical case functions
  const addClinicalCase = () => {
    const caseId = crypto.randomUUID();
    setData(d => ({
      ...d,
      clinicalCases: [...(d.clinicalCases || []), {
        id: caseId,
        title: 'Cas Clinique',
        enonce: 'Description du cas clinique...',
        questions: []
      }]
    }));
    markDirty();
    
    // Auto-switch removed for no-tabs mobile (Clinical)
  };

  const updateClinicalCase = (caseId: string, field: 'title' | 'enonce', value: string) => {
    setData(d => ({
      ...d,
      clinicalCases: (d.clinicalCases || []).map(c => 
        c.id === caseId ? { ...c, [field]: value } : c
      )
    }));
    markDirty();
  };

  const deleteClinicalCase = (caseId: string) => {
    setData(d => ({
      ...d,
      clinicalCases: (d.clinicalCases || []).filter(c => c.id !== caseId)
    }));
    markDirty();
  };

  const addQuestionToClinicalCase = (caseId: string, type: 'qcm' | 'qroc') => {
    const questionId = crypto.randomUUID();
    const newQuestion = {
      id: questionId,
      questionNumber: '1',
      type,
      question: '',
      ...(type === 'qcm' ? {
        options: ['a) ', 'b) ', 'c) ', 'd) ', 'e) '], // legacy
        availableOptions: ['a','b','c','d','e'],
        correctAnswers: []
      } : {
        correctAnswers: ['']
      })
    };

    setData(d => ({
      ...d,
      clinicalCases: (d.clinicalCases || []).map(c => 
        c.id === caseId 
          ? { ...c, questions: [...c.questions, newQuestion] }
          : c
      )
    }));
    markDirty();
  };

  const updateClinicalCaseQuestion = (caseId: string, questionId: string, field: string, value: any) => {
    setData(d => ({
      ...d,
      clinicalCases: (d.clinicalCases || []).map(c => 
        c.id === caseId 
          ? {
              ...c,
              questions: c.questions.map(q => 
                q.id === questionId ? { ...q, [field]: value } : q
              )
            }
          : c
      )
    }));
    markDirty();
  };

  const deleteClinicalCaseQuestion = (caseId: string, questionId: string) => {
    setData(d => ({
      ...d,
      clinicalCases: (d.clinicalCases || []).map(c => 
        c.id === caseId 
          ? { ...c, questions: c.questions.filter(q => q.id !== questionId) }
          : c
      )
    }));
    markDirty();
  };

  const toggleClinicalCaseCorrectAnswer = (_caseId: string, questionId: string, optionLetter: string) => {
    // Delegate to unified function (caseId kept for backward compatibility)
    toggleCorrectAnswer(questionId, optionLetter);
  };

  // Validation functions
  const validateAnswers = () => {
    let totalCorrect = 0;
    let totalQuestions = 0;

    // Validate individual medical questions
    const medicalResults = (data.medicalQuestions || []).map(question => {
      const userAnswer = userAnswers.medicalAnswers?.find(a => a.questionId === question.id);
      const correctAnswers = question.correctAnswers || [];
      
      let isCorrect = false;
      let userAnswersList: string[] = [];

      if (question.type === 'qcm') {
        userAnswersList = userAnswer?.selectedOptions || [];
        // For QCM: check if user selected exactly the correct options
        isCorrect = userAnswersList.length === correctAnswers.length &&
                   userAnswersList.every(option => correctAnswers.includes(option)) &&
                   correctAnswers.every(option => userAnswersList.includes(option));
      } else if (question.type === 'qroc') {
        const userText = userAnswer?.textAnswer?.trim().toLowerCase() || '';
        const correctText = correctAnswers[0]?.trim().toLowerCase() || '';
        userAnswersList = [userAnswer?.textAnswer || ''];
        // For QROC: simple text comparison (can be enhanced with fuzzy matching)
        isCorrect = userText === correctText || 
                   (correctText.length > 0 && userText.includes(correctText)) ||
                   (userText.length > 0 && correctText.includes(userText));
      }

      if (isCorrect) totalCorrect++;
      totalQuestions++;

      return {
        questionId: question.id,
        isCorrect,
        userAnswers: userAnswersList,
        correctAnswers
      };
    });

    // Validate clinical case questions
    const clinicalCaseResults = (data.clinicalCases || []).map(clinicalCase => {
      const userCaseAnswers = userAnswers.clinicalCaseAnswers?.find(c => c.caseId === clinicalCase.id);
      
      const questionResults = clinicalCase.questions.map(question => {
        const userQuestionAnswer = userCaseAnswers?.questionAnswers?.find(q => q.questionId === question.id);
        const correctAnswers = question.correctAnswers || [];
        
        let isCorrect = false;
        let userAnswer: string | string[] = [];

        if (question.type === 'qcm') {
          userAnswer = userQuestionAnswer?.selectedOptions || [];
          const userAnswersList = userAnswer as string[];
          // For QCM: check if user selected exactly the correct options
          isCorrect = userAnswersList.length === correctAnswers.length &&
                     userAnswersList.every(option => correctAnswers.includes(option)) &&
                     correctAnswers.every(option => userAnswersList.includes(option));
        } else if (question.type === 'qroc') {
          const userText = userQuestionAnswer?.textAnswer?.trim().toLowerCase() || '';
          const correctText = correctAnswers[0]?.trim().toLowerCase() || '';
          userAnswer = userQuestionAnswer?.textAnswer || '';
          // For QROC: simple text comparison
          isCorrect = userText === correctText || 
                     (correctText.length > 0 && userText.includes(correctText)) ||
                     (userText.length > 0 && correctText.includes(userText));
        }

        if (isCorrect) totalCorrect++;
        totalQuestions++;

        return {
          questionId: question.id,
          isCorrect,
          userAnswer,
          correctAnswer: question.type === 'qcm' ? correctAnswers : correctAnswers[0] || ''
        };
      });

      return {
        caseId: clinicalCase.id,
        questions: questionResults
      };
    });

    const percentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    setValidationResults({
      medicalQuestions: medicalResults,
      clinicalCases: clinicalCaseResults,
      totalScore: {
        correct: totalCorrect,
        total: totalQuestions,
        percentage
      }
    });

  setIsValidated(true);
  // Scroll to the score display section within the correction zone container
  setTimeout(()=>{
    if (scoreDisplayRef.current) {
      // First try to scroll within the correction zone container
      const correctionContainer = document.querySelector('.correction-zone-scroll');
      if (correctionContainer) {
        const containerRect = correctionContainer.getBoundingClientRect();
        const scoreRect = scoreDisplayRef.current.getBoundingClientRect();
        const scrollTop = scoreRect.top - containerRect.top + correctionContainer.scrollTop - 20; // 20px offset
        correctionContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
      } else {
        // Fallback: scroll element into view
        scoreDisplayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      // Final fallback: try to find and scroll to score element by ID
      const scoreElement = document.getElementById('score-display');
      if (scoreElement) {
        const correctionContainer = document.querySelector('.correction-zone-scroll');
        if (correctionContainer) {
          const containerRect = correctionContainer.getBoundingClientRect();
          const scoreRect = scoreElement.getBoundingClientRect();
          const scrollTop = scoreRect.top - containerRect.top + correctionContainer.scrollTop - 20;
          correctionContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
        } else {
          scoreElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  },200); // Increased timeout to ensure DOM is ready
  };

  const resetValidation = () => {
    setIsValidated(false);
    setValidationResults(null);
  // Clear user answers for a fresh attempt in user view
  setUserAnswers({ tables: [], texts: [], medicalAnswers: [], clinicalCaseAnswers: [] });
  setActiveQuestionIndex(0);
  };

  // Delete functions
  const deleteTable = (tableId: string) => {
    setData(d => ({ ...d, tables: d.tables.filter(t => t.id !== tableId) }));
    markDirty();
  };
  const deleteText = (textId: string) => {
    setData(d => ({ ...d, texts: d.texts.filter(t => t.id !== textId) }));
    markDirty();
  };
  const deleteTableColumn = (tableId: string, columnIndex: number) => {
    setData(d => ({ 
      ...d, 
      tables: d.tables.map(t => t.id === tableId ? {
        ...t,
        headers: t.headers.filter((_, i) => i !== columnIndex),
        rows: t.rows.map(r => r.filter((_, i) => i !== columnIndex))
      } : t)
    }));
    markDirty();
  };
  const deleteTableRow = (tableId: string, rowIndex: number) => {
    setData(d => ({ 
      ...d, 
      tables: d.tables.map(t => t.id === tableId ? {
        ...t,
        rows: t.rows.filter((_, i) => i !== rowIndex)
      } : t)
    }));
    markDirty();
  };

  const updateTableHeader = (tableId: string, index: number, value: string) => {
    setData(d => ({ ...d, tables: d.tables.map(t => t.id === tableId ? { ...t, headers: t.headers.map((h,i)=> i===index? value : h), rows: t.rows.map(r => { const copy = [...r]; while (copy.length < t.headers.length) copy.push(''); return copy.slice(0, t.headers.length); }) } : t) }));
    markDirty();
  };
  const addTableColumn = (tableId: string) => {
    setData(d => ({ ...d, tables: d.tables.map(t => t.id === tableId ? { ...t, headers: [...t.headers, `Colonne${t.headers.length+1}`], rows: t.rows.map(r => [...r, '']) } : t) }));
    markDirty();
  };
  const addTableRow = (tableId: string) => {
    setData(d => ({ ...d, tables: d.tables.map(t => t.id === tableId ? { ...t, rows: [...t.rows, new Array(t.headers.length).fill('')] } : t) }));
    markDirty();
  };
  const updateTableCell = (tableId: string, r: number, c: number, value: string, isReference: boolean) => {
    if (isReference) {
      setData(d => ({ ...d, tables: d.tables.map(t => t.id === tableId ? { ...t, rows: t.rows.map((row, ri) => ri===r ? row.map((cell, ci) => ci===c ? value : cell) : row) } : t) }));
    } else {
      setUserAnswers(ans => {
        let table = ans.tables.find(t => t.id === tableId);
        if (!table) { table = { id: tableId, rows: [] }; ans = { ...ans, tables: [...ans.tables, table] }; }
        const rows = [...table.rows];
        if (!rows[r]) rows[r] = [];
        const row = [...rows[r]]; row[c] = value; rows[r] = row;
        const newTables = ans.tables.map(t => t.id === tableId ? { ...t, rows } : t);
        return { ...ans, tables: newTables };
      });
    }
    markDirty();
  };

  const updateTextReference = (id: string, value: string) => {
    setData(d => ({ ...d, texts: d.texts.map(t => t.id === id ? { ...t, reference: value } : t) }));
    markDirty();
  };
  const updateTextAnswer = (id: string, value: string) => {
    setUserAnswers(a => {
      const existing = a.texts.find(t => t.id === id);
      if (existing) {
        return { ...a, texts: a.texts.map(t => t.id === id ? { ...t, answer: value } : t) };
      }
      return { ...a, texts: [...a.texts, { id, answer: value }] };
    });
    markDirty();
  };

  const saveCorrectionData = async () => {
    try {
      setSaving(true);
      const result = await saveCorrection(sessionId, data);
      if (result.success) {
        setDirty(false);
      } else {
        console.error('Save failed:', result.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save user answers for all users
  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        const result = await saveSubmission(sessionId, userAnswers);
        if (!result.success) {
          console.error('Auto-save submission failed:', result.error);
        }
      } catch (e) {
        console.error('Auto-save submission failed', e);
      }
    }, 1500);
    return () => clearTimeout(handle);
  }, [userAnswers, sessionId]);

  // Prevent page navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty && canEdit) {
        e.preventDefault();
        e.returnValue = 'Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir quitter ?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty, canEdit]);

  // Manual save for submissions
  const saveUserSubmission = async () => {
    try {
      setSaving(true);
      const result = await saveSubmission(sessionId, userAnswers);
      if (!result.success) {
        console.error('Save submission failed:', result.error);
      }
    } catch (e) {
      console.error('Save submission error:', e);
    } finally {
      setSaving(false);
    }
  };

  // Toggle editor test mode
  const toggleEditorTestMode = () => {
    // Check for unsaved changes before allowing mode switch
    if (dirty && !editorTestMode) {
      // Trying to enter user mode with unsaved changes
      const confirmSwitch = window.confirm(
        'Vous avez des modifications non sauvegardées. Voulez-vous sauvegarder avant de passer en mode utilisateur ?'
      );
      if (confirmSwitch) {
        // Auto-save before switching
        saveCorrectionData().then(() => {
          performModeSwitch();
        });
        return;
      } else {
        // Don't switch if user cancelled
        return;
      }
    }
    
    performModeSwitch();
  };

  const performModeSwitch = () => {
    setEditorTestMode(m => {
      const next = !m;
      // entering test mode => hide reference (student initial state). Exiting => show reference.
      if (next) {
        setShowReference(false);
      } else {
        setShowReference(true);
      }
      // Notify parent about user mode change
      onUserModeChange?.(next);
      return next;
    });
  };

  // Notify parent about initial user mode state
  useEffect(() => {
    onUserModeChange?.(editorTestMode);
  }, [editorTestMode, onUserModeChange]);

  // Global reordering system - allows moving items across different types
  const getAllItemsWithOrder = () => {
    const items: Array<{
      type: 'medical' | 'clinical' | 'text',
      index: number,
      item: any,
      order: number
    }> = [];

    // Add medical questions
    (data.medicalQuestions || []).forEach((question, index) => {
      items.push({
        type: 'medical',
        index,
        item: question,
        order: index * 1000 // Use index-based ordering
      });
    });

    // Add clinical cases
    (data.clinicalCases || []).forEach((clinicalCase, index) => {
      items.push({
        type: 'clinical',
        index,
        item: clinicalCase,
        order: (data.medicalQuestions?.length || 0) * 1000 + index * 1000
      });
    });

    // Add text blocks
    data.texts.forEach((text, index) => {
      items.push({
        type: 'text',
        index,
        item: text,
        order: ((data.medicalQuestions?.length || 0) + (data.clinicalCases?.length || 0)) * 1000 + index * 1000
      });
    });

    return items.sort((a, b) => a.order - b.order);
  };

  const reorderGlobally = (fromType: 'medical' | 'clinical' | 'text', fromIndex: number, toType: 'medical' | 'clinical' | 'text', toIndex: number) => {
    if (fromType === toType) {
      // Same type reordering
      if (fromType === 'medical') {
        reorderMedicalQuestions(fromIndex, toIndex);
      } else if (fromType === 'clinical') {
        reorderClinicalCases(fromIndex, toIndex);
      } else if (fromType === 'text') {
        reorderTexts(fromIndex, toIndex);
      }
      return;
    }

    // Cross-type reordering - move item from one array to another
    setData(d => {
      let itemToMove: any;
      
      // Remove item from source array
      if (fromType === 'medical') {
        itemToMove = (d.medicalQuestions || [])[fromIndex];
        d = {
          ...d,
          medicalQuestions: (d.medicalQuestions || []).filter((_, idx) => idx !== fromIndex)
        };
      } else if (fromType === 'clinical') {
        itemToMove = (d.clinicalCases || [])[fromIndex];
        d = {
          ...d,
          clinicalCases: (d.clinicalCases || []).filter((_, idx) => idx !== fromIndex)
        };
      } else if (fromType === 'text') {
        itemToMove = d.texts[fromIndex];
        d = {
          ...d,
          texts: d.texts.filter((_, idx) => idx !== fromIndex)
        };
      }

      // Convert item type if necessary and add to target array
      if (toType === 'medical') {
        const newMedicalQuestions = [...(d.medicalQuestions || [])];
        // Convert to medical question format
        const convertedItem = {
          id: itemToMove.id,
          questionNumber: `Q${newMedicalQuestions.length + 1}`,
          type: 'qcm' as const,
          question: fromType === 'clinical' ? itemToMove.title : itemToMove.title || itemToMove.question || 'New Question',
          options: ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'],
          correctAnswers: ['a'],
          explanation: fromType === 'text' ? itemToMove.reference : ''
        };
        newMedicalQuestions.splice(toIndex, 0, convertedItem);
        return { ...d, medicalQuestions: newMedicalQuestions };
      } else if (toType === 'clinical') {
        const newClinicalCases = [...(d.clinicalCases || [])];
        // Convert to clinical case format
        const convertedItem = {
          id: itemToMove.id,
          title: fromType === 'medical' ? itemToMove.question : itemToMove.title || 'New Clinical Case',
          enonce: fromType === 'text' ? itemToMove.reference : fromType === 'medical' ? itemToMove.explanation || '' : itemToMove.enonce || '',
          questions: []
        };
        newClinicalCases.splice(toIndex, 0, convertedItem);
        return { ...d, clinicalCases: newClinicalCases };
      } else if (toType === 'text') {
        const newTexts = [...d.texts];
        // Convert to text format
        const convertedItem = {
          id: itemToMove.id,
          title: fromType === 'medical' ? itemToMove.question : itemToMove.title || 'New Text Block',
          reference: fromType === 'medical' ? itemToMove.explanation || '' : fromType === 'clinical' ? itemToMove.enonce || '' : itemToMove.reference
        };
        newTexts.splice(toIndex, 0, convertedItem);
        return { ...d, texts: newTexts };
      }

      return d;
    });
    markDirty();
  };

  // Reorder functions for questions (keep for same-type reordering)
  const reorderMedicalQuestions = (fromIndex: number, toIndex: number) => {
    setData(d => {
      const newQuestions = [...(d.medicalQuestions || [])];
      const [movedQuestion] = newQuestions.splice(fromIndex, 1);
      newQuestions.splice(toIndex, 0, movedQuestion);
      return { ...d, medicalQuestions: newQuestions };
    });
    markDirty();
  };

  const reorderClinicalCases = (fromIndex: number, toIndex: number) => {
    setData(d => {
      const newCases = [...(d.clinicalCases || [])];
      const [movedCase] = newCases.splice(fromIndex, 1);
      newCases.splice(toIndex, 0, movedCase);
      return { ...d, clinicalCases: newCases };
    });
    markDirty();
  };

  const reorderTexts = (fromIndex: number, toIndex: number) => {
    setData(d => {
      const newTexts = [...d.texts];
      const [movedText] = newTexts.splice(fromIndex, 1);
      newTexts.splice(toIndex, 0, movedText);
      return { ...d, texts: newTexts };
    });
    markDirty();
  };

  // Drag and drop handlers with visual feedback
  const handleDragStart = (e: React.DragEvent, index: number, type: 'medical' | 'clinical' | 'text') => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ index, type }));
    e.dataTransfer.effectAllowed = 'move';
    setDragState({
      isDragging: true,
      draggedIndex: index,
      draggedType: type,
      dropZoneIndex: -1,
      dropZoneType: null
    });
  };

  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      draggedIndex: -1,
      draggedType: null,
      dropZoneIndex: -1,
      dropZoneType: null
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, targetIndex: number, targetType: 'medical' | 'clinical' | 'text') => {
    e.preventDefault();
    // Allow dropping on any type (remove the type restriction)
    setDragState(prev => ({ ...prev, dropZoneIndex: targetIndex, dropZoneType: targetType }));
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number, targetType: 'medical' | 'clinical' | 'text') => {
    e.preventDefault();
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (dragData.index !== targetIndex || dragData.type !== targetType) {
        reorderGlobally(dragData.type, dragData.index, targetType, targetIndex);
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
    handleDragEnd();
  };

  // Arrow button functions for reordering
  const moveUp = (index: number, type: 'medical' | 'clinical' | 'text') => {
    if (index > 0) {
      if (type === 'medical') {
        reorderMedicalQuestions(index, index - 1);
      } else if (type === 'clinical') {
        reorderClinicalCases(index, index - 1);
      } else if (type === 'text') {
        reorderTexts(index, index - 1);
      }
    }
  };

  const moveDown = (index: number, type: 'medical' | 'clinical' | 'text', totalLength: number) => {
    if (index < totalLength - 1) {
      if (type === 'medical') {
        reorderMedicalQuestions(index, index + 1);
      } else if (type === 'clinical') {
        reorderClinicalCases(index, index + 1);
      } else if (type === 'text') {
        reorderTexts(index, index + 1);
      }
    }
  };

  const submitAnswers = async () => {
    try {
      setSubmitting(true);
      await fetch(`/api/sessions/${sessionId}/correction`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: userAnswers }) });
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 w-full max-w-none sm:max-w-4xl mx-auto h-full px-2 sm:px-0">
      {/* Mobile Floating Action Button for Zone de Correction */}
      <div className="block sm:hidden">
        <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <DrawerTrigger asChild>
            <div className="fixed bottom-6 right-6 z-50">
              <Button 
                size="lg"
                className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-white/20"
              >
                <CheckCircle className="h-6 w-6" />
                <span className="sr-only">Zone de Correction</span>
              </Button>
              {/* Counter Badge */}
              {((data.tables?.length || 0) + (data.medicalQuestions?.length || 0) + (data.clinicalCases?.length || 0)) > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold border-2 border-white">
                  {(data.tables?.length || 0) + (data.medicalQuestions?.length || 0) + (data.clinicalCases?.length || 0)}
                </div>
              )}
            </div>
          </DrawerTrigger>
          <DrawerContent className="h-[85vh]">
            <DrawerHeader className="border-b">
              <div className="flex items-center justify-between">
                <DrawerTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Zone de Correction
                </DrawerTitle>
                <DrawerClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Fermer</span>
                </DrawerClose>
              </div>
            </DrawerHeader>
            
            {/* Mobile Content in Drawer - All content shown like desktop */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Tables Section */}
              {data.tables.map(table => {
                const userTable = userAnswers.tables.find(t => t.id === table.id);
                
                return (
                  <Card key={table.id} className="border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm">
                    <CardHeader className="pb-3 space-y-3 px-4">
                      <div className="flex flex-col gap-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <span className="truncate">
                            {(() => {
                              const raw = (table.title || '').trim();
                              const cleaned = raw.replace(/^(question\s+n?°?\s*\d+\s*[:.)\-]\s*)/i, '').trim();
                              if (cleaned) return cleaned;
                              if (raw) return raw;
                              const tableIndex = data.tables.findIndex(t => t.id === table.id);
                              return `QCM ${tableIndex + 1}`;
                            })()}
                          </span>
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4 px-4">
                      <div className="space-y-3">
                        {table.headers && table.headers.length > 0 && (
                          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${table.headers.length}, 1fr)` }}>
                            {table.headers.map((header, index) => (
                              <div key={index} className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs font-medium text-blue-800 dark:text-blue-200 text-center">
                                {header}
                              </div>
                            ))}
                          </div>
                        )}
                        {table.rows && table.rows.map((row, rowIndex) => (
                          <div key={rowIndex} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${table.headers?.length || row.length}, 1fr)` }}>
                            {row.map((cell, cellIndex) => {
                              const userVal = userTable?.rows?.[rowIndex]?.[cellIndex] || '';
                              const displayVal = userVal || cell;
                              
                              return (
                                <div key={cellIndex} className="p-2 border border-gray-200 dark:border-gray-600 rounded text-xs bg-white/50 dark:bg-gray-800/30">
                                  <div className="text-gray-800 dark:text-gray-200 min-h-[1.5rem] flex items-center">
                                    {displayVal}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* Medical Questions Section */}
              {(data.medicalQuestions || []).map((question, index) => {
                const userMedical = userAnswers.medicalAnswers?.find((ans: any) => ans.questionId === question.id);
                
                return (
                  <Card key={question.id} className="border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm">
                    <CardHeader className="pb-2 px-4">
                      <div className="flex items-center gap-2">
                        {question.type === 'qcm' ? (
                          <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        ) : (
                          <PenLine className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        )}
                        <div className="text-sm font-medium text-blue-100/90 dark:text-blue-200/90 bg-blue-900/20 border border-transparent rounded-md px-3 py-1.5 leading-snug">
                          {(() => {
                            const raw = (question.question || '').trim();
                            const cleaned = raw.replace(/^(question\s+n?°?\s*\d+\s*[:.)\-]\s*)/i, '').trim();
                            if (cleaned) return cleaned;
                            if (raw) return raw;
                            return `Question ${index + 1}`;
                          })()}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 px-4">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        {question.type === 'qcm' ? 'Question à choix multiples' : 'Question à réponse ouverte courte'}
                      </div>
                      
                      {/* Show options for QCM or answer field for QROC */}
                      {question.type === 'qcm' && question.options && Array.isArray(question.options) && question.options.length > 0 && (
                        <div className="space-y-2">
                          {question.options.map((option, optIndex) => {
                            const optionKey = String.fromCharCode(97 + optIndex); // a, b, c, d...
                            const isSelected = userMedical?.selectedOptions?.includes(optionKey);
                            
                            return (
                              <div key={optIndex} className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs font-medium ${
                                  isSelected ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300'
                                }`}>
                                  {optionKey}
                                </div>
                                <span className="text-sm">{option}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Fallback for QCM with invalid options */}
                      {question.type === 'qcm' && question.options && !Array.isArray(question.options) && (
                        <div className="text-sm text-gray-500 italic">
                          Options de réponse non disponibles
                        </div>
                      )}
                      
                      {question.type === 'qroc' && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-500 mb-1">Réponse:</div>
                          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                            {userMedical?.textAnswer || 'Aucune réponse'}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* Clinical Cases Section */}
              {(data.clinicalCases || []).map((clinicalCase, index) => {
                const userClinical = userAnswers.clinicalCaseAnswers?.find((ans: any) => ans.caseId === clinicalCase.id);
                
                return (
                  <Card key={clinicalCase.id} className="border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm">
                    <CardHeader className="pb-2 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <div className="text-sm font-medium text-purple-100/90 dark:text-purple-200/90 bg-purple-900/20 border border-transparent rounded-md px-3 py-1.5 leading-snug">
                          {clinicalCase.title || `Cas Clinique ${index + 1}`}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 px-4">
                      <div className="space-y-3">
                        {clinicalCase.enonce && (
                          <div className="text-sm bg-purple-50 dark:bg-purple-900/20 p-3 rounded border">
                            {clinicalCase.enonce}
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Cas clinique avec {clinicalCase.questions?.length || 0} question(s)
                        </div>
                        
                        {/* Show questions in clinical case */}
                        {clinicalCase.questions && clinicalCase.questions.map((caseQuestion, qIndex) => {
                          const userCaseAnswer = userClinical?.questionAnswers?.find((ans: any) => ans.questionId === caseQuestion.id);
                          
                          return (
                            <div key={qIndex} className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
                              <div className="text-sm font-medium mb-2">
                                Question {qIndex + 1}: {caseQuestion.question}
                              </div>
                              {caseQuestion.type === 'qcm' && caseQuestion.options && Array.isArray(caseQuestion.options) && caseQuestion.options.length > 0 && (
                                <div className="space-y-1">
                                  {caseQuestion.options.map((option, optIndex) => {
                                    const optionKey = String.fromCharCode(97 + optIndex);
                                    const isSelected = userCaseAnswer?.selectedOptions?.includes(optionKey);
                                    
                                    return (
                                      <div key={optIndex} className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs font-medium ${
                                          isSelected ? 'bg-purple-100 border-purple-500 text-purple-700' : 'border-gray-300'
                                        }`}>
                                          {optionKey}
                                        </div>
                                        <span className="text-xs">{option}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {/* Fallback for QCM with invalid options */}
                              {caseQuestion.type === 'qcm' && caseQuestion.options && !Array.isArray(caseQuestion.options) && (
                                <div className="text-xs text-gray-500 italic">
                                  Options de réponse non disponibles
                                </div>
                              )}
                              {caseQuestion.type === 'qroc' && (
                                <div className="mt-2">
                                  <div className="text-xs text-gray-500 mb-1">Réponse:</div>
                                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-xs">
                                    {userCaseAnswer?.textAnswer || 'Aucune réponse'}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Tables - Desktop Only */}
      <div className="hidden sm:block">
      {data.tables.map(table => {
        const userTable = userAnswers.tables.find(t => t.id === table.id);
        return (
          <Card key={table.id} className="border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="pb-3 space-y-3 px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100 min-w-0 flex-1">
                  <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <Input
                    value={table.title || ''}
          disabled={!canEdit}
                    onChange={e => setData(d => ({ ...d, tables: d.tables.map(t => t.id === table.id ? { ...t, title: e.target.value } : t) }))}
                    placeholder="Titre du QCM"
                    className="h-8 min-w-0 flex-1 max-w-sm bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  />
                </CardTitle>
                <div className="flex items-center gap-2">
                  {(() => {
                    const qcmTitle = `QCM-${data.tables.indexOf(table) + 1}`;
                    const existingLink = findLinkForQuestion(qcmTitle);
                    
                    return (
                      <>
                        {/* View button visible to students and editor in user mode */}
                        {existingLink && onNavigateToLink && (!isEditor || editorTestMode) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onNavigateToLink(existingLink.id)}
                            className="gap-1 text-xs border-green-300 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex-shrink-0"
                          >
                            <Eye className="h-3 w-3" />
                            Voir
                          </Button>
                        )}
                        {/* Creation button only for editors outside user mode */}
                        {!existingLink && !editorTestMode && isEditor && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onQuestionLink?.(qcmTitle)}
                            className="gap-1 text-xs border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex-shrink-0"
                          >
                            <Link className="h-3 w-3" />
                            Lien
                          </Button>
                        )}
                      </>
                    );
                  })()}
        {canEdit && (
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => addTableColumn(table.id)} className="gap-1 text-xs bg-white/70 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600">
                        <Plus className="h-3 w-3" />
                        Colonne
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => addTableRow(table.id)} className="gap-1 text-xs bg-white/70 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600">
                        <Plus className="h-3 w-3" />
                        Ligne
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteTable(table.id)} className="gap-1 text-xs bg-red-500 hover:bg-red-600 text-white">
                        <Trash2 className="h-3 w-3" />
                        Supprimer
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-w-full">
                <div className="p-4 min-w-max">
                  <table className="table-auto text-sm border-collapse">
                    <thead>
                      <tr>
                        {canEdit && <th className="border border-gray-300 dark:border-gray-600 w-8 bg-gray-100 dark:bg-gray-800/50"></th>}
                        {table.headers.map((h,i) => (
                          <th key={i} className="border border-gray-300 dark:border-gray-600 px-2 py-2 bg-gray-100 dark:bg-gray-800/50 min-w-[80px] max-w-[150px] w-auto relative">
              {canEdit ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <Input 
                                    value={h} 
                                    onChange={e => updateTableHeader(table.id, i, e.target.value)}
                                    className="h-7 text-xs bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500 min-w-0 flex-1" 
                                    placeholder="En-tête"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteTableColumn(table.id, i)}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Supprimer cette colonne"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <span className="font-medium text-gray-900 dark:text-gray-100 text-center block text-xs">{h}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
            {table.rows.map((row, ri) => (
                        <tr key={ri}>
              {canEdit && (
                            <td className="border border-gray-300 dark:border-gray-600 w-8 bg-gray-100 dark:bg-gray-800/50 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTableRow(table.id, ri)}
                                className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                                title="Supprimer cette ligne"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </td>
                          )}
                          {row.map((cell, ci) => {
                            const headerLabel = table.headers[ci] || '';
                            const isQuestionCol = ci === 0 || /question/i.test(headerLabel);
                            const userVal = userTable?.rows?.[ri]?.[ci] || '';
            const showRef = showReference || canEdit;
                            // For students: Question column always shows reference (cell) and is locked.
                            if ((!isEditor || editorTestMode) && isQuestionCol) {
                              return (
                                <td key={ci} className="border border-gray-300 dark:border-gray-600 px-1 py-1 align-top bg-white/70 dark:bg-gray-800/40 min-w-[140px] max-w-[240px] w-auto">
                                  <div className="text-[11px] sm:text-xs text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                                    {cell || ''}
                                  </div>
                                </td>
                              );
                            }
            const isEditable = canEdit || !showRef; // unchanged logic for other columns
                            const displayVal = showRef ? cell : userVal;
                            // Highlight correctness only for students/test mode when reference is shown and not a question column
                            const shouldEvaluate = showRef && !canEdit && !isQuestionCol;
                            const normalize = (v: string) => v.trim().toLowerCase();
                            const isCorrect = shouldEvaluate && userVal !== '' && normalize(userVal) === normalize(cell);
                            const isIncorrect = shouldEvaluate && userVal !== '' && !isCorrect && cell.trim() !== '';
                            const highlightClasses = isCorrect
                              ? 'bg-success/10 border-success/40'
                              : isIncorrect
                                ? 'bg-destructive/10 border-destructive/40'
                                : 'bg-card/60';
                            return (
                              <td
                                key={ci}
                                className={cn(
                                  'border px-1 py-1 align-top min-w-[80px] max-w-[150px] w-auto',
                                  highlightClasses,
                                  // keep original border color fallback when no correctness highlight
                                  !isCorrect && !isIncorrect && 'border-border'
                                )}
                              >
                                <Input
                                  value={isEditable ? (showRef ? (canEdit ? cell : userVal) : userVal) : displayVal}
                                  readOnly={!isEditable}
                                  onChange={e => updateTableCell(table.id, ri, ci, e.target.value, showRef && canEdit)}
                                  className="h-7 text-xs bg-white/80 dark:bg-gray-800/50 border-0 focus:ring-1 focus:ring-blue-500 w-full min-w-0"
                                  placeholder={isEditor ? (isQuestionCol ? 'Question' : 'Valeur') : 'Votre réponse'}
                                />
                                {shouldEvaluate && (
                                  <div className={cn('mt-1 text-[10px] leading-tight', isCorrect ? 'text-success' : isIncorrect ? 'text-destructive' : 'text-muted-foreground/70')}> 
                                    {isCorrect ? 'Correct' : isIncorrect ? 'Incorrect' : (userVal ? 'Référence affichée' : 'Aucune réponse')}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      </div>

      {/* Global drop zone at the beginning for cross-type drops */}
      {dragState.isDragging && (data.medicalQuestions || []).length === 0 && ((data.clinicalCases || []).length > 0 || data.texts.length > 0) && (
        <div 
          className="h-4 border-2 border-dashed border-gray-300 rounded my-4 opacity-50 hover:opacity-75 transition-opacity cursor-pointer"
          onDragOver={handleDragOver}
          onDragEnter={(e) => {
            if ((data.clinicalCases || []).length > 0) {
              handleDragEnter(e, 0, 'clinical');
            } else if (data.texts.length > 0) {
              handleDragEnter(e, 0, 'text');
            }
          }}
          onDrop={(e) => {
            if ((data.clinicalCases || []).length > 0) {
              handleDrop(e, 0, 'clinical');
            } else if (data.texts.length > 0) {
              handleDrop(e, 0, 'text');
            }
          }}
        >
          <div className="h-full bg-gray-200 rounded flex items-center justify-center">
            <span className="text-xs text-gray-500">Drop here to place at the beginning</span>
          </div>
        </div>
      )}

      {/* Medical Questions - Desktop Only */}
      <div className="hidden sm:block">
      {(data.medicalQuestions || []).map((question, index) => (
        <div key={question.id}>
          {/* Drop zone indicator at the top */}
          {dragState.isDragging && 
           dragState.dropZoneIndex === index && (
            <div className={`h-2 border-2 border-dashed rounded mb-2 opacity-75 ${
              dragState.draggedType === 'medical' ? 'bg-blue-400 border-blue-500' :
              dragState.draggedType === 'clinical' ? 'bg-purple-400 border-purple-500' :
              'bg-green-400 border-green-500'
            }`}>
              <div className={`h-full rounded animate-pulse ${
                dragState.draggedType === 'medical' ? 'bg-blue-500' :
                dragState.draggedType === 'clinical' ? 'bg-purple-500' :
                'bg-green-500'
              }`}></div>
            </div>
          )}
          
          <Card 
            className={`border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm transition-all duration-200 hover:shadow-md ${
              dragState.isDragging && dragState.draggedIndex === index && dragState.draggedType === 'medical'
                ? 'opacity-50 border-blue-400 transform rotate-1' 
                : ''
            }`}
            draggable={canEdit}
            onDragStart={(e) => handleDragStart(e, index, 'medical')}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, index, 'medical')}
            onDrop={(e) => handleDrop(e, index, 'medical')}
          >
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-4 md:px-6">
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  {canEdit && (
                    <div className="flex flex-col items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      <button
                        onClick={() => moveUp(index, 'medical')}
                        disabled={index === 0}
                        className={`p-0.5 sm:p-1 rounded hover:bg-gray-100 transition-colors ${
                          index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:text-blue-600'
                        }`}
                        title="Move up"
                      >
                        <ChevronUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      </button>
                      
                      <div className="cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
                      </div>
                      
                      <button
                        onClick={() => moveDown(index, 'medical', (data.medicalQuestions || []).length)}
                        disabled={index === ((data.medicalQuestions || []).length - 1)}
                        className={`p-0.5 sm:p-1 rounded hover:bg-gray-100 transition-colors ${
                          index === ((data.medicalQuestions || []).length - 1) ? 'opacity-30 cursor-not-allowed' : 'hover:text-blue-600'
                        }`}
                        title="Move down"
                      >
                        <ChevronDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      </button>
                    </div>
                  )}
                  {question.type === 'qcm' ? (
                    <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  ) : (
                    <PenLine className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  )}
                  {canEdit ? (
                    <Input
                      value={question.question}
                      onChange={e => updateMedicalQuestion(question.id, 'question', e.target.value)}
                      placeholder="Énoncé de la question..."
                      className="h-7 sm:h-8 flex-1 text-xs sm:text-sm bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="flex-1 text-xs sm:text-sm md:text-base font-medium text-blue-100/90 dark:text-blue-200/90 bg-blue-900/20 border border-transparent rounded-md px-2 sm:px-3 py-1 sm:py-1.5 leading-snug select-text">
                      {(() => {
                        const raw = (question.question || '').trim();
                        // Only remove very specific question prefixes like "Question 1:", "Question n°1:", etc.
                        const cleaned = raw.replace(/^(question\s+n?°?\s*\d+\s*[:.)\-]\s*)/i, '').trim();
                        if (cleaned) return cleaned;
                        if (raw) return raw;
                        // Generate automatic question number as fallback
                        const questionIndex = (data.medicalQuestions || []).findIndex(q => q.id === question.id);
                        return `Question ${questionIndex + 1}`;
                      })()}
                    </div>
                  )}
                </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {(() => {
                  const questionNumber = question.question.match(/Question\s*n?°?\s*(\d+)/i)?.[1] ||
                                       question.question.match(/(\d+)/)?.[1] ||
                                       ((data.medicalQuestions || []).indexOf(question) + 1).toString();
                  const existingLink = findLinkForQuestion(`Question ${questionNumber}`, parseInt(questionNumber));

                  return (
                    <>
                      {/* View button visible in user mode and for real students when link exists */}
                      {existingLink && onNavigateToLink && (!isEditor || editorTestMode) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onNavigateToLink(existingLink.id)}
                          className="gap-1 text-[10px] sm:text-xs border-green-300 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex-shrink-0 px-2 sm:px-3"
                        >
                          <Eye className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <span className="hidden sm:inline">Voir</span>
                        </Button>
                      )}
                      {/* Link creation only when editor not in user mode */}
                      {!existingLink && isEditor && !editorTestMode && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onQuestionLink?.(question.id, parseInt(questionNumber))}
                          className="gap-1 text-[10px] sm:text-xs border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 flex-shrink-0 px-2 sm:px-3"
                        >
                          <FileText className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <span className="hidden sm:inline">Link</span>
                        </Button>
                      )}
                    </>
                  );
                })()}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMedicalQuestion(question.id)}
                    className="gap-1 text-[10px] sm:text-xs bg-red-500 hover:bg-red-600 text-white flex-shrink-0 px-2 sm:px-3"
                  >
                    <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    <span className="hidden sm:inline">Supprimer</span>
                  </Button>
                )}
              </div>
              {canEdit && editorTestMode && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMedicalQuestion(question.id)}
                  className="gap-1 text-[10px] sm:text-xs bg-red-500 hover:bg-red-600 text-white flex-shrink-0 px-2 sm:px-3"
                >
                  <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  <span className="hidden sm:inline">Supprimer</span>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-4 md:px-6">
            {/* QCM Options and Answers Grid */}
            {question.type === 'qcm' && (
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    {canEdit ? 'Options et réponses correctes' : 'Sélectionnez vos réponses'}
                  </label>
                  {canEdit && (
                    <button
                      onClick={() => setEditingQcmId(question.id)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                    >
                      <Edit2 className="h-3 w-3" />
                      Modifier
                    </button>
                  )}
                </div>
                
                {/* Compact two-row flexible layout (only active options) */}
                <div className="border-2 border-orange-400 rounded-lg p-3 bg-gray-50/30 dark:bg-gray-800/20">
                  {(() => {
                    const availableOptions = getAvailableOptions(question);
                    return (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {availableOptions.map(letter => (
                            <div key={letter} className="h-9 flex-1 px-2 border-2 border-orange-400 rounded flex items-center justify-center bg-gray-800 dark:bg-gray-900">
                              <span className="text-orange-400 font-bold text-lg leading-none select-none">{letter}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          {availableOptions.map(letter => {
                            const isCorrect = (question.correctAnswers || []).includes(letter);
                            const userSelected = userAnswers.medicalAnswers?.find(a => a.questionId === question.id)?.selectedOptions?.includes(letter) || false;
                            return (
                              <div key={`ans-${letter}`} className="h-9 flex-1 px-2 border-2 border-orange-400 rounded flex items-center justify-center bg-white dark:bg-gray-800">
                                {canEdit ? (
                                  <input
                                    type="checkbox"
                                    checked={isCorrect}
                                    onChange={() => toggleCorrectAnswer(question.id, letter)}
                                    className="w-6 h-6 rounded border-2 border-orange-400 text-orange-500 focus:ring-orange-500 focus:ring-2"
                                  />
                                ) : isValidated ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    {userSelected && isCorrect ? (
                                      <div className="w-6 h-6 bg-green-500 rounded border-2 border-green-600 flex items-center justify-center">
                                        <CheckCircle className="h-4 w-4 text-white" />
                                      </div>
                                    ) : userSelected && !isCorrect ? (
                                      <div className="w-6 h-6 bg-red-500 rounded border-2 border-red-600 flex items-center justify-center">
                                        <X className="h-4 w-4 text-white" />
                                      </div>
                                    ) : !userSelected && isCorrect ? (
                                      <div className="w-6 h-6 bg-yellow-500 rounded border-2 border-yellow-600 flex items-center justify-center">
                                        <span className="text-white font-bold text-xs">!</span>
                                      </div>
                                    ) : (
                                      <div className="w-6 h-6 bg-gray-300 rounded border-2 border-gray-400" />
                                    )}
                                  </div>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={userSelected}
                                    onKeyDown={e=>{
                                      const opts = availableOptions;
                                      if(/^[1-9]$/.test(e.key)){
                                        const idx = parseInt(e.key,10)-1;
                                        if(idx < opts.length){
                                          const targetLetter = opts[idx];
                                          if(targetLetter !== letter){
                                            const targetEl = document.getElementById(`qcm-${question.id}-${targetLetter}`) as HTMLInputElement | null;
                                            targetEl?.focus();
                                            targetEl?.click();
                                          } else {
                                            (e.target as HTMLInputElement).click();
                                          }
                                          e.preventDefault();
                                          return;
                                        }
                                      }
                                      if(e.key==='Enter'){ e.preventDefault(); goToNextQuestion(); }
                                      if(e.key===' '){ e.preventDefault(); (e.target as HTMLInputElement).click(); }
                                      if(['ArrowRight','ArrowLeft'].includes(e.key)){
                                        const curIdx = opts.indexOf(letter); const delta = e.key==='ArrowRight'?1:-1; const n = opts[curIdx+delta]; if(n){ const nextEl = document.getElementById(`qcm-${question.id}-${n}`); nextEl?.focus(); }
                                      }
                                    }}
                                    id={`qcm-${question.id}-${letter}`}
                                    ref={letter === availableOptions[0] ? registerQuestionRef(allUserQuestions().findIndex(x=>x.q.id===question.id)) : undefined}
                                    onChange={() => {
                                      const currentAnswers = userAnswers.medicalAnswers || [];
                                      const existingAnswer = currentAnswers.find(a => a.questionId === question.id);
                                      if (existingAnswer) {
                                        const currentOptions = existingAnswer.selectedOptions || [];
                                        const newOptions = userSelected ? currentOptions.filter(opt => opt !== letter) : [...currentOptions, letter];
                                        setUserAnswers(prev => ({
                                          ...prev,
                                          medicalAnswers: currentAnswers.map(a => a.questionId === question.id ? { ...a, selectedOptions: newOptions } : a)
                                        }));
                                      } else {
                                        setUserAnswers(prev => ({
                                          ...prev,
                                          medicalAnswers: [...currentAnswers, { questionId: question.id, selectedOptions: [letter] }]
                                        }));
                                      }
                                      // Removed auto advance: wait for user to press Enter to proceed
                                    }}
                                    className="w-6 h-6 rounded border-2 border-orange-400 text-orange-500 focus:ring-orange-500 focus:ring-2"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Show correct answers when not editing and reference is shown */}
                {!canEdit && showReference && !isValidated && (question.correctAnswers || []).length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                      Réponses correctes:
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      {(question.correctAnswers || []).join(', ').toUpperCase()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* QROC Answer */}
            {question.type === 'qroc' && (
              <div className="space-y-3">
                {showReference || canEdit ? (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Réponse de référence</label>
                    <Textarea
                      value={(question.correctAnswers || [''])[0]}
                      onChange={e => updateMedicalQuestion(question.id, 'correctAnswers', [e.target.value])}
                      readOnly={!canEdit}
                      placeholder="Réponse officielle..."
                      rows={3}
                      className="bg-gray-100/80 dark:bg-gray-800/40 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                  </div>
                ) : isValidated ? (
                  // Validation view: Show correct answer and QROC self-evaluation
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-green-700 dark:text-green-300">Réponse correcte</label>
                      <Textarea
                        value={(question.correctAnswers || [''])[0]}
                        readOnly
                        placeholder="Aucune réponse définie"
                        rows={3}
                        className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
                      />
                    </div>

                    {/* QROC Self-Assessment in validation section */}
                    <div className="mt-4 p-3 sm:p-4 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-3 mb-3">
                        <h4 className="font-medium text-blue-900 dark:text-blue-200 text-sm sm:text-base flex-shrink-0">
                          Évaluez votre réponse:
                        </h4>
                        <div className="flex-1 font-medium text-blue-900 dark:text-blue-200 text-sm sm:text-base break-words">
                          {userAnswers.texts.find(t => t.id === question.id)?.answer?.trim() || (
                            <span className="italic opacity-70">(vide)</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Separator */}
                      <div className="border-t border-blue-200/60 dark:border-blue-700/60 my-3"></div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-full">
                        <Button
                          size="sm"
                          className="w-full gap-1 bg-green-600/90 hover:bg-green-600 text-white shadow-md hover:shadow-lg transition-all duration-200 text-xs py-2 px-2 min-h-[32px] max-w-full"
                          onClick={() => setQrocEvaluation(question.id, 'correct')}
                        >
                          <CheckCircle className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate text-xs">Correcte</span>
                        </Button>
                        
                        <Button
                          size="sm"
                          className="w-full gap-1 bg-amber-500/90 hover:bg-amber-500 text-white shadow-md hover:shadow-lg transition-all duration-200 text-xs py-2 px-2 min-h-[32px] max-w-full"
                          onClick={() => setQrocEvaluation(question.id, 'partial')}
                        >
                          <MinusCircle className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate text-xs">Partiellement</span>
                        </Button>
                        
                        <Button
                          size="sm"
                          className="w-full gap-1 bg-red-600/90 hover:bg-red-600 text-white shadow-md hover:shadow-lg transition-all duration-200 text-xs py-2 px-2 min-h-[32px] max-w-full"
                          onClick={() => setQrocEvaluation(question.id, 'incorrect')}
                        >
                          <XCircle className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate text-xs">Incorrecte</span>
                        </Button>
                      </div>
                    </div>

                    {/* Show validation result after evaluation */}
                    {getQrocEvaluation(question.id) && (
                      <div className="mt-3 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Validé votre réponse comme: {
                            getQrocEvaluation(question.id)?.status === 'correct' ? 'Correcte' :
                            getQrocEvaluation(question.id)?.status === 'partial' ? 'Partiellement' :
                            'Incorrecte'
                          }</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Votre réponse</label>
                    <Textarea
                      value={userAnswers.texts.find(t => t.id === question.id)?.answer || ''}
                      onChange={e => updateTextAnswer(question.id, e.target.value)}
                      onKeyDown={e=>{
                        if(e.key==='Enter' && !e.shiftKey){
                          e.preventDefault();
                          // Ensure an answer object exists even if empty
                          if(!userAnswers.texts.find(t=>t.id===question.id)){
                            updateTextAnswer(question.id, (e.target as HTMLTextAreaElement).value);
                          }
                          goToNextQuestion();
                        }
                      }}
                      ref={registerQuestionRef(allUserQuestions().findIndex(x=>x.q.id===question.id))}
                      placeholder="Votre réponse..."
                      rows={3}
                      className="bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                  </div>
                )}
                {(!isEditor || editorTestMode) && showReference && !isValidated && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Votre réponse</label>
                    <Textarea
                      value={userAnswers.texts.find(t => t.id === question.id)?.answer || ''}
                      onChange={e => updateTextAnswer(question.id, e.target.value)}
                      placeholder="Votre réponse..."
                      rows={3}
                      className="bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Removed QROC self-evaluation interface to prevent overflow and auto-evaluation */}
                {/* QROC evaluation moved to post-validation section */}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Drop zone indicator at the bottom for the last item */}
        {dragState.isDragging && 
         index === ((data.medicalQuestions || []).length - 1) &&
         dragState.dropZoneIndex === index + 1 && (
          <div className={`h-2 border-2 border-dashed rounded mt-2 opacity-75 ${
            dragState.draggedType === 'medical' ? 'bg-blue-400 border-blue-500' :
            dragState.draggedType === 'clinical' ? 'bg-purple-400 border-purple-500' :
            'bg-green-400 border-green-500'
          }`}>
            <div className={`h-full rounded animate-pulse ${
              dragState.draggedType === 'medical' ? 'bg-blue-500' :
              dragState.draggedType === 'clinical' ? 'bg-purple-500' :
              'bg-green-500'
            }`}></div>
          </div>
        )}
      </div>
      ))}
      </div>

      {/* Cross-section drop zone between medical questions and clinical cases */}
      {dragState.isDragging && dragState.draggedType !== 'clinical' && (data.clinicalCases || []).length > 0 && (
        <div 
          className="h-4 border-2 border-dashed border-gray-300 rounded my-4 opacity-50 hover:opacity-75 transition-opacity cursor-pointer"
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, 0, 'clinical')}
          onDrop={(e) => handleDrop(e, 0, 'clinical')}
        >
          <div className="h-full bg-gray-200 rounded flex items-center justify-center">
            <span className="text-xs text-gray-500">Drop here to place before clinical cases</span>
          </div>
        </div>
      )}

      {/* Clinical Cases - Desktop Only */}
      <div className="hidden sm:block">
      {(data.clinicalCases || []).map((clinicalCase, index) => (
        <div key={clinicalCase.id}>
          {/* Drop zone indicator at the top */}
          {dragState.isDragging && 
           dragState.dropZoneIndex === index && (
            <div className={`h-2 border-2 border-dashed rounded mb-2 opacity-75 ${
              dragState.draggedType === 'medical' ? 'bg-blue-400 border-blue-500' :
              dragState.draggedType === 'clinical' ? 'bg-purple-400 border-purple-500' :
              'bg-green-400 border-green-500'
            }`}>
              <div className={`h-full rounded animate-pulse ${
                dragState.draggedType === 'medical' ? 'bg-blue-500' :
                dragState.draggedType === 'clinical' ? 'bg-purple-500' :
                'bg-green-500'
              }`}></div>
            </div>
          )}
          
          <Card 
            className={`border border-purple-200 dark:border-purple-700 bg-purple-50/70 dark:bg-purple-900/20 backdrop-blur-sm shadow-sm transition-all duration-200 hover:shadow-md ${
              dragState.isDragging && dragState.draggedIndex === index && dragState.draggedType === 'clinical'
                ? 'opacity-50 border-purple-400 transform rotate-1' 
                : ''
            }`}
            data-clinical-case-index={index}
            draggable={canEdit}
            onDragStart={(e) => handleDragStart(e, index, 'clinical')}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, index, 'clinical')}
            onDrop={(e) => handleDrop(e, index, 'clinical')}
          >
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-4 md:px-6">
              {/* First line: Title and Delete button */}
              <div className="flex items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  {canEdit && (
                    <div className="flex flex-col items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      <button
                        onClick={() => moveUp(index, 'clinical')}
                        disabled={index === 0}
                        className={`p-0.5 sm:p-1 rounded hover:bg-gray-100 transition-colors ${
                          index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:text-purple-600'
                        }`}
                        title="Move up"
                      >
                        <ChevronUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      </button>
                      
                      <div className="cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
                      </div>
                      
                      <button
                        onClick={() => moveDown(index, 'clinical', (data.clinicalCases || []).length)}
                        disabled={index === ((data.clinicalCases || []).length - 1)}
                        className={`p-0.5 sm:p-1 rounded hover:bg-gray-100 transition-colors ${
                          index === ((data.clinicalCases || []).length - 1) ? 'opacity-30 cursor-not-allowed' : 'hover:text-purple-600'
                        }`}
                        title="Move down"
                      >
                        <ChevronDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      </button>
                    </div>
                  )}
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  {canEdit ? (
                    <Input
                      value={clinicalCase.title}
                      onChange={e => updateClinicalCase(clinicalCase.id, 'title', e.target.value)}
                      placeholder="Titre du cas clinique..."
                      className="h-7 sm:h-8 flex-1 text-xs sm:text-sm bg-white/80 dark:bg-gray-800/50 border-purple-300 dark:border-purple-600 focus:ring-purple-500 font-semibold"
                    />
                  ) : (
                    <div className="flex-1 text-xs sm:text-sm md:text-base font-semibold text-purple-100/90 dark:text-purple-200/90 bg-purple-900/20 border border-transparent rounded-md px-2 sm:px-3 py-1 sm:py-1.5 leading-snug select-text">
                      {(clinicalCase.title || '').replace(/^cas\s*clinique[:.)-]*\s*/i,'Cas Clinique ').trim() || 'Cas Clinique'}
                    </div>
                  )}
                </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteClinicalCase(clinicalCase.id)}
                  className="gap-1 text-xs bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                  Supprimer
                </Button>
              )}
            </div>
            
            {/* Second line: Action buttons (Lien, QCM, QROC) */}
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const caseTitle = `CasClinique-${(data.clinicalCases || []).indexOf(clinicalCase) + 1}`;
                const existingLink = findLinkForQuestion(caseTitle);
                return (
                  <>
                    {/* View button in user mode / students */}
                    {existingLink && onNavigateToLink && (!isEditor || editorTestMode) && (
                      <Button
                        id={`voir-case-${(data.clinicalCases || []).indexOf(clinicalCase)}`}
                        size="sm"
                        variant="outline"
                        onClick={() => onNavigateToLink(existingLink.id)}
                        className="gap-1 text-xs border-green-300 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex-shrink-0"
                      >
                        <Eye className="h-3 w-3" />
                        Voir
                      </Button>
                    )}
                    {/* Create link only for editor normal mode */}
                    {!existingLink && isEditor && !editorTestMode && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onQuestionLink?.(caseTitle)}
                        className="gap-1 text-xs border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex-shrink-0"
                      >
                        <Link className="h-3 w-3" />
                        Lien
                      </Button>
                    )}
                  </>
                );
              })()}
              {canEdit && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addQuestionToClinicalCase(clinicalCase.id, 'qcm')}
                    className="gap-1 text-xs border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex-shrink-0"
                  >
                    <ClipboardList className="h-3 w-3" />
                    QCM
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addQuestionToClinicalCase(clinicalCase.id, 'qroc')}
                    className="gap-1 text-xs border-green-300 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex-shrink-0"
                  >
                    <PenLine className="h-3 w-3" />
                    QROC
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            {/* Clinical Case Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-purple-700 dark:text-purple-300">Énoncé du cas clinique</label>
              {canEdit ? (
                <Textarea
                  value={clinicalCase.enonce}
                  onChange={e => updateClinicalCase(clinicalCase.id, 'enonce', e.target.value)}
                  placeholder="Description détaillée du cas clinique..."
                  rows={4}
                  className="bg-white/80 dark:bg-gray-800/50 border-purple-300 dark:border-purple-600 focus:ring-purple-500"
                />
              ) : (
                <div 
                  className="p-3 bg-purple-50/50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-md text-sm sm:text-base text-purple-800 dark:text-purple-200 whitespace-pre-wrap clinical-case-description focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
                  tabIndex={isUserView ? 0 : -1}
                  onKeyDown={isUserView ? (e) => {
                    if(e.key === 'Enter') {
                      e.preventDefault();
                      goToNextQuestion();
                    }
                  } : undefined}
                  ref={(() => {
                    // Register this clinical case description for navigation
                    const list = allUserQuestions();
                    const caseDescriptionIndex = list.findIndex(item => 
                      item.kind === 'clinical-case' && item.q.id === clinicalCase.id
                    );
                    return caseDescriptionIndex !== -1 ? registerQuestionRef(caseDescriptionIndex) : undefined;
                  })()}
                >
                  {clinicalCase.enonce || "Description du cas clinique..."}
                  {isUserView && (
                    <div className="mt-3 text-xs text-purple-600 dark:text-purple-400 opacity-70">
                      Appuyez sur Entrée pour continuer →
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Questions within Clinical Case */}
            <div className="space-y-4">
              {clinicalCase.questions.map((question, qIndex) => (
                <div key={question.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white/50 dark:bg-gray-800/30">
                  {/* Question Header */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      {question.type === 'qcm' ? (
                        <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      ) : (
                        <PenLine className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      )}
                      {canEdit ? (
                        <Input
                          value={question.question}
                          onChange={e => updateClinicalCaseQuestion(clinicalCase.id, question.id, 'question', e.target.value)}
                          placeholder={`Question ${qIndex + 1}...`}
                          className="h-8 flex-1 bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="flex-1 text-sm sm:text-base font-medium text-blue-100/90 dark:text-blue-200/90 bg-blue-900/20 border border-transparent rounded-md px-3 py-1.5 leading-snug select-text">
                          {(() => {
                            const raw = (question.question || '').trim();
                            // Only remove very specific question prefixes like "Question 1:", "Question n°1:", etc.
                            const cleaned = raw.replace(/^(question\s+n?°?\s*\d+\s*[:.)\-]\s*)/i, '').trim();
                            if (cleaned) return cleaned;
                            if (raw) return raw;
                            // Generate automatic question number as fallback
                            return `Question ${qIndex + 1}`;
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const subTitle = `CasClinique-${(data.clinicalCases || []).indexOf(clinicalCase) + 1}-Question-${qIndex + 1}`;
                        const existingLink = findLinkForQuestion(subTitle);
                        return (
                          <>
                            {existingLink && onNavigateToLink && (!isEditor || editorTestMode) && (
                              <Button
                                id={`voir-case-${(data.clinicalCases || []).indexOf(clinicalCase)}-question-${qIndex}`}
                                size="sm"
                                variant="outline"
                                onClick={() => onNavigateToLink(existingLink.id)}
                                className="gap-1 text-xs border-green-300 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex-shrink-0"
                              >
                                <Eye className="h-3 w-3" />
                                Voir
                              </Button>
                            )}
                            {!existingLink && isEditor && !editorTestMode && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onQuestionLink?.(subTitle)}
                                className="gap-1 text-xs border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex-shrink-0"
                              >
                                <Link className="h-3 w-3" />
                                Lien
                              </Button>
                            )}
                          </>
                        );
                      })()}
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteClinicalCaseQuestion(clinicalCase.id, question.id)}
                          className="gap-1 text-xs bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* QCM Grid - compact two-row layout like standalone QCM */}
                  {question.type === 'qcm' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {canEdit ? 'Options et réponses correctes' : 'Sélectionnez vos réponses'}
                        </label>
                        {canEdit && (
                          <button
                            onClick={() => setEditingQcmId(question.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                          >
                            <Edit2 className="h-3 w-3" />
                            Modifier
                          </button>
                        )}
                      </div>
                      <div className="border-2 border-orange-400 rounded-lg p-3 bg-gray-50/30 dark:bg-gray-800/20">
                        {(() => {
                          const availableOptions = getAvailableOptions(question);
                          const getCaseAnswer = () => userAnswers.clinicalCaseAnswers?.find(c => c.caseId === clinicalCase.id);
                          return (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                {availableOptions.map(letter => (
                                  <div key={letter} className="h-9 flex-1 px-2 border-2 border-orange-400 rounded flex items-center justify-center bg-gray-800 dark:bg-gray-900">
                                    <span className="text-orange-400 font-bold text-lg leading-none select-none">{letter}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                {availableOptions.map(letter => {
                                  const isCorrect = (question.correctAnswers || []).includes(letter);
                                  const caseAns = getCaseAnswer();
                                  const questionAns = caseAns?.questionAnswers?.find(q => q.questionId === question.id);
                                  const userSelected = questionAns?.selectedOptions?.includes(letter) || false;
                                  return (
                                    <div key={`case-q-${question.id}-${letter}`} className="h-9 flex-1 px-2 border-2 border-orange-400 rounded flex items-center justify-center bg-white dark:bg-gray-800">
                                      {canEdit ? (
                                        <input
                                          type="checkbox"
                                          checked={isCorrect}
                                          onChange={() => toggleClinicalCaseCorrectAnswer(clinicalCase.id, question.id, letter)}
                                          className="w-6 h-6 rounded border-2 border-orange-400 text-orange-500 focus:ring-orange-500 focus:ring-2"
                                        />
                                      ) : isValidated ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                          {userSelected && isCorrect ? (
                                            <div className="w-6 h-6 bg-green-500 rounded border-2 border-green-600 flex items-center justify-center">
                                              <CheckCircle className="h-4 w-4 text-white" />
                                            </div>
                                          ) : userSelected && !isCorrect ? (
                                            <div className="w-6 h-6 bg-red-500 rounded border-2 border-red-600 flex items-center justify-center">
                                              <X className="h-4 w-4 text-white" />
                                            </div>
                                          ) : !userSelected && isCorrect ? (
                                            <div className="w-6 h-6 bg-yellow-500 rounded border-2 border-yellow-600 flex items-center justify-center">
                                              <span className="text-white font-bold text-xs">!</span>
                                            </div>
                                          ) : (
                                            <div className="w-6 h-6 bg-gray-300 rounded border-2 border-gray-400" />
                                          )}
                                        </div>
                                      ) : (
                                        <input
                                          type="checkbox"
                                          checked={userSelected}
                                          id={`clinical-qcm-${question.id}-${letter}`}
                                          ref={letter === availableOptions[0] ? registerQuestionRef(allUserQuestions().findIndex(x=>x.q.id===question.id)) : undefined}
                                          onKeyDown={e=>{
                                            const opts = availableOptions;
                                            if(/^[1-9]$/.test(e.key)){
                                              const idx = parseInt(e.key,10)-1;
                                              if(idx < opts.length){
                                                const targetLetter = opts[idx];
                                                if(targetLetter !== letter){
                                                  const targetEl = document.getElementById(`clinical-qcm-${question.id}-${targetLetter}`) as HTMLInputElement | null;
                                                  targetEl?.focus();
                                                  targetEl?.click();
                                                } else {
                                                  (e.target as HTMLInputElement).click();
                                                }
                                                e.preventDefault();
                                                return;
                                              }
                                            }
                                            if(e.key==='Enter'){ e.preventDefault(); goToNextQuestion(); }
                                            if(e.key===' '){ e.preventDefault(); (e.target as HTMLInputElement).click(); }
                                            if(['ArrowRight','ArrowLeft'].includes(e.key)){
                                              const curIdx = opts.indexOf(letter); const delta = e.key==='ArrowRight'?1:-1; const n = opts[curIdx+delta]; if(n){ document.getElementById(`clinical-qcm-${question.id}-${n}`)?.focus(); }
                                            }
                                          }}
                                          onChange={() => {
                                            const currentCases = userAnswers.clinicalCaseAnswers || [];
                                            const existingCase = currentCases.find(c => c.caseId === clinicalCase.id);
                                            if (existingCase) {
                                              const existingQuestion = existingCase.questionAnswers.find(q => q.questionId === question.id);
                                              if (existingQuestion) {
                                                const currentOptions = existingQuestion.selectedOptions || [];
                                                const newOptions = userSelected ? currentOptions.filter(opt => opt !== letter) : [...currentOptions, letter];
                                                setUserAnswers(prev => ({
                                                  ...prev,
                                                  clinicalCaseAnswers: currentCases.map(c => c.caseId === clinicalCase.id ? {
                                                    ...c,
                                                    questionAnswers: c.questionAnswers.map(q => q.questionId === question.id ? { ...q, selectedOptions: newOptions } : q)
                                                  } : c)
                                                }));
                                              } else {
                                                setUserAnswers(prev => ({
                                                  ...prev,
                                                  clinicalCaseAnswers: currentCases.map(c => c.caseId === clinicalCase.id ? {
                                                    ...c,
                                                    questionAnswers: [...c.questionAnswers, { questionId: question.id, selectedOptions: [letter] }]
                                                  } : c)
                                                }));
                                              }
                                            } else {
                                              setUserAnswers(prev => ({
                                                ...prev,
                                                clinicalCaseAnswers: [...currentCases, { caseId: clinicalCase.id, questionAnswers: [{ questionId: question.id, selectedOptions: [letter] }] }]
                                              }));
                                            }
                                          }}
                                          className="w-6 h-6 rounded border-2 border-orange-400 text-orange-500 focus:ring-orange-500 focus:ring-2"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Show correct answers when not editing and reference is shown */}
                      {!canEdit && showReference && !isValidated && (question.correctAnswers || []).length > 0 && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                          <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                            Réponses correctes:
                          </div>
                          <div className="text-sm text-green-700 dark:text-green-300">
                            {(question.correctAnswers || []).join(', ').toUpperCase()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* QROC Answer */}
                  {question.type === 'qroc' && (
                    <div className="space-y-3">
                      {showReference || canEdit ? (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Réponse de référence</label>
                          <Textarea
                            value={(question.correctAnswers || [''])[0]}
                            onChange={e => updateClinicalCaseQuestion(clinicalCase.id, question.id, 'correctAnswers', [e.target.value])}
                            readOnly={!canEdit}
                            placeholder="Réponse officielle..."
                            rows={3}
                            className="bg-gray-100/80 dark:bg-gray-800/40 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                          />
                        </div>
                      ) : isValidated ? (
                        // Validation view: Show correct answer and QROC self-evaluation
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-green-700 dark:text-green-300">Réponse correcte</label>
                            <Textarea
                              value={(question.correctAnswers || [''])[0]}
                              readOnly
                              placeholder="Aucune réponse définie"
                              rows={3}
                              className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
                            />
                          </div>

                          {/* QROC Self-Assessment for Clinical Cases in validation section */}
                          <div className="mt-4 p-3 sm:p-4 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                            <h4 className="font-medium mb-3 text-blue-900 dark:text-blue-200 text-sm sm:text-base">
                              Évaluez votre réponse:
                            </h4>
                            <div className="mb-3 p-2 bg-blue-100/50 dark:bg-blue-900/50 rounded border text-blue-800 dark:text-blue-100 text-xs sm:text-sm break-words">
                              {userAnswers.clinicalCaseAnswers?.find(c => c.caseId === clinicalCase.id)?.questionAnswers?.find(q => q.questionId === question.id)?.textAnswer?.trim() || (
                                <span className="italic opacity-70">(vide)</span>
                              )}
                            </div>
                            
                            {/* Separator */}
                            <div className="border-t border-blue-200/60 dark:border-blue-700/60 my-3"></div>
                            
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                              <Button
                                size="sm"
                                className="flex-1 gap-2 bg-green-600/90 hover:bg-green-600 text-white shadow-md hover:shadow-lg transition-all duration-200 text-xs sm:text-sm py-2 px-3 min-h-[36px]"
                                onClick={() => setQrocEvaluation(question.id, 'correct')}
                              >
                                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">Correcte</span>
                              </Button>
                              
                              <Button
                                size="sm"
                                className="flex-1 gap-2 bg-amber-500/90 hover:bg-amber-500 text-white shadow-md hover:shadow-lg transition-all duration-200 text-xs sm:text-sm py-2 px-3 min-h-[36px]"
                                onClick={() => setQrocEvaluation(question.id, 'partial')}
                              >
                                <MinusCircle className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">Partiellement</span>
                              </Button>
                              
                              <Button
                                size="sm"
                                className="flex-1 gap-2 bg-red-600/90 hover:bg-red-600 text-white shadow-md hover:shadow-lg transition-all duration-200 text-xs sm:text-sm py-2 px-3 min-h-[36px]"
                                onClick={() => setQrocEvaluation(question.id, 'incorrect')}
                              >
                                <XCircle className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">Incorrecte</span>
                              </Button>
                            </div>
                          </div>

                          {/* Show validation result after evaluation for Clinical Cases */}
                          {getQrocEvaluation(question.id) && (
                            <div className="mt-3 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Validé votre réponse comme: {
                                  getQrocEvaluation(question.id)?.status === 'correct' ? 'Correcte' :
                                  getQrocEvaluation(question.id)?.status === 'partial' ? 'Partiellement' :
                                  'Incorrecte'
                                }</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Votre réponse</label>
                          <Textarea
                            value={
                              userAnswers.clinicalCaseAnswers?.find(c => c.caseId === clinicalCase.id)?.questionAnswers?.find(q => q.questionId === question.id)?.textAnswer || ''
                            }
                            onChange={e => {
                              const currentCases = userAnswers.clinicalCaseAnswers || [];
                              const existingCase = currentCases.find(c => c.caseId === clinicalCase.id);
                              if (existingCase) {
                                const existingQuestion = existingCase.questionAnswers.find(q => q.questionId === question.id);
                                if (existingQuestion) {
                                  setUserAnswers(prev => ({
                                    ...prev,
                                    clinicalCaseAnswers: currentCases.map(c => c.caseId === clinicalCase.id ? {
                                      ...c,
                                      questionAnswers: c.questionAnswers.map(q => q.questionId === question.id ? { ...q, textAnswer: e.target.value } : q)
                                    } : c)
                                  }));
                                } else {
                                  setUserAnswers(prev => ({
                                    ...prev,
                                    clinicalCaseAnswers: currentCases.map(c => c.caseId === clinicalCase.id ? {
                                      ...c,
                                      questionAnswers: [...c.questionAnswers, { questionId: question.id, textAnswer: e.target.value }]
                                    } : c)
                                  }));
                                }
                              } else {
                                setUserAnswers(prev => ({
                                  ...prev,
                                  clinicalCaseAnswers: [...currentCases, { caseId: clinicalCase.id, questionAnswers: [{ questionId: question.id, textAnswer: e.target.value }] }]
                                }));
                              }
                            }}
                            onKeyDown={e => {
                              if(e.key==='Enter' && !e.shiftKey){
                                e.preventDefault();
                                const value = (e.target as HTMLTextAreaElement).value;
                                const currentCases = userAnswers.clinicalCaseAnswers || [];
                                const existingCase = currentCases.find(c => c.caseId === clinicalCase.id);
                                if(!existingCase){
                                  setUserAnswers(prev => ({
                                    ...prev,
                                    clinicalCaseAnswers:[...currentCases,{caseId:clinicalCase.id,questionAnswers:[{questionId:question.id,textAnswer:value}]}]
                                  }));
                                }
                                goToNextQuestion();
                              }
                            }}
                            ref={registerQuestionRef(allUserQuestions().findIndex(x=>x.q.id===question.id))}
                            placeholder="Votre réponse... (Entrée pour question suivante)"
                            rows={3}
                            className="bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                          />
                          {/* QROC evaluation moved to post-validation section */}
                        </div>
                      )}

                      {/* Removed Clinical Case QROC self-evaluation interface to prevent overflow and auto-evaluation */}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Drop zone indicator at the bottom for the last item */}
        {dragState.isDragging && 
         index === ((data.clinicalCases || []).length - 1) &&
         dragState.dropZoneIndex === index + 1 && (
          <div className={`h-2 border-2 border-dashed rounded mt-2 opacity-75 ${
            dragState.draggedType === 'medical' ? 'bg-blue-400 border-blue-500' :
            dragState.draggedType === 'clinical' ? 'bg-purple-400 border-purple-500' :
            'bg-green-400 border-green-500'
          }`}>
            <div className={`h-full rounded animate-pulse ${
              dragState.draggedType === 'medical' ? 'bg-blue-500' :
              dragState.draggedType === 'clinical' ? 'bg-purple-500' :
              'bg-green-500'
            }`}></div>
          </div>
        )}
      </div>
      ))}
      </div>

      {/* Cross-section drop zone between clinical cases and text blocks */}
      {dragState.isDragging && dragState.draggedType !== 'text' && data.texts.length > 0 && (
        <div 
          className="h-4 border-2 border-dashed border-gray-300 rounded my-4 opacity-50 hover:opacity-75 transition-opacity cursor-pointer"
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, 0, 'text')}
          onDrop={(e) => handleDrop(e, 0, 'text')}
        >
          <div className="h-full bg-gray-200 rounded flex items-center justify-center">
            <span className="text-xs text-gray-500">Drop here to place before text blocks</span>
          </div>
        </div>
      )}

      {/* Text blocks */}
      {data.texts.map((txt, index) => {
        const userTxt = userAnswers.texts.find(t => t.id === txt.id);
        return (
          <div key={txt.id}>
            {/* Drop zone indicator at the top */}
            {dragState.isDragging && 
             dragState.dropZoneIndex === index && (
              <div className={`h-2 border-2 border-dashed rounded mb-2 opacity-75 ${
                dragState.draggedType === 'medical' ? 'bg-blue-400 border-blue-500' :
                dragState.draggedType === 'clinical' ? 'bg-purple-400 border-purple-500' :
                'bg-green-400 border-green-500'
              }`}>
                <div className={`h-full rounded animate-pulse ${
                  dragState.draggedType === 'medical' ? 'bg-blue-500' :
                  dragState.draggedType === 'clinical' ? 'bg-purple-500' :
                  'bg-green-500'
                }`}></div>
              </div>
            )}
            
            <Card 
              className={`border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm transition-all duration-200 hover:shadow-md ${
                dragState.isDragging && dragState.draggedIndex === index && dragState.draggedType === 'text'
                  ? 'opacity-50 border-green-400 transform rotate-1' 
                  : ''
              }`}
              draggable={canEdit}
              onDragStart={(e) => handleDragStart(e, index, 'text')}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, index, 'text')}
              onDrop={(e) => handleDrop(e, index, 'text')}
            >
              <CardHeader className="pb-3 px-4 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100 min-w-0 flex-1">
                    {canEdit && (
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => moveUp(index, 'text')}
                          disabled={index === 0}
                          className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                            index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:text-green-600'
                          }`}
                          title="Move up"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        
                        <div className="cursor-grab active:cursor-grabbing">
                          <GripVertical className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
                        </div>
                        
                        <button
                          onClick={() => moveDown(index, 'text', data.texts.length)}
                          disabled={index === (data.texts.length - 1)}
                          className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                            index === (data.texts.length - 1) ? 'opacity-30 cursor-not-allowed' : 'hover:text-green-600'
                          }`}
                          title="Move down"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <PenLine className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <Input
                      value={txt.title || ''}
                      disabled={!canEdit}
                      onChange={e => setData(d => ({ ...d, texts: d.texts.map(t => t.id === txt.id ? { ...t, title: e.target.value } : t) }))}
                      placeholder="Titre de la zone"
                      className="h-8 min-w-0 flex-1 max-w-sm bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                  </CardTitle>
                <div className="flex items-center gap-2">
                  {(() => {
                    const qrocTitle = `QROC-${data.texts.indexOf(txt) + 1}`;
                    const existingLink = findLinkForQuestion(qrocTitle);
                    
                    return (
                      <>
                        {/* View button visible to students and editor in user mode */}
                        {existingLink && onNavigateToLink && (!isEditor || editorTestMode) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onNavigateToLink(existingLink.id)}
                            className="gap-1 text-xs border-green-300 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex-shrink-0"
                          >
                            <Eye className="h-3 w-3" />
                            Voir
                          </Button>
                        )}
                        {/* Creation button only for editors outside user mode */}
                        {!existingLink && !editorTestMode && isEditor && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onQuestionLink?.(qrocTitle)}
                            className="gap-1 text-xs border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex-shrink-0"
                          >
                            <Link className="h-3 w-3" />
                            Lien
                          </Button>
                        )}
                      </>
                    );
                  })()}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteText(txt.id)}
                      className="gap-1 text-xs bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4 sm:px-6">
              {showReference || canEdit ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Réponse de référence</label>
                  <Textarea
                    value={txt.reference}
                    onChange={e => updateTextReference(txt.id, e.target.value)}
                    readOnly={!canEdit}
                    placeholder="Réponse officielle"
                    rows={4}
                    className="bg-gray-100/80 dark:bg-gray-800/40 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Votre réponse</label>
                  <Textarea
                    value={userTxt?.answer || ''}
                    onChange={e => updateTextAnswer(txt.id, e.target.value)}
                    placeholder="Votre réponse"
                    rows={4}
                    className="bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  />
                </div>
              )}
              {(!isEditor || editorTestMode) && showReference && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Votre réponse</label>
                  <Textarea
                    value={userTxt?.answer || ''}
                    onChange={e => updateTextAnswer(txt.id, e.target.value)}
                    placeholder="Votre réponse"
                    rows={4}
                    className="bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  />
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Drop zone indicator at the bottom for the last item */}
          {dragState.isDragging && 
           index === (data.texts.length - 1) &&
           dragState.dropZoneIndex === index + 1 && (
            <div className={`h-2 border-2 border-dashed rounded mt-2 opacity-75 ${
              dragState.draggedType === 'medical' ? 'bg-blue-400 border-blue-500' :
              dragState.draggedType === 'clinical' ? 'bg-purple-400 border-purple-500' :
              'bg-green-400 border-green-500'
            }`}>
              <div className={`h-full rounded animate-pulse ${
                dragState.draggedType === 'medical' ? 'bg-blue-500' :
                dragState.draggedType === 'clinical' ? 'bg-purple-500' :
                'bg-green-500'
              }`}></div>
            </div>
          )}
        </div>
        );
      })}

      {(!isEditor || editorTestMode) && (data.tables.length > 0 || data.texts.length > 0) && (
        <Card className="border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm">
          <CardContent className="pt-4 pb-4 px-4 sm:px-6">
            <div className="flex justify-center">
              <Button size="sm" onClick={submitAnswers} disabled={submitting} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 w-full sm:w-auto min-w-[160px]">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} 
                <span>Enregistrer Réponses</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && data.tables.length === 0 && data.texts.length === 0 && (!data.medicalQuestions || data.medicalQuestions.length === 0) && (!data.clinicalCases || data.clinicalCases.length === 0) && (
  <Card className="border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm">
          <CardContent className="py-8 sm:py-12 text-center px-4 sm:px-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              {canEdit ? 'Aucune correction créée. Ajoutez des QCM ou des zones de texte.' : 'Aucune correction disponible pour cette session.'}
            </p>
            {canEdit && (
              <div className="flex gap-2 justify-center flex-wrap">
                <Button size="sm" variant="outline" onClick={addMedicalQCM} className="gap-2 min-w-[140px] bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:border-blue-800 dark:text-blue-200">
                  <ClipboardList className="h-4 w-4" /> QCM Médical
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

  {/* Bottom validation / restart section - user view */}
  {isUserView && !isValidated && data && (() => {
        const totalQcmMedical = (data.medicalQuestions||[]).filter(q=>q.type==='qcm').length;
        const totalQrocMedical = (data.medicalQuestions||[]).filter(q=>q.type==='qroc').length;
        const totalClinical = (data.clinicalCases||[]).reduce((acc,c)=>acc + (c.questions||[]).length,0);
        const totalQuestions = totalQcmMedical + totalQrocMedical + totalClinical;
  // Count answers including blank QROC entries (presence counts)
  const answeredMedical = (userAnswers.medicalAnswers||[]).length + (userAnswers.texts||[]).length;
  const answeredClinical = (userAnswers.clinicalCaseAnswers||[]).reduce((acc,c)=>acc + (c.questionAnswers||[]).length,0);
        const answeredTotal = answeredMedical + answeredClinical;
        const allAnswered = totalQuestions>0 && answeredTotal >= totalQuestions;
        return (
          <Card className="border border-green-200 dark:border-green-700 bg-green-50/70 dark:bg-green-900/20 backdrop-blur-sm shadow-sm">
            <CardContent className="py-6 text-center px-4 sm:px-6">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-800/50 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                    {allAnswered ? 'Vous pouvez valider vos réponses' : 'Complétez toutes les questions'}
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-4 max-w-md">
                    {allAnswered ? 'Cliquez sur valider pour révéler la correction.' : `Progression: ${answeredTotal} / ${totalQuestions} questions répondues.`}
                  </p>
                  {!allAnswered && (
                    <p className="text-xs text-green-600 dark:text-green-400">Question active: {activeQuestionIndex + 1} / {totalQuestions}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button id="validate-button" ref={validateButtonRef} onClick={validateAnswers} disabled={!allAnswered} className="gap-2 bg-green-600 disabled:opacity-50 hover:bg-green-700 text-white min-w-[160px] px-6 py-2">
                    <CheckCircle className="h-4 w-4" />
                    Valider mes réponses
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
      {isUserView && isValidated && (
        <Card className="border border-blue-200 dark:border-blue-700 bg-blue-50/70 dark:bg-blue-900/20 backdrop-blur-sm shadow-sm mt-6">
          <CardContent className="py-6 text-center px-4 sm:px-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-800/50 flex items-center justify-center">
                <RefreshCw className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">Nouvelle tentative</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-4 max-w-md">Appuyez sur le bouton ou la touche R pour recommencer avec des réponses vierges.</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={resetValidation} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white min-w-[180px] px-6 py-2">
                  <RefreshCw className="h-4 w-4" />
                  Nouvelle tentative
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save button removed in user view - answers are saved automatically */}

      {/* QCM Advanced Editing Dialog */}
      <Dialog open={!!editingQcmId} onOpenChange={() => setEditingQcmId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier les options QCM</DialogTitle>
          </DialogHeader>
          
          {editingQcmId && (() => {
            const question = [...(data.medicalQuestions || []), ...(data.clinicalCases || []).flatMap(c => c.questions || [])]
              .find(q => q.id === editingQcmId);
            
            if (!question || question.type !== 'qcm') return null;

            const availableOptions = getAvailableOptions(question);
            const allOptions = ['a', 'b', 'c', 'd', 'e'];

            return (
              <div className="space-y-6">
                {/* Question Preview */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Question:
                  </div>
                  <div className="text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-3 rounded border">
                    {question.question || "Question sans énoncé"}
                  </div>
                </div>

                {/* QCM Options Editor */}
                <div className="space-y-4">
                  <div className="text-lg font-medium text-gray-900 dark:text-white">
                    Options et réponses correctes
                  </div>
                  
                  {/* Clean Grid Layout */}
                  <div className="border-2 border-orange-400 rounded-lg p-6 bg-orange-50/30 dark:bg-orange-950/20">
                    <div className="space-y-4">
                      {/* Options Row */}
                      <div className="flex gap-3 justify-center">
                        {allOptions.map(letter => {
                          const isActive = availableOptions.includes(letter);
                          return (
                            <div key={letter} className="flex flex-col items-center space-y-2">
                              {/* Option Letter */}
                              <div className={`h-14 w-14 border-2 rounded-lg flex items-center justify-center relative transition-all duration-200 ${
                                isActive 
                                  ? 'border-orange-400 bg-gray-800 dark:bg-gray-900 shadow-md' 
                                  : 'border-gray-300 bg-gray-200 dark:bg-gray-700 opacity-60'
                              }`}>
                                <span className={`font-bold text-xl ${
                                  isActive ? 'text-orange-400' : 'text-gray-500'
                                }`}>
                                  {letter.toUpperCase()}
                                </span>
                                
                                {/* Toggle Button */}
                                <button
                                  onClick={() => {
                                    if (isActive) {
                                      if (availableOptions.length > 1) {
                                        removeOption(question.id, letter);
                                      }
                                    } else {
                                      addOption(question.id, letter);
                                    }
                                  }}
                                  disabled={isActive && availableOptions.length === 1}
                                  className={`absolute -top-2 -right-2 w-7 h-7 rounded-full text-sm font-bold transition-all duration-200 shadow-lg ${
                                    isActive
                                      ? 'bg-red-500 hover:bg-red-600 text-white border-2 border-white'
                                      : 'bg-green-500 hover:bg-green-600 text-white border-2 border-white'
                                  } ${isActive && availableOptions.length === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
                                  title={isActive ? `Désactiver option ${letter.toUpperCase()}` : `Activer option ${letter.toUpperCase()}`}
                                >
                                  {isActive ? '−' : '+'}
                                </button>
                              </div>
                              
                              {/* Correct Answer Checkbox */}
                              <div className={`h-14 w-14 border-2 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                isActive 
                                  ? 'border-orange-400 bg-white dark:bg-gray-800 shadow-md' 
                                  : 'border-gray-300 bg-gray-100 dark:bg-gray-700 opacity-60'
                              }`}>
                                {isActive ? (
                                  <input
                                    type="checkbox"
                                    checked={(question.correctAnswers || []).includes(letter)}
                                    onChange={() => toggleCorrectAnswer(question.id, letter)}
                                    className="w-7 h-7 rounded border-2 border-orange-400 text-orange-500 focus:ring-orange-500 focus:ring-2 cursor-pointer"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded border-2 border-gray-300 bg-gray-200 dark:bg-gray-600"></div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Instructions */}
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                        <div className="font-medium mb-2">Instructions:</div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          <span>Cliquez sur les boutons <span className="font-mono bg-green-100 text-green-800 px-1 rounded">+</span>/<span className="font-mono bg-red-100 text-red-800 px-1 rounded">−</span> pour activer/désactiver les options</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          <span>Cochez les cases pour définir les réponses correctes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          <span>Au moins une option doit rester active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="font-medium text-blue-900 dark:text-blue-100">Options actives</span>
                    </div>
                    <div className="text-blue-800 dark:text-blue-200">
                      <div className="text-lg font-semibold">
                        {availableOptions.map(o => o.toUpperCase()).join(', ')}
                      </div>
                      <div className="text-sm opacity-75">
                        {availableOptions.length} option{availableOptions.length > 1 ? 's' : ''} sur 5
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="font-medium text-green-900 dark:text-green-100">Réponses correctes</span>
                    </div>
                    <div className="text-green-800 dark:text-green-200">
                      <div className="text-lg font-semibold">
                        {(question.correctAnswers || []).length > 0 
                          ? (question.correctAnswers || []).map((a: string) => a.toUpperCase()).join(', ')
                          : 'Aucune'
                        }
                      </div>
                      <div className="text-sm opacity-75">
                        {(question.correctAnswers || []).length} réponse{(question.correctAnswers || []).length > 1 ? 's' : ''} correcte{(question.correctAnswers || []).length > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={() => setEditingQcmId(null)}
                    className="px-6 py-2"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingQcmId(null);
                      setDirty(true);
                    }}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700"
                  >
                    Sauvegarder
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      
      {/* Floating Self-Evaluation Progress Indicator */}
      {isUserView && isValidated && reviewIndex !== null && pendingSelfEvalIds.length > 0 && (
        <div className="fixed top-2 sm:top-4 right-2 sm:right-4 z-50 bg-blue-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-lg border border-blue-500 max-w-[calc(100vw-1rem)] sm:max-w-none">
          <div className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">
            Auto-évaluation QROC {reviewIndex + 1}/{pendingSelfEvalIds.length}
          </div>
          <div className="text-[10px] sm:text-xs space-y-0.5 sm:space-y-1">
            <div>1 = Correcte</div>
            <div>2 = Partielle</div>
            <div>3 = Incorrecte</div>
            <div className="border-t border-blue-400 pt-1 mt-1 sm:mt-2 text-[9px] sm:text-xs">Entrée = Suivant</div>
          </div>
        </div>
      )}

      {/* Copy-Paste Dialog */}
      <Dialog open={showPasteDialog} onOpenChange={setShowPasteDialog}>
        <DialogContent className="w-[95vw] max-w-4xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-4">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5" />
              Coller des Questions - Formats Supportés
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4 sm:space-y-6 pr-2">
              {/* Format Examples */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
                <h3 className="font-semibold text-xs sm:text-sm text-gray-700 dark:text-gray-300">Formats supportés:</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 text-xs">
                  <div className="space-y-2">
                    <h4 className="font-medium text-blue-600 text-xs sm:text-sm">QCM avec déclaration:</h4>
                    <pre className="bg-white dark:bg-gray-900 p-2 rounded border text-[9px] sm:text-[10px] overflow-x-auto">
{`QCM:
Question 1: Quel est...?
a) Option A
b) Option B ##
c) Option C
d) Option D`}
                    </pre>
                    <p className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs">
                      Commencer par <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-[9px] sm:text-[10px]">QCM:</code>
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-green-600 text-xs sm:text-sm">QROC avec déclaration:</h4>
                    <pre className="bg-white dark:bg-gray-900 p-2 rounded border text-[9px] sm:text-[10px] overflow-x-auto">
{`QROC:
Question 2: Définir...?
Réponse: La définition
Explication: Plus de détails`}
                    </pre>
                    <p className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs">
                      Commencer par <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-[9px] sm:text-[10px]">QROC:</code>
                    </p>
                  </div>
                  
                  <div className="space-y-2 lg:col-span-2">
                    <h4 className="font-medium text-purple-600 text-xs sm:text-sm">Cas Clinique avec déclaration:</h4>
                    <pre className="bg-white dark:bg-gray-900 p-2 rounded border text-[9px] sm:text-[10px] overflow-x-auto">
{`CAS CLINIQUE:
Patient de 65 ans...

Question 1: Diagnostic?
a) Diag A ##
b) Diag B

Question 2: Traitement?
Réponse: Traitement ABC`}
                    </pre>
                    <p className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs">
                      Commencer par <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-[9px] sm:text-[10px]">CAS CLINIQUE:</code>
                    </p>
                  </div>
                </div>
              </div>

              {/* Paste Area */}
              <div className="space-y-3">
                <label className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                  Collez votre contenu ici:
                </label>
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Collez vos questions ici... Utilisez QCM:, QROC:, ou CAS CLINIQUE: pour forcer le type."
                  className="min-h-[200px] sm:min-h-[300px] font-mono text-xs sm:text-sm resize-none"
                />
              </div>

              {/* Result Display */}
              {pasteResult && (
                <div className={`p-3 rounded-lg border text-xs sm:text-sm ${
                  pasteResult.startsWith('✅') 
                    ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
                    : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
                }`}>
                  {pasteResult}
                </div>
              )}
            </div>
          </div>

          {/* Fixed Action Buttons */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasteDialog(false);
                  setPasteText('');
                  setPasteResult(null);
                }}
                className="px-4 sm:px-6 text-sm order-2 sm:order-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handlePasteContent}
                disabled={!pasteText.trim()}
                className="px-4 sm:px-6 text-sm bg-orange-600 hover:bg-orange-700 order-1 sm:order-2"
              >
                Analyser et Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
