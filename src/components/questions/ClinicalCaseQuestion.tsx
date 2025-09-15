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
import { CheckCircle, Circle, AlertCircle, Eye, FileText, Pin, PinOff, EyeOff, Trash2, Pencil, StickyNote, ChevronRight, Flag } from 'lucide-react';
import { ReportQuestionDialog } from './ReportQuestionDialog';
import { HighlightableCaseText } from './HighlightableCaseText';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import { ClinicalCaseEditDialog } from './edit/ClinicalCaseEditDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface ClinicalCaseQuestionProps {
  clinicalCase: ClinicalCase;
  onSubmit: (caseNumber: number, answers: Record<string, any>, results: Record<string, boolean | 'partial'>) => void;
  onNext: () => void;
  lectureId: string;
  lectureTitle?: string;
  specialtyName?: string;
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
  // Evaluation phase state (after submission)
  const [evaluationOrder, setEvaluationOrder] = useState<string[]>([]); // ordered list of open question ids needing evaluation
  const [evaluationIndex, setEvaluationIndex] = useState<number>(0); // current evaluation pointer
  const [evaluationComplete, setEvaluationComplete] = useState<boolean>(false);

  // Auto-close notes when content becomes empty
  useEffect(() => {
    if (!notesHasContent) {
      setShowNotesArea(false);
    }
  }, [notesHasContent]);
  const [openCaseEdit, setOpenCaseEdit] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportTargetQuestion, setReportTargetQuestion] = useState<Question | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const answeredQuestions = Object.keys(answers).length;
  const progress = (answeredQuestions / clinicalCase.totalQuestions) * 100;

  useEffect(() => {
    if (!isAnswered) {
      setAnswers({});
      setQuestionResults({});
      setIsCaseComplete(false);
      setShowResults(false);
    }
  }, [clinicalCase.caseNumber, isAnswered]);

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

  // On mount (or case change) focus first question
  useEffect(() => {
    if (clinicalCase.questions.length > 0 && !showResults) {
      // Find first unanswered question
      const firstUnanswered = clinicalCase.questions.find(q => answers[q.id] === undefined);
      const targetId = firstUnanswered?.id || clinicalCase.questions[0].id;
      
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
      const newAnswers = { ...prev, [questionId]: answer };
      return newAnswers;
    });
    if (result !== undefined) {
      setQuestionResults(prev => ({ ...prev, [questionId]: result }));
    }
  };

  const handleCompleteCase = () => {
    setIsCaseComplete(true);
    setShowResults(true); // enter evaluation phase (results visible)
    // Build evaluation order (only open questions that require self assessment)
    const openIds = clinicalCase.questions
      .filter(q => q.type === 'clinic_croq')
      .map(q => q.id);
    setEvaluationOrder(openIds);
    setEvaluationIndex(0);
    setEvaluationComplete(openIds.length === 0); // if no open questions, evaluation instantly complete
    onSubmit(clinicalCase.caseNumber, answers, questionResults); // results will be updated as user evaluates
    
    // Scroll to first evaluation question after a brief delay, or to top if no evaluation needed
    setTimeout(() => {
      if (openIds.length > 0) {
        const firstEvalId = openIds[0];
        const element = questionRefs.current[firstEvalId];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        // If no evaluation needed, scroll to top of case
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 300);
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

  // Keyboard navigation: Answer phase (Enter to advance), Evaluation phase disabled (no keyboard shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Evaluation phase key handling - DISABLED to remove 1/2/3 shortcuts
      if (showResults && !evaluationComplete) {
        // Disable all number keys for evaluation - user must click buttons
        if (["1", "2", "3"].includes(e.key)) {
          // No longer handle 1/2/3 shortcuts
          e.preventDefault();
          return;
        } else if (e.key === 'Enter') {
          // Enter disabled during evaluation selection
          e.preventDefault();
        }
        return; // stop further processing during evaluation phase
      }

      // After evaluation complete & results shown: Enter -> next case
      if (showResults && evaluationComplete) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onNext();
        }
        return;
      }

      // Answering phase
      if (!showResults && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        
        // If all questions answered, submit
        if (answeredQuestions === clinicalCase.totalQuestions) {
          handleCompleteCase();
          return;
        }
        
        // Find next unanswered question in order
        const nextUnanswered = clinicalCase.questions.find(q => answers[q.id] === undefined);
        
        if (nextUnanswered) {
          const element = questionRefs.current[nextUnanswered.id];
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => focusFirstInput(nextUnanswered.id), 300);
          }
        } else if (answeredQuestions === clinicalCase.totalQuestions) {
          // Fallback: if somehow all are answered, submit
          handleCompleteCase();
        }
      }
    };    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [answers, answeredQuestions, isCaseComplete, showResults, evaluationOrder, evaluationIndex, evaluationComplete, clinicalCase.questions, clinicalCase.totalQuestions]);
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
    const answerResultQ = showResults ? questionResults[question.id] : undefined;
    const userAnswerQ = answers[question.id];
    const isCurrentEvaluationTarget = showResults && !evaluationComplete && evaluationOrder[evaluationIndex] === question.id;
    const hasEvaluation = showResults && question.type === 'clinic_croq' && questionResults[question.id] !== undefined;
    
    // Check if this is the next question to answer (first unanswered)
    const isNextToAnswer = !showResults && !isAnsweredQ && 
      clinicalCase.questions.findIndex(q => answers[q.id] === undefined) === 
      clinicalCase.questions.findIndex(q => q.id === question.id);
    
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
    return (
      <div
        key={question.id}
        ref={el => { questionRefs.current[question.id] = el; }}
        className={`border rounded-xl p-3 bg-card shadow-sm transition-all duration-200 ${
          isCurrentEvaluationTarget ? 'ring-2 ring-blue-500 shadow-md' : 
          isNextToAnswer ? 'ring-2 ring-orange-500 shadow-md' : ''
        }`}
        data-question-id={question.id}
      >
        <div className="flex items-center mb-2">
          <span
            className={
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ' +
              (!showResults
                ? (isAnsweredQ ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 
                   isNextToAnswer ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
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
            Question {index + 1} {isNextToAnswer && !showResults && '(Suivante)'}
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
        {showResults && question.type === 'clinic_croq' && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            {isCurrentEvaluationTarget && !hasEvaluation && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 font-medium">
                Évaluer
              </span>
            )}
            {hasEvaluation && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${evaluationColor}`}>
                {evaluationLabel}
              </span>
            )}
          </div>
        )}
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
            hideNotes={!showResults} // Notes only after results
            hideComments={true} // Always hide individual question comments in clinical cases
            highlightConfirm
            hideMeta
            suppressReminder={true} // Hide "Rappel du cours" in clinical cases
            enableOptionHighlighting={true} // Enable highlighting for MCQ options
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
            showDeferredSelfAssessment={showResults && question.type === 'clinic_croq'}
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
      </div>
    );
  };

  return (
    <div 
      className="space-y-2 w-full max-w-full" 
      data-clinical-case
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-2 w-full">
            {(() => {
              const firstQuestion = clinicalCase.questions[0];
              const session = firstQuestion?.session;
              
              // Enhanced session formatting to preserve full session information
              const formatSession = (sessionValue?: string) => {
                if (!sessionValue) return '';
                
                // Clean up parentheses and extra spaces
                let cleaned = sessionValue.replace(/^\(|\)$/g, '').trim();
                
                // If already contains "Session", use as-is
                if (/session/i.test(cleaned)) return cleaned;
                
                // If it's just a number or year, format as "Session X"
                if (/^\d+$/.test(cleaned)) return `Session ${cleaned}`;
                
                // If it contains "theme" or other descriptive text, use as-is
                if (/theme|thème/i.test(cleaned)) return cleaned;
                
                // For date formats like "JANVIER 2020", "Juin 2016", etc., prefix with "Session"
                if (/^(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/i.test(cleaned) ||
                    /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i.test(cleaned)) {
                  return `Session ${cleaned}`;
                }
                
                // Otherwise, use as-is (for complex formats)
                return cleaned;
              };

              // Build the metadata line with better structure
              const parts: string[] = [];
              parts.push(`Cas Clinique ${clinicalCase.caseNumber}`);
              
              const formattedSession = formatSession(session);
              if (formattedSession) {
                parts.push(formattedSession);
              }
              
              // Add evaluation status if in results phase
              if (showResults && !evaluationComplete) {
                parts.push(`Phase d'évaluation (${evaluationOrder.filter(id => questionResults[id] !== undefined).length}/${evaluationOrder.length})`);
              } else if (showResults && evaluationComplete) {
                parts.push('Évaluation terminée');
              }
              
              return (
                <div>
                  <div className="flex items-center gap-2 text-sm sm:text-base font-semibold text-foreground dark:text-gray-100">
                    <span className="truncate">{parts.join(' • ')}</span>
                    {groupPinned && <Pin className="h-4 w-4 text-pink-500" />}
                    {groupHidden && <EyeOff className="h-4 w-4 text-red-500" />}
                    {isCaseComplete && showResults && (
                      <span className="flex items-center gap-1">
                        {answerResult === true && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {answerResult === 'partial' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                        {answerResult === false && <AlertCircle className="h-4 w-4 text-red-600" />}
                      </span>
                    )}
                    <span className="ml-auto inline-flex gap-1">
                      <Button variant="outline" size="sm" onClick={toggleGroupPin} className="flex items-center gap-1">
                        {groupPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{groupPinned ? 'Unpin' : 'Pin'}</span>
                      </Button>
                      {(user?.role === 'admin' || user?.role === 'maintainer') && (
                        <Button variant="outline" size="sm" onClick={toggleGroupHidden} disabled={isTogglingHidden} title={groupHidden ? 'Unhide' : 'Hide'}>
                          {groupHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      {(user?.role === 'admin' || user?.role === 'maintainer') && (
                        <Button variant="outline" size="sm" title="Éditer le cas clinique" onClick={() => setOpenCaseEdit(true)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* Report whole clinical case (reports first question id for context) */}
                      <Button
                        variant="outline"
                        size="sm"
                        title="Signaler"
                        onClick={() => {
                          const first = clinicalCase.questions[0];
                          if (first) {
                            setReportTargetQuestion(first);
                            setIsReportDialogOpen(true);
                          }
                        }}
                        className="flex items-center gap-1"
                      >
                        <Flag className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Signaler</span>
                      </Button>
                      {user?.role === 'admin' && (
                        <Button variant="outline" size="sm" className="text-destructive" disabled={isDeleting} onClick={handleDeleteGroup} title="Delete all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </span>
                  </div>
                  {showResults && !evaluationComplete && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Utilisez les touches 1 (Correct), 2 (Partiel), 3 (Incorrect) pour évaluer
                    </div>
                  )}
                  {showResults && evaluationComplete && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Appuyez sur Entrée pour continuer
                    </div>
                  )}
                </div>
              );
            })()}
            {(specialtyName || lectureTitle) && (
              <div className="text-xs sm:text-sm text-muted-foreground">{[specialtyName, lectureTitle].filter(Boolean).join(' • ')}</div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>{answeredQuestions} sur {clinicalCase.totalQuestions} questions répondues</span>
              <span>{Math.round(progress)}% complété</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
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
          {clinicalCase.caseText && (
            <div className="py-6 border-t border-border">
              <div className="text-lg sm:text-xl leading-relaxed whitespace-pre-wrap text-foreground font-medium">
                <HighlightableCaseText lectureId={lectureId} text={clinicalCase.caseText} className="break-words" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="space-y-6 mt-6">
            {clinicalCase.questions.map((question, index) => {
              const isCurrentEval = showResults && !evaluationComplete && question.type === 'clinic_croq' && evaluationOrder[evaluationIndex] === question.id;
              return (
                <div key={question.id} className={isCurrentEval ? 'ring-2 ring-blue-500 rounded-lg transition-shadow' : ''}>
                  {renderQuestion(question, index)}
                  {showResults && question.type === 'clinic_croq' && questionResults[question.id] !== undefined && (
                    <div className="mt-2 text-xs font-medium text-muted-foreground">
                      Votre évaluation: {questionResults[question.id] === true ? 'Correct' : questionResults[question.id] === 'partial' ? 'Partiel' : 'Incorrect'}
                    </div>
                  )}
                  {isCurrentEval && (
                    <div className="mt-2 text-[11px] text-blue-600 dark:text-blue-300 font-medium flex gap-3 flex-wrap">
                      <span>1 = Correct</span>
                      <span>2 = Partiel</span>
                      <span>3 = Incorrect</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-8 space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
              {/* Progress / status */}
              <div className="text-sm text-muted-foreground">
                {!showResults && (answeredQuestions === clinicalCase.totalQuestions
                  ? 'Toutes les réponses saisies - Appuyez sur Entrée pour soumettre'
                  : `${clinicalCase.totalQuestions - answeredQuestions} question(s) restante(s) - Répondez puis appuyez sur Entrée`)}
                {showResults && !evaluationComplete && `Phase d'évaluation: ${evaluationOrder.filter(id => questionResults[id] !== undefined).length}/${evaluationOrder.length} évaluées (1 Correct • 2 Partiel • 3 Incorrect)`}
                {showResults && evaluationComplete && 'Évaluation terminée - Entrée pour continuer'}
              </div>

              <div className="flex gap-2 flex-wrap justify-end items-center">
                {/* Always show submit (disabled until all answered or already submitted) */}
                {!showResults && (
                  <Button
                    onClick={handleCompleteCase}
                    size="sm"
                    disabled={answeredQuestions !== clinicalCase.totalQuestions || isCaseComplete}
                    className={`font-semibold ${answeredQuestions === clinicalCase.totalQuestions && !isCaseComplete ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600/50 text-white cursor-not-allowed'}`}
                  >
                    Soumettre la réponse
                  </Button>
                )}

                {/* Notes + reset + next buttons after results */}
                {isCaseComplete && showResults && evaluationComplete && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowNotesArea(p => !p);
                        if (!showNotesArea) setTimeout(() => { document.getElementById(`clinical-case-notes-${clinicalCase.caseNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
                      }}
                      className="flex items-center gap-1"
                    >
                      <StickyNote className="h-4 w-4" />
                      <span className="hidden sm:inline">{showNotesArea ? 'Fermer les notes' : (notesHasContent ? 'Mes notes' : 'Prendre une note')}</span>
                    </Button>

                    <Button onClick={onNext} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                      Suivant
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div id={`clinical-case-notes-${clinicalCase.caseNumber}`} className="space-y-6">
              {(showNotesArea || notesHasContent) && (
                <QuestionNotes 
                  questionId={`clinical-case-${clinicalCase.caseNumber}`} 
                  onHasContentChange={setNotesHasContent}
                  autoEdit={showNotesArea && !notesHasContent} // Auto-edit when manually opened and empty
                />
              )}
              {isCaseComplete && (
                <QuestionComments questionId={`clinical-case-${clinicalCase.caseNumber}`} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCaseDialog} onOpenChange={setShowCaseDialog}>
        <DialogTrigger asChild>
          <Button variant="default" size="sm" className="fixed bottom-6 left-6 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50 bg-blue-600 hover:bg-blue-700" aria-label="Voir le texte du cas clinique">
            <FileText className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />Cas Clinique {clinicalCase.caseNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 prose max-w-none text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            <HighlightableCaseText lectureId={lectureId} text={clinicalCase.caseText} />
          </div>
        </DialogContent>
      </Dialog>
      {openCaseEdit && (
        <ClinicalCaseEditDialog caseNumber={clinicalCase.caseNumber} questions={clinicalCase.questions} isOpen={openCaseEdit} onOpenChange={setOpenCaseEdit} onSaved={() => { try { window.location.reload(); } catch {} }} />
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