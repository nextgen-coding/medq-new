"use client";

import { useState, useEffect, useRef } from 'react';
import { ClinicalCase, Question } from '@/types';
import { MCQQuestion } from './MCQQuestion';
import { OpenQuestion } from './OpenQuestion';
import { QuestionNotes } from './QuestionNotes';
import { QuestionComments } from './QuestionComments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, Circle, AlertCircle, Eye, FileText, Pin, PinOff, EyeOff, Trash2, Pencil, StickyNote, ChevronRight, Flag, XCircle } from 'lucide-react';
import { ReportQuestionDialog } from './ReportQuestionDialog';
import { HighlightableCaseText } from './HighlightableCaseText';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import { ClinicalCaseEditDialog } from '@/components/questions/edit/ClinicalCaseEditDialog';
import { GroupedQrocEditDialog } from '@/components/questions/edit/GroupedQrocEditDialog';
import { GroupedMcqEditDialog } from '@/components/questions/edit/GroupedMcqEditDialog';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// Helper function to generate a deterministic UUID from a string
function generateDeterministicUUID(input: string): string {
  // Use a simple hash of the input to create a UUID-like string
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert hash to hex and ensure we have enough characters
  const hashStr = Math.abs(hash).toString(16).padStart(32, '0');

  // Create a valid UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where y is one of 8, 9, a, b
  return `${hashStr.slice(0, 8)}-${hashStr.slice(8, 12)}-4${hashStr.slice(12, 15)}-a${hashStr.slice(15, 18)}-${hashStr.slice(18, 30)}`;
}

interface ClinicalCaseQuestionProps {
  clinicalCase: ClinicalCase;
  onSubmit: (caseNumber: number, answers: Record<string, any>, results: Record<string, boolean | 'partial'>) => void;
  onNext: () => void;
  lectureId: string;
  lectureTitle?: string;
  specialtyName?: string;
  // Distinguish visual label and admin edit behavior
  // 'clinical' for true clinical cases; 'multi_qcm' or 'multi_qroc' for grouped blocks
  displayMode?: 'clinical' | 'multi_qcm' | 'multi_qroc';
  isAnswered: boolean;
  answerResult?: boolean | 'partial';
  userAnswers?: Record<string, any>;
  answerResults?: Record<string, boolean | 'partial'>;
  onAnswerUpdate?: (questionId: string, answer: any, result?: boolean | 'partial') => void;
}

export function ClinicalCaseQuestion({
  clinicalCase,
  onSubmit,
  onNext,
  lectureId,
  lectureTitle,
  specialtyName,
  displayMode = 'clinical',
  isAnswered,
  answerResult,
  userAnswers = {},
  answerResults = {},
  onAnswerUpdate
}: ClinicalCaseQuestionProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, any>>(userAnswers);
  const [questionResults, setQuestionResults] = useState<Record<string, boolean | 'partial'>>(answerResults);
  const [isCaseComplete, setIsCaseComplete] = useState(isAnswered);
  const [showResults, setShowResults] = useState(isAnswered);
  const [showCaseDialog, setShowCaseDialog] = useState(false);
  const [groupPinned, setGroupPinned] = useState(false);
  const [groupHidden, setGroupHidden] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingHidden, setIsTogglingHidden] = useState(false);
  const [showNotesArea, setShowNotesArea] = useState(false);
  const [notesHasContent, setNotesHasContent] = useState(false); // track if notes have content
  const [notesManuallyControlled, setNotesManuallyControlled] = useState(false); // track if user manually opened/closed notes
  // Evaluation phase state (after submission)
  const [evaluationOrder, setEvaluationOrder] = useState<string[]>([]); // ordered list of open question ids needing evaluation
  const [evaluationIndex, setEvaluationIndex] = useState<number>(0); // current evaluation pointer
  const [evaluationComplete, setEvaluationComplete] = useState<boolean>(false);
  // Answering phase active question pointer (for keyboard shortcuts and blue frame)
  const [activeIndex, setActiveIndex] = useState<number>(0);
  // All questions are visible from the start; Enter navigates to next unanswered (like QROC)
  const [revealIndex, setRevealIndex] = useState<number>(clinicalCase.questions.length - 1);
  // Removed per-question submission; single global submit after all questions answered

  // Auto-show notes when content is detected, but don't auto-hide when content is deleted
  // Only auto-show if user hasn't manually controlled the notes area
  useEffect(() => {
    if (notesHasContent && !showNotesArea && !notesManuallyControlled) {
      setShowNotesArea(true);
    }
    // Don't auto-hide when content becomes empty - let user manually close
  }, [notesHasContent, showNotesArea, notesManuallyControlled]);

  // Auto-show notes area if clinical case has existing notes on mount
  // Only run if user hasn't manually controlled notes
  useEffect(() => {
    if (!notesManuallyControlled && !showNotesArea) {
      // Check if clinical case has notes by looking at the notes content
      // The QuestionNotes component will handle fetching and setting notesHasContent
      // This effect runs after the QuestionNotes component has had a chance to load
      setTimeout(() => {
        console.log('ClinicalCaseQuestion - Auto-show check:', { notesHasContent, showNotesArea, notesManuallyControlled });
        if (notesHasContent && !notesManuallyControlled) {
          console.log('ClinicalCaseQuestion - Auto-showing notes area');
          setShowNotesArea(true);
        }
      }, 100);
    }
  }, [notesHasContent, notesManuallyControlled, showNotesArea]);

  // Keep notes area visible even when content is deleted, but only if manually controlled
  useEffect(() => {
    if (notesHasContent === false && showNotesArea && notesManuallyControlled) {
      // Notes area is already visible and user manually opened it, keep it visible even with no content
      // This ensures users can still see the modify button
    }
  }, [notesHasContent, showNotesArea, notesManuallyControlled]);
  const [openCaseEdit, setOpenCaseEdit] = useState(false);
  const [openGroupQrocEdit, setOpenGroupQrocEdit] = useState(false);
  const [openGroupMcqEdit, setOpenGroupMcqEdit] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportTargetQuestion, setReportTargetQuestion] = useState<Question | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Debug logging for displayMode and question type detection
  console.log('ClinicalCaseQuestion - Props:', {
    displayMode,
    clinicalCase: {
      caseNumber: clinicalCase.caseNumber,
      questions: clinicalCase.questions.map(q => ({ id: q.id, type: (q as any).type }))
    }
  });

  // Count only non-empty answers for progress (arrays with length, non-empty strings, or truthy values)
  const answeredQuestions = clinicalCase.questions.reduce((count, q) => {
    const a = answers[q.id];
    if (Array.isArray(a)) return count + (a.length > 0 ? 1 : 0);
    if (typeof a === 'string') return count + (a.trim().length > 0 ? 1 : 0);
    return count + (a !== undefined && a !== null ? 1 : 0);
  }, 0);
  const progress = (answeredQuestions / clinicalCase.totalQuestions) * 100;

  useEffect(() => {
    if (!isAnswered) {
      setAnswers({});
      setQuestionResults({});
      setIsCaseComplete(false);
      setShowResults(false);
      // Always show all questions (no progressive reveal)
      setRevealIndex(clinicalCase.questions.length - 1);
      // Reset active question to the first unanswered (or 0)
      const firstUnanswered = clinicalCase.questions.findIndex(q => userAnswers[q.id] === undefined);
      setActiveIndex(firstUnanswered !== -1 ? firstUnanswered : 0);
    }
  }, [clinicalCase.caseNumber, isAnswered, displayMode, clinicalCase.questions.length]);

  // Always reset scroll to top when a clinical case loads (avoid starting mid-page)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use rAF to run after layout for consistency
      requestAnimationFrame(() => {
        if (window.scrollY > 0) {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      });
    }
  }, [clinicalCase.caseNumber]);

  // Removed progressive reveal focus effect; we focus first unanswered on mount instead

  useEffect(() => {
    const fetchPinned = async () => {
      try {
        if (!user?.id) return;
        const res = await fetch(`/api/pinned-questions?userId=${user.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const pinnedSet = new Set(data.map((d: any) => d.questionId));
        const anyPinned = clinicalCase.questions.some(q => pinnedSet.has(q.id));
        setGroupPinned(anyPinned);
      } catch {}
    };
    fetchPinned();
    const allHidden = clinicalCase.questions.every(q => (q as any).hidden);
    setGroupHidden(allHidden);
  }, [clinicalCase.questions, user?.id]);

  const toggleGroupPin = async () => {
    if (!user?.id) return;
    try {
      for (const q of clinicalCase.questions) {
        if (!groupPinned) {
          await fetch('/api/pinned-questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, questionId: q.id }) });
        } else {
          await fetch(`/api/pinned-questions?userId=${user.id}&questionId=${q.id}`, { method: 'DELETE' });
        }
      }
      setGroupPinned(!groupPinned);
    } catch {}
  };

  const toggleGroupHidden = async () => {
    if (!(user?.role === 'admin' || user?.role === 'maintainer')) return;
    setIsTogglingHidden(true);
    try {
      for (const q of clinicalCase.questions) {
        await fetch(`/api/questions/${q.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ hidden: !groupHidden }) });
      }
      setGroupHidden(!groupHidden);
    } catch {}
    setIsTogglingHidden(false);
  };

  const handleDeleteGroup = async () => {
    if (!user?.role || user.role !== 'admin') return;
    if (!confirm('Supprimer tout le cas clinique (toutes les sous-questions) ?')) return;
    setIsDeleting(true);
    try {
      for (const q of clinicalCase.questions) {
        await fetch(`/api/questions/${q.id}`, { method: 'DELETE', credentials: 'include' });
      }
      window.location.reload();
    } catch {
      setIsDeleting(false);
    }
  };

  const scrollToNextQuestion = (currentQuestionId: string, updatedAnswers: Record<string, any>) => {
    const currentIndex = clinicalCase.questions.findIndex(q => q.id === currentQuestionId);
    for (let i = currentIndex + 1; i < clinicalCase.questions.length; i++) {
      const nextQuestion = clinicalCase.questions[i];
      if (updatedAnswers[nextQuestion.id] === undefined) {
        const element = questionRefs.current[nextQuestion.id];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
          // Focus the first input in the next question after scrolling
          setTimeout(() => {
            const firstInput = element.querySelector('input[type="radio"], textarea') as HTMLElement;
            if (firstInput) {
              firstInput.focus();
            }
          }, 500);
        }
        break;
      }
    }
  };

  // Utility: focus first input of a question
  const focusFirstInput = (questionId: string) => {
    const element = questionRefs.current[questionId];
    if (!element) return;
    
    // Try multiple selectors to find the first input
    const selectors = [
      'input[type="radio"]:not(:disabled)',
      'textarea:not(:disabled)',
      'input:not(:disabled)',
      'button:not(:disabled)'
    ];
    
    for (const selector of selectors) {
      const firstInput = element.querySelector(selector) as HTMLElement;
      if (firstInput) {
        firstInput.focus();
        return;
      }
    }
  };

  // On mount (or case change) focus first unanswered question and set active index
  useEffect(() => {
    if (clinicalCase.questions.length > 0 && !showResults) {
      // Find first unanswered question
      const firstUnanswered = clinicalCase.questions.find(q => answers[q.id] === undefined);
      const targetId = firstUnanswered?.id || clinicalCase.questions[0].id;
      const targetIndex = firstUnanswered ? clinicalCase.questions.findIndex(q => q.id === firstUnanswered.id) : 0;
      setActiveIndex(targetIndex);
      
      // Scroll to first unanswered question and focus it
      setTimeout(() => {
        const element = questionRefs.current[targetId];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => focusFirstInput(targetId), 100);
        }
      }, 100);
    }
  }, [clinicalCase.caseNumber, showResults]);

  const handleQuestionAnswer = (questionId: string, answer: any, result?: boolean | 'partial') => {
    const wasAnswered = answers[questionId] !== undefined;
    setAnswers(prev => {
      const next = { ...prev } as Record<string, any>;
      // If the answer is empty (cleared), remove the key so progress reflects it
      const isEmpty = (Array.isArray(answer) && answer.length === 0) || (typeof answer === 'string' && answer.trim().length === 0);
      if (isEmpty) {
        delete next[questionId];
      } else {
        next[questionId] = answer;
      }
      return next;
    });
    if (result !== undefined) {
      setQuestionResults(prev => ({ ...prev, [questionId]: result }));
    }
    
    // Propagate to parent for global progress/state (works for MCQ and open)
    if (onAnswerUpdate) {
      try { onAnswerUpdate(questionId, answer, result); } catch {}
    }
  };

  const handleCompleteCase = () => {
    setIsCaseComplete(true);
    setShowResults(true); // enter evaluation phase (results visible)
    // Build evaluation order (only open questions that require self assessment)
    const openIds = clinicalCase.questions
      .filter(q => (q.type as any) === 'clinic_croq')
      .map(q => q.id);
    setEvaluationOrder(openIds);
    setEvaluationIndex(0);
    setEvaluationComplete(openIds.length === 0); // if no open questions, evaluation instantly complete
    onSubmit(clinicalCase.caseNumber, answers, questionResults); // results will be updated as user evaluates
    // Always scroll to top after submit per request (then user can scroll down to evaluate)
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 120);
  };
  // Allow resubmission: keep current answers, hide results, reset evaluation state and per-question results
  const handleResubmit = () => {
    setIsCaseComplete(false);
    setShowResults(false);
    setEvaluationOrder([]);
    setEvaluationIndex(0);
    setEvaluationComplete(false);
    // Clear previous results AND answers so restart is clean (no pre-picked options)
    setQuestionResults({});
    setAnswers({});
    // Scroll to first unanswered (or first question if all answered)
    setTimeout(() => {
      const firstUnanswered = clinicalCase.questions.find(q => answers[q.id] === undefined);
      const targetId = firstUnanswered?.id || clinicalCase.questions[0]?.id;
      if (targetId) {
        const el = questionRefs.current[targetId];
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => focusFirstInput(targetId), 150);
      }
    }, 50);
  };
  const handleShowResults = () => setShowResults(true);
  const handleSelfAssessmentUpdate = (questionId: string, result: boolean | 'partial') => {
    setQuestionResults(prev => ({ ...prev, [questionId]: result }));
    if (onAnswerUpdate) {
      const userAnswer = answers[questionId];
      onAnswerUpdate(questionId, userAnswer, result);
    }
    if (showResults && !evaluationComplete) {
      const currentId = evaluationOrder[evaluationIndex];
      if (currentId === questionId) {
        // Advance to next unanswered
        for (let i = evaluationIndex + 1; i < evaluationOrder.length; i++) {
          const id = evaluationOrder[i];
          if (id !== questionId && questionResults[id] === undefined) {
            setEvaluationIndex(i);
            return;
          }
        }
        // If none left after this update, mark complete
        const remaining = evaluationOrder.filter(id => id !== questionId && questionResults[id] === undefined);
        if (remaining.length === 0) setEvaluationComplete(true);
      }
    }
  };

  // Scroll to current evaluation question when evaluation index changes
  useEffect(() => {
    if (!showResults || evaluationComplete) return;
    const currentEvalId = evaluationOrder[evaluationIndex];
    if (!currentEvalId) return;
    const element = questionRefs.current[currentEvalId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Focus nothing specific to avoid accidental typing; user uses 1/2/3
    }
  }, [evaluationIndex, evaluationOrder, showResults, evaluationComplete]);

  // Keyboard navigation: Answer phase only (Enter to jump to next unanswered and set active), Evaluation phase disabled
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow typing in inputs/textarea/contentEditable
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const type = (target as HTMLInputElement | undefined)?.type;
      const isEditable = !!target && ((target as any).isContentEditable === true);
      const isTextInput = tag === 'TEXTAREA' || (tag === 'INPUT' && type && !['radio','checkbox','button','submit'].includes(type!));

      // Evaluation phase - disable navigation shortcuts but don't block normal typing
      if (showResults) {
        return;
      }

      // Answering phase - controlled progression through questions
      if (!showResults && e.key === 'Enter' && !e.shiftKey) {
        // Don't hijack Enter from text inputs
        if (isTextInput || isEditable) return;
        e.preventDefault();
        // Find next unanswered after the current active index
        const total = clinicalCase.questions.length;
        let nextIdx = -1;
        for (let i = activeIndex + 1; i < total; i++) {
          const q = clinicalCase.questions[i];
          if (answers[q.id] === undefined) { nextIdx = i; break; }
        }
        if (nextIdx === -1) {
          // None after; look from start
          for (let i = 0; i < total; i++) {
            const q = clinicalCase.questions[i];
            if (answers[q.id] === undefined) { nextIdx = i; break; }
          }
        }
        if (nextIdx !== -1) {
          setActiveIndex(nextIdx);
          const targetQuestion = clinicalCase.questions[nextIdx];
          const el = questionRefs.current[targetQuestion.id];
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => focusFirstInput(targetQuestion.id), 250);
          }
        } else {
          // All questions answered, submit
          handleCompleteCase();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [answers, activeIndex, isCaseComplete, showResults, evaluationOrder, evaluationIndex, evaluationComplete, clinicalCase.questions, clinicalCase.totalQuestions]);
  const getQuestionStatus = (question: Question) => {
    if (answers[question.id] !== undefined) {
      if (showResults) {
        const result = questionResults[question.id];
        if (result === true) return 'correct';
        if (result === 'partial') return 'partial';
        if (result === false) return 'incorrect';
        return 'pending'; // awaiting evaluation
      }
      return 'answered';
    }
    return 'unanswered';
  };
  const renderQuestion = (question: Question, index: number) => {
    const isAnsweredQ = answers[question.id] !== undefined;
    const answerResultQ = questionResults[question.id];
    const userAnswerQ = answers[question.id];
  const isCurrentEvaluationTarget = showResults && !evaluationComplete && evaluationOrder[evaluationIndex] === question.id;
  const isActiveAnswerTarget = !showResults && index === activeIndex;
    const hasEvaluation = showResults && (question.type as any) === 'clinic_croq' && questionResults[question.id] !== undefined;
    
  // Progressive reveal removed; all questions visible from start
    
    const evaluationLabel = hasEvaluation
      ? questionResults[question.id] === true
        ? 'Correct'
        : questionResults[question.id] === 'partial'
          ? 'Partiel'
          : 'Incorrect'
      : undefined;
    const evaluationColor = hasEvaluation
      ? questionResults[question.id] === true
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        : questionResults[question.id] === 'partial'
          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : 'bg-muted text-muted-foreground';
    // Check if this is a question that should use inline layout (compact design)
    const isInlineLayout = (question.type as any) === 'clinic_croq' || 
                          (displayMode === 'multi_qroc' && (question.type as any) === 'clinic_croq');
    
    return (
      <div
        key={question.id}
        ref={el => { questionRefs.current[question.id] = el; }}
        className={`${
          // Remove white container around open questions during results to avoid extra box
          (showResults && (question.type as any) === 'clinic_croq')
            ? 'transition-all duration-200 rounded-none border-0 p-0 bg-transparent shadow-none'
            : 'border rounded-xl p-3 bg-card shadow-sm transition-all duration-200'
        } ${(isCurrentEvaluationTarget || isActiveAnswerTarget) ? 'ring-2 ring-blue-500 shadow-md' : ''}`}
        data-question-id={question.id}
        tabIndex={0}
        onClick={() => {
          if (!showResults) {
            setActiveIndex(index);
            // Focus the container, then move focus to first input
            setTimeout(() => {
              questionRefs.current[question.id]?.focus?.();
              focusFirstInput(question.id);
            }, 50);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            if (!showResults) {
              const firstUnansweredIndex = clinicalCase.questions.findIndex(q => answers[q.id] === undefined);
              if (firstUnansweredIndex !== -1) {
                setActiveIndex(firstUnansweredIndex);
                const targetQuestion = clinicalCase.questions[firstUnansweredIndex];
                const element = questionRefs.current[targetQuestion.id];
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setTimeout(() => focusFirstInput(targetQuestion.id), 300);
                }
              } else {
                handleCompleteCase();
                setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 120);
              }
            } else {
              // In results phase, Enter moves to next when allowed
              if (evaluationComplete || evaluationOrder.length === 0) {
                onNext();
              }
            }
          }
        }}
      >
        {isInlineLayout ? (
          // Inline layout for compact questions: question number and question content on same line
          <div className="flex items-start gap-3 mb-1">
            <span
              className={
                'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide flex-shrink-0 ' +
                (!showResults
                  ? (isAnsweredQ ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 
                     'bg-muted text-muted-foreground')
                  : isAnsweredQ
                    ? answerResultQ === true
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : answerResultQ === 'partial'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                        : answerResultQ === false
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-muted text-muted-foreground')
              }
            >
              {index + 1}
            </span>
            <div className="w-full">
              {/* Question text line with natural width and evaluation indicator */}
              <div className="flex items-start flex-wrap gap-2 mb-1">
                <div className="-mt-1 inline-block">
                  {/* Just render the question text here inline */}
                  {((question.type as any) === 'clinic_croq' || (displayMode === 'multi_qroc' && (question.type as any) === 'clinic_croq')) && (
                    <div className="inline-block">
                      <span className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                        {question.text}
                      </span>
                    </div>
                  )}
                </div>
                {/* Removed inline textual evaluation label for QROC after evaluation per request */}
                {showResults && ((question.type as any) === 'clinic_croq' || (displayMode === 'multi_qroc' && (question.type as any) === 'clinic_croq')) && isCurrentEvaluationTarget && !hasEvaluation && (
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 font-medium text-xs">
                      Évaluer
                    </span>
                  </div>
                )}
              </div>
              
              {/* Full-width components container */}
              <div className="w-full">
                {question.type === 'clinic_mcq' ? (
                  <MCQQuestion
                    question={question}
                    onSubmit={(answer, isCorrect) => handleQuestionAnswer(question.id, answer, isCorrect)}
                    onAnswerChange={(answer, isCorrect) => handleQuestionAnswer(question.id, answer, isCorrect)}
                    onNext={() => {}}
                    lectureId={lectureId}
                    lectureTitle={lectureTitle}
                    specialtyName={specialtyName}
                    isAnswered={showResults ? isAnsweredQ : false}
                    answerResult={showResults ? answerResultQ : undefined}
                    userAnswer={userAnswerQ as any}
                    hideImmediateResults={!showResults}
                    hideActions
                    hideNotes={!showResults}
                    hideComments={true}
                    highlightConfirm
                    hideMeta
                    suppressReminder={true}
                    enableOptionHighlighting={true}
                    disableKeyboardHandlers={false}
                    allowEnterSubmit={false}
                    isActive={index === activeIndex}
                  />
                ) : (
                  <OpenQuestion
                    question={{...question, text: ''}} // Empty text since we render it above
                    onSubmit={(answer, resultValue) => handleQuestionAnswer(question.id, answer, resultValue)}
                    onAnswerChange={(answer, hasAnswer) => {
                      handleQuestionAnswer(question.id, answer);
                    }}
                    onNext={() => {}}
                    lectureId={lectureId}
                    lectureTitle={lectureTitle}
                    specialtyName={specialtyName}
                    isAnswered={showResults ? isAnsweredQ : false}
                    answerResult={showResults ? answerResultQ : undefined}
                    userAnswer={userAnswerQ as any}
                    hideImmediateResults={!showResults}
                    disableIndividualSubmit={!showResults}
                    showDeferredSelfAssessment={
                      showResults &&
                      (question.type as any) === 'clinic_croq' &&
                      !evaluationComplete &&
                      evaluationOrder[evaluationIndex] === question.id
                    }
                    onSelfAssessmentUpdate={handleSelfAssessmentUpdate}
                    hideNotes={true}
                    hideComments={true}
                    hideActions
                    highlightConfirm
                    hideMeta={true}
                    suppressReminder={true}
                    enableAnswerHighlighting={true}
                  />
                )}
              </div>
            </div>
            {isAnsweredQ && (
              <span className="inline-flex items-center flex-shrink-0">
                {showResults ? (
                  <>
                    {answerResultQ === true && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {answerResultQ === 'partial' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                    {answerResultQ === false && <AlertCircle className="h-4 w-4 text-red-600" />}
                  </>
                ) : (
                  <Circle className="h-4 w-4 text-blue-600" />
                )}
              </span>
            )}
          </div>
        ) : (
          // Standard layout for MCQ questions: question number above, content below  
          <>
            <div className="flex items-center mb-2">
              <span
                className={
                  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ' +
                  (!showResults
                    ? (isAnsweredQ ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 
                       'bg-muted text-muted-foreground')
                    : isAnsweredQ
                      ? answerResultQ === true
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : answerResultQ === 'partial'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : answerResultQ === false
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-muted text-muted-foreground')
                }
              >
                Question {index + 1}
              </span>
              {isAnsweredQ && (
                <span className="ml-auto inline-flex items-center">
                  {showResults ? (
                    <>
                      {answerResultQ === true && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {answerResultQ === 'partial' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                      {answerResultQ === false && <AlertCircle className="h-4 w-4 text-red-600" />}
                    </>
                  ) : (
                    <Circle className="h-4 w-4 text-blue-600" />
                  )}
                </span>
              )}
            </div>
          </>
        )}
        {!isInlineLayout && (
          <>
            {question.type === 'clinic_mcq' ? (
              <MCQQuestion
                question={question}
                onSubmit={(answer, isCorrect) => handleQuestionAnswer(question.id, answer, isCorrect)}
                // Track answers live for group-level submission; no per-question Next
                onAnswerChange={(answer, isCorrect) => handleQuestionAnswer(question.id, answer, isCorrect)}
                onNext={() => {}}
                lectureId={lectureId}
                lectureTitle={lectureTitle}
                specialtyName={specialtyName}
                // Before group submit, keep UI in answering mode (no answered state)
                isAnswered={showResults ? isAnsweredQ : false}
                answerResult={showResults ? answerResultQ : undefined}
                userAnswer={userAnswerQ as any}
                // Hide immediate results until the whole group is submitted
                hideImmediateResults={!showResults}
                // Hide per-question actions; we submit once for all
                hideActions
                hideNotes={!showResults}
                hideComments={true} // Always hide individual question comments in clinical cases
                highlightConfirm
                hideMeta
                suppressReminder={true}
                enableOptionHighlighting={true}
                disableKeyboardHandlers={false}
                allowEnterSubmit={false}
                isActive={index === activeIndex}
              />
            ) : (
              <OpenQuestion
                question={question}
                onSubmit={(answer, resultValue) => handleQuestionAnswer(question.id, answer, resultValue)}
                onAnswerChange={(answer, hasAnswer) => {
                  // Record answer only (no provisional result). Evaluation happens later.
                  handleQuestionAnswer(question.id, answer);
                }}
                onNext={() => {}}
                lectureId={lectureId}
                lectureTitle={lectureTitle}
                specialtyName={specialtyName}
                isAnswered={showResults ? isAnsweredQ : false}
                answerResult={showResults ? answerResultQ : undefined}
                userAnswer={userAnswerQ as any}
                hideImmediateResults={!showResults}
                disableIndividualSubmit={!showResults}
                showDeferredSelfAssessment={
                  showResults &&
                  (question.type as any) === 'clinic_croq' &&
                  !evaluationComplete &&
                  evaluationOrder[evaluationIndex] === question.id
                }
                onSelfAssessmentUpdate={handleSelfAssessmentUpdate}
                hideNotes={!showResults}
                hideComments={true} // Always hide individual question comments in clinical cases
                hideActions
                highlightConfirm
                hideMeta
                suppressReminder={true} // Hide "Rappel du cours" in clinical cases
                enableAnswerHighlighting={true} // Enable highlighting for user answers
              />
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div 
      className="space-y-2 w-full max-w-full" 
      data-clinical-case
    >
      <Card>
        <CardContent className="pt-6">
          {clinicalCase.caseText && (
            <div className="mb-4">
              <div className="text-lg sm:text-xl leading-relaxed whitespace-pre-wrap text-foreground font-medium">
                <HighlightableCaseText lectureId={lectureId} text={clinicalCase.caseText} className="break-words" />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-4">
            {clinicalCase.questions.map((question, index) => {
              const status = getQuestionStatus(question);
              return (
                <div key={question.id} className="flex items-center gap-1 px-2 py-1 rounded text-xs">
                  {status === 'correct' && <CheckCircle className="h-3 w-3 text-green-600" />}
                  {status === 'partial' && <AlertCircle className="h-3 w-3 text-yellow-600" />}
                  {status === 'incorrect' && <AlertCircle className="h-3 w-3 text-red-600" />}
                  {status === 'answered' && <Circle className="h-3 w-3 text-blue-600" />}
                  {status === 'unanswered' && <Circle className="h-3 w-3 text-muted-foreground" />}
                  <span className={status === 'unanswered' ? 'text-muted-foreground' : ''}>{index + 1}</span>
                </div>
              );
            })}
          </div>
          {/* Progressive reveal hint removed */}
        </CardContent>
      </Card>

      {(() => {
        const hasOpen = clinicalCase.questions.some(q => (q.type as any) === 'clinic_croq');
        return (
      <Card>
        <CardContent>
          <div className="space-y-6 mt-6">
            {clinicalCase.questions.map((question, index) => {
              const isCurrentEval = showResults && !evaluationComplete && (question.type as any) === 'clinic_croq' && evaluationOrder[evaluationIndex] === question.id;
              
              return (
                <div key={question.id} className={cn(
                  'transition-all duration-300',
                  isCurrentEval ? 'ring-2 ring-blue-500 rounded-lg transition-shadow' : ''
                )}>
                  {renderQuestion(question, index)}
                  {/* Removed post-evaluation textual status (Correct/Partiel/Incorrect) for QROC */}
                </div>
              );
            })}
          </div>
          <div className="mt-8 space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
               {/* Progress / status */}
              <div className="text-sm text-muted-foreground">
                {!showResults && (
                  answeredQuestions === clinicalCase.totalQuestions
                    ? 'Toutes les réponses saisies — Soumettre pour valider'
                    : `${clinicalCase.totalQuestions - answeredQuestions} question(s) restante(s) — répondez puis Soumettre`
                )}
                {hasOpen && showResults && !evaluationComplete && `Phase d'évaluation: ${evaluationOrder.filter(id => questionResults[id] !== undefined).length}/${evaluationOrder.length} évaluées`}
                {hasOpen && showResults && evaluationComplete && 'Évaluation terminée'}
                {!hasOpen && showResults && 'Révision terminée'}
              </div>

              <div className="flex gap-2 flex-wrap justify-end items-center">
                {/* Group submit: shown for any grouped block (MCQ or open) */}
                {!showResults && (
                  <Button
                    onClick={handleCompleteCase}
                    size="sm"
                    disabled={answeredQuestions !== clinicalCase.totalQuestions || isCaseComplete}
                    className={`font-semibold ${answeredQuestions === clinicalCase.totalQuestions && !isCaseComplete ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600/50 text-white cursor-not-allowed'}`}
                  >Soumettre la réponse</Button>
                )}

                {/* Result display and action buttons when submitted */}
                {showResults && (
                  <div className="flex items-center gap-2">
                    {/* Result display */}
                    <div className="flex items-center">
                      {(() => {
                        const overallResult = (() => {
                          if (!hasOpen) {
                            // For MCQ-only cases, use the case-level result
                            return answerResult;
                          } else {
                            // For cases with open questions, check if evaluation is complete
                            if (evaluationComplete) {
                              const correctCount = Object.values(questionResults).filter(r => r === true).length;
                              const totalCount = Object.keys(questionResults).length;
                              if (correctCount === totalCount) return true;
                              if (correctCount > 0) return 'partial';
                              return false;
                            }
                            return null;
                          }
                        })();

                        if (overallResult === true) {
                          return (
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="h-5 w-5 mr-2" />
                              <span className="font-medium">Correcte!</span>
                            </div>
                          );
                        } else if (overallResult === 'partial') {
                          return (
                            <div className="flex items-center text-yellow-600">
                              <AlertCircle className="h-5 w-5 mr-2" />
                              <span className="font-medium">Partiellement correcte</span>
                            </div>
                          );
                        } else if (overallResult === false) {
                          return (
                            <div className="flex items-center text-red-600">
                              <XCircle className="h-5 w-5 mr-2" />
                              <span className="font-medium">Incorrecte</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Resubmit button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResubmit}
                      className="flex items-center gap-1"
                    >
                      Soumettre à nouveau
                    </Button>

                    {/* Notes toggle: positioned before next button like in MCQActions */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newShowNotesArea = !showNotesArea;
                        setShowNotesArea(newShowNotesArea);
                        setNotesManuallyControlled(true);
                        if (newShowNotesArea) {
                          setTimeout(() => {
                            document.getElementById(`clinical-case-notes-${clinicalCase.caseNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 30);
                        }
                      }}
                      className="flex items-center gap-1"
                    >
                      <StickyNote className="h-4 w-4" />
                      <span className="hidden sm:inline">{showNotesArea ? 'Fermer les notes' : 'Mes notes'}</span>
                    </Button>

                    {/* Next button: only show when evaluation is complete for open questions */}
                    {(!hasOpen || evaluationComplete) && (
                      <Button onClick={onNext} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                        Question suivante
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {(hasOpen || displayMode === 'multi_qcm') && (
            <div id={`clinical-case-notes-${clinicalCase.caseNumber}`} className="space-y-6">
              <div className={showNotesArea ? "" : "hidden"}>
                <QuestionNotes
                  questionId={`clinical-case-${clinicalCase.caseNumber}`}
                  onHasContentChange={setNotesHasContent}
                  autoEdit={!notesHasContent && !notesManuallyControlled}
                  questionType="clinical-case"
                />
              </div>
              {isCaseComplete && (
                <QuestionComments questionId={displayMode === 'multi_qroc' ? `group-qroc-${clinicalCase.caseNumber}` : displayMode === 'multi_qcm' ? `group-qcm-${clinicalCase.caseNumber}` : `clinical-case-${clinicalCase.caseNumber}`} />
              )}
            </div>)}
          </div>
        </CardContent>
      </Card>
        );
      })()}

      <Dialog open={showCaseDialog} onOpenChange={setShowCaseDialog}>
        <DialogTrigger asChild>
          <Button variant="default" size="sm" className="fixed bottom-6 left-6 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50 bg-blue-600 hover:bg-blue-700" aria-label="Voir le texte du cas clinique">
            <FileText className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {displayMode === 'multi_qcm'
                ? `Multi QCM ${clinicalCase.caseNumber}`
                : displayMode === 'multi_qroc'
                  ? `Multi QROC ${clinicalCase.caseNumber}`
                  : `Cas Clinique ${clinicalCase.caseNumber}`}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 prose max-w-none text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            <HighlightableCaseText lectureId={lectureId} text={clinicalCase.caseText} />
          </div>
        </DialogContent>
      </Dialog>
      {openCaseEdit && (
        <ClinicalCaseEditDialog
          caseNumber={clinicalCase.caseNumber}
          questions={clinicalCase.questions}
          isOpen={openCaseEdit}
          onOpenChange={setOpenCaseEdit}
          onSaved={() => { try { window.location.reload(); } catch {} }}
        />
      )}
      {openGroupQrocEdit && (
        <GroupedQrocEditDialog
          caseNumber={clinicalCase.caseNumber}
          questions={clinicalCase.questions}
          isOpen={openGroupQrocEdit}
          onOpenChange={setOpenGroupQrocEdit}
          onSaved={() => { try { window.location.reload(); } catch {} }}
        />
      )}
      {openGroupMcqEdit && (
        <GroupedMcqEditDialog
          caseNumber={clinicalCase.caseNumber}
          questions={clinicalCase.questions}
          isOpen={openGroupMcqEdit}
          onOpenChange={setOpenGroupMcqEdit}
          onSaved={() => { try { window.location.reload(); } catch {} }}
        />
      )}
      {reportTargetQuestion && (
        <ReportQuestionDialog
          question={reportTargetQuestion}
          lectureId={lectureId}
          isOpen={isReportDialogOpen}
          onOpenChange={(open) => setIsReportDialogOpen(open)}
        />
      )}
    </div>
  );
}