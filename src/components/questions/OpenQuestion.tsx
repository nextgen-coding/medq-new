"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Question } from '@/types';
import { motion } from 'framer-motion';
import { OpenQuestionHeader } from './open/OpenQuestionHeader';
import { OpenQuestionInput } from './open/OpenQuestionInput';
// Inline Rappel du cours collapsible replaces separate explanation block
import { OpenQuestionSelfAssessment } from './open/OpenQuestionSelfAssessment';
import { OpenQuestionActions } from './open/OpenQuestionActions';
import { HighlightableQuestionText } from './HighlightableQuestionText';
import { QuestionEditDialog } from './QuestionEditDialog';
import { ReportQuestionDialog } from './ReportQuestionDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BookOpen, ChevronRight } from 'lucide-react';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import { Pencil, Pin, PinOff, Eye, EyeOff, Flag, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProgress } from '@/hooks/use-progress';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

import { QuestionNotes } from './QuestionNotes';
import { logActivity } from '@/lib/logActivity';
import { QuestionComments } from './QuestionComments';
import ZoomableImage from './ZoomableImage';

interface OpenQuestionProps {
  question: Question;
  onSubmit: (answer: string, resultValue: boolean | 'partial') => void;
  onAnswerChange?: (answer: string, hasAnswer: boolean) => void;
  onNext: () => void;
  lectureId?: string;
  lectureTitle?: string;
  specialtyName?: string;
  isAnswered?: boolean;
  answerResult?: boolean | 'partial';
  userAnswer?: string;
  hideImmediateResults?: boolean;
  showDeferredSelfAssessment?: boolean; // Show self-assessment after results are revealed
  onSelfAssessmentUpdate?: (questionId: string, result: boolean | 'partial') => void; // Update result after self-assessment
  onQuestionUpdate?: (questionId: string, updates: Partial<Question>) => void;
  hideNotes?: boolean;
  hideComments?: boolean;
  hideActions?: boolean;
  highlightConfirm?: boolean;
  resetSignal?: number; // external trigger to reset state (for grouped QROC re-answer)
  keepInputAfterSubmit?: boolean; // keep textarea mounted (grouped subquestions)
  suppressReminder?: boolean; // hide reminder section (grouped QROC shows one shared)
  hideMeta?: boolean;
  enableAnswerHighlighting?: boolean; // enable highlighting for user answers
  disableIndividualSubmit?: boolean; // when true (grouped clinical case), block per-question submit & reference reveal until parent submit
  showNotesAfterSubmit?: boolean; // force show notes area after question is submitted
}

export function OpenQuestion({ 
  question, 
  onSubmit,
  onAnswerChange,
  onNext, 
  lectureId, 
  lectureTitle,
  specialtyName,
  isAnswered, 
  answerResult, 
  userAnswer,
  hideImmediateResults = false,
  showDeferredSelfAssessment = false,
  onSelfAssessmentUpdate,
  onQuestionUpdate,
  hideNotes,
  hideComments,
  hideActions,
  highlightConfirm,
  resetSignal,
  keepInputAfterSubmit,
  suppressReminder,
  hideMeta,
  enableAnswerHighlighting = false,
  disableIndividualSubmit = false,
  showNotesAfterSubmit = false,
}: OpenQuestionProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showSelfAssessment, setShowSelfAssessment] = useState(false);
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false); // Track if question has been submitted
  const [deferredAssessmentResult, setDeferredAssessmentResult] = useState<boolean | 'partial' | null>(null); // Track deferred self-assessment
  const [isPinned, setIsPinned] = useState(false); // Track if question is pinned
  const [showNotesArea, setShowNotesArea] = useState(false); // Control showing notes/comments after click
  const [notesHasContent, setNotesHasContent] = useState(false); // track if notes have content
  const [notesManuallyControlled, setNotesManuallyControlled] = useState(false); // track if user manually opened/closed notes

  // Auto-show notes when content is detected, but only if not manually controlled
  useEffect(() => {
    if (!notesManuallyControlled) {
      if (notesHasContent) {
        setShowNotesArea(true);
      } else {
        setShowNotesArea(false);
      }
    }
  }, [notesHasContent, notesManuallyControlled]);

  // Force show notes after submission if showNotesAfterSubmit is enabled, but only if notes have content
  useEffect(() => {
    if (showNotesAfterSubmit && isAnswered && !notesManuallyControlled) {
      setShowNotesArea(notesHasContent);
    } else if (!showNotesAfterSubmit && !notesManuallyControlled) {
      setShowNotesArea(false);
    }
  }, [showNotesAfterSubmit, isAnswered, notesManuallyControlled, notesHasContent]);
  const notesRef = useRef<HTMLDivElement | null>(null);
  const hasSubmittedRef = useRef(false); // Immediate synchronous access to submission state
  const selfAssessmentRef = useRef<HTMLDivElement | null>(null);
  const questionRef = useRef<HTMLDivElement | null>(null); // Ref for question top
  const { t } = useTranslation();
  const { user } = useAuth();
  const { trackQuestionProgress } = useProgress();

  // Check if user is admin
  const isAdmin = user?.role === 'admin';
  const isMaintainer = user?.role === 'maintainer';
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  // Local override for hidden to ensure instant UI toggle regardless of parent update timing
  const [localHidden, setLocalHidden] = useState<boolean | undefined>(undefined);
  // Highlights are managed internally by HighlightableQuestionText; no inline buttons here.

  useEffect(() => {
    setLocalHidden(undefined);
  }, [question.id]);

  // External reset (e.g., grouped QROC re-answer)
  useEffect(() => {
    if (resetSignal !== undefined) {
      // If not preserving input, clear it; else keep content
      if (!keepInputAfterSubmit) {
        setAnswer('');
      }
      setSubmitted(false);
      setShowSelfAssessment(false);
      setAssessmentCompleted(false);
      setHasSubmitted(false);
      hasSubmittedRef.current = false;
    }
  }, [resetSignal]);

  // Clear local override once parent prop reflects the new state
  useEffect(() => {
    if (localHidden !== undefined && (question.hidden === localHidden)) {
      setLocalHidden(undefined);
    }
  }, [question.hidden, localHidden]);

  // Load pinned status from database on mount
  useEffect(() => {
    const loadPinnedStatus = async () => {
      if (!user?.id) return;
      
      try {
        const response = await fetch(`/api/pinned-questions?userId=${user.id}`);
        if (response.ok) {
          const pinnedData = await response.json();
          const isQuestionPinned = pinnedData.some((item: any) => item.questionId === question.id);
          setIsPinned(isQuestionPinned);
        }
      } catch (error) {
        console.error('Error loading pinned question status:', error);
      }
    };

    if (user?.id && question.id) {
      loadPinnedStatus();
    }
  }, [user?.id, question.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Enter for next question (only when assessment is completed)
      if (event.key === 'Enter' && assessmentCompleted && !event.altKey && !event.shiftKey && !event.ctrlKey) {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assessmentCompleted, onNext]);

  // Pin/Unpin handlers for questions
  const handlePinQuestion = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch('/api/pinned-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          questionId: question.id,
        }),
      });

      if (response.ok) {
        setIsPinned(true);
        toast({
          title: "Question Pinned",
          description: "This question has been pinned to your collection.",
        });
  window.dispatchEvent(new Event('pinned-updated'));
      } else {
        toast({
          title: "Error",
          description: "Failed to pin question.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error pinning question:', error);
      toast({
        title: "Error",
        description: "Failed to pin question.",
        variant: "destructive",
      });
    }
  }, [user?.id, question.id]);

  const handleUnpinQuestion = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/pinned-questions?userId=${user.id}&questionId=${question.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsPinned(false);
        toast({
          title: "Question Unpinned",
          description: "This question has been removed from your pinned collection.",
        });
  window.dispatchEvent(new Event('pinned-updated'));
      } else {
        toast({
          title: "Error",
          description: "Failed to unpin question.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error unpinning question:', error);
      toast({
        title: "Error",
        description: "Failed to unpin question.",
        variant: "destructive",
      });
    }
  }, [user?.id, question.id]);

  // Force reset when question changes (safety net)
  useEffect(() => {
    hasSubmittedRef.current = false;
    setHasSubmitted(false);
  // Close notes area when navigating to another question
  setShowNotesArea(false);
    setNotesHasContent(false);
    setNotesManuallyControlled(false);
  }, [question.id]);

  // In grouped clinical case mode (disableIndividualSubmit) propagate answer live ONLY when it actually changes
  // to avoid infinite update loops (parent state update -> re-render -> effect firing again).
  const lastPropagatedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!(disableIndividualSubmit && hideImmediateResults && !submitted && onAnswerChange)) return;
    const trimmed = answer.trim();
    const parentValue = userAnswer ?? '';
    // Avoid re-sending same value
    if (lastPropagatedRef.current === answer) return;
    if (trimmed.length > 0) {
      if (parentValue !== answer) {
        onAnswerChange(answer, true);
        lastPropagatedRef.current = answer;
      }
    } else {
      if (parentValue !== '') {
        onAnswerChange('', false);
        lastPropagatedRef.current = '';
      }
    }
  }, [answer, userAnswer, disableIndividualSubmit, hideImmediateResults, submitted, onAnswerChange]);

  // Handle userAnswer changes separately to avoid reinitialization loops
  useEffect(() => {
    if (userAnswer) {
      setAnswer(userAnswer);
    }
  }, [userAnswer]);



  // Initialize / sync when parent indicates answered state changes.
  // For deferred clinical case flow: show self-assessment ONLY while awaiting evaluation (answerResult undefined).
  useEffect(() => {
    if (isAnswered) {
      setAnswer(userAnswer || '');
      setSubmitted(true);
      setHasSubmitted(true);
      hasSubmittedRef.current = true;
      if (showDeferredSelfAssessment) {
        if (answerResult === undefined) {
          // Pending self-evaluation
            setAssessmentCompleted(false);
            setShowSelfAssessment(true);
        } else {
          // Evaluation done – hide buttons
          setAssessmentCompleted(true);
          setShowSelfAssessment(false);
        }
      } else {
        // Immediate mode
        setAssessmentCompleted(answerResult !== undefined);
        setShowSelfAssessment(false);
      }
    } else {
      if (!userAnswer) setAnswer('');
      setSubmitted(false);
      setShowSelfAssessment(false);
      setAssessmentCompleted(false);
      setHasSubmitted(false);
      hasSubmittedRef.current = false;
    }
  }, [question.id, isAnswered, answerResult, showDeferredSelfAssessment, userAnswer]);

  const handleSubmit = async () => {
    // In grouped clinical case mode we disable individual submission until parent submits
    if (disableIndividualSubmit && hideImmediateResults) return;
    if (hasSubmittedRef.current) return; // Prevent double submission with immediate synchronous check
    
    // Mark that this question is being submitted IMMEDIATELY
    hasSubmittedRef.current = true;
    setSubmitted(true);
    setHasSubmitted(true);
    
    // Keep notes hidden by default - user can manually open if needed
    
    // For clinical case questions (hideImmediateResults = true), 
    // call onSubmit immediately with a default result since self-assessment is hidden
    if (hideImmediateResults) {
      setAssessmentCompleted(true);
      // Call onSubmit immediately with answer and a placeholder result
      // The actual result will be determined when "Show Results" is clicked
      onSubmit(answer, 'partial'); // Use 'partial' as default for clinic questions
    } else {
      // For regular questions, show self-assessment
      setShowSelfAssessment(true);
      // Auto-scroll to question top to see the full question and results
      setTimeout(() => {
        if (questionRef.current) {
          questionRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);
    }

    // Log activity immediately for open/QROC so it appears in daily chart even before self-assessment
    if (user?.id) {
      logActivity('open_question_attempt', () => {
        window.dispatchEvent(new CustomEvent('activity-attempt'));
      });
    }
  };

  const handleBlur = (currentAnswer: string) => {
    // Call onAnswerChange when user leaves the input field (for clinical cases)
    if (onAnswerChange) {
      // For QROC questions, any non-empty answer is considered "answered"
      // Empty answers are also allowed and marked as answered
      onAnswerChange(currentAnswer, true); // Always mark as answered when blurring
    }
  };

  const handleSelfAssessment = async (rating: 'correct' | 'wrong' | 'partial') => {
    setAssessmentCompleted(true);
    setShowSelfAssessment(false);
    
    // Store the rating as a string for proper handling in the navigator
    const resultValue = rating === 'correct' ? true : rating === 'partial' ? 'partial' : false;
    
    // For deferred self-assessment (clinical cases), store the result and update the parent
    if (showDeferredSelfAssessment && onSelfAssessmentUpdate) {
      setDeferredAssessmentResult(resultValue);
      onSelfAssessmentUpdate(question.id, resultValue);
      
      // Track progress for deferred assessment
      if (lectureId) {
        trackQuestionProgress(lectureId, question.id, resultValue);
      }
    } else {
      // For regular questions, track progress and call onSubmit
      if (lectureId) {
        trackQuestionProgress(lectureId, question.id, resultValue);
      }
      onSubmit(answer, resultValue);
    }

    // Persist attempt + score
    if (user?.id) {
      try {
        await fetch('/api/user-question-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            questionId: question.id,
            incrementAttempts: true,
            lastScore: resultValue === true ? 1 : resultValue === 'partial' ? 0.5 : 0,
          }),
        });
        // Log a generic activity event (question attempt)
        logActivity('open_question_attempt', () => {
          window.dispatchEvent(new CustomEvent('activity-attempt'));
        });
      } catch {}
    }
  };

  const handleQuestionUpdated = async () => {
    try {
      const res = await fetch(`/api/questions/${question.id}`, { credentials: 'include' });
      if (!res.ok) return;
      const q = await res.json();
      const updates: Partial<Question> = {
        text: q.text,
        explanation: q.explanation,
        correctAnswers: q.correctAnswers,
        correct_answers: q.correctAnswers,
        course_reminder: q.courseReminder ?? q.course_reminder,
        number: q.number,
        session: q.session,
        media_url: q.mediaUrl ?? q.media_url,
        media_type: q.mediaType ?? q.media_type,
        course_reminder_media_url: q.courseReminderMediaUrl ?? q.course_reminder_media_url,
        course_reminder_media_type: q.courseReminderMediaType ?? q.course_reminder_media_type,
      };
      onQuestionUpdate?.(question.id, updates);
    } catch {}
  };

  // Compute expected reference answer (memoized)
  const expectedReference = useMemo(() => {
    const correctArr: string[] = (question as any).correctAnswers || (question as any).correct_answers || [];
    const expectedFromArray = Array.isArray(correctArr) && correctArr.length > 0 ? correctArr.filter(Boolean).join(' / ') : '';
    const expected = expectedFromArray || (question as any).course_reminder || (question as any).courseReminder || question.explanation || (question as any).correctAnswer || '';
    return expected || '';
  }, [question]);

  // Admin function to toggle question visibility
  const handleToggleVisibility = async () => {
    if (!isAdmin || !onQuestionUpdate) return;
    
  const effectiveHidden = localHidden ?? !!question.hidden;
  const newHiddenStatus = !effectiveHidden;
    
    // Optimistically update the UI
  setLocalHidden(newHiddenStatus);
  onQuestionUpdate(question.id, { hidden: newHiddenStatus });
    
    try {
      setIsTogglingVisibility(true);
      const response = await fetch(`/api/questions/${question.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          hidden: newHiddenStatus
        }),
      });

      if (!response.ok) {
        // Revert the optimistic update on error
        setLocalHidden(undefined);
        onQuestionUpdate(question.id, { hidden: question.hidden });
        toast({
          title: "Error",
          description: "Failed to update question visibility",
          variant: "destructive",
        });
      } else {
        toast({
          title: newHiddenStatus ? 'Question hidden' : 'Question unhidden',
          description: newHiddenStatus
            ? 'The question is now hidden from students.'
            : 'The question is now visible to students.',
        });
      }
    } catch (error) {
      // Revert the optimistic update on error
      setLocalHidden(undefined);
      onQuestionUpdate(question.id, { hidden: question.hidden });
      toast({
        title: "Error",
        description: "Failed to update question visibility",
        variant: "destructive",
      });
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  // Keyboard shortcuts: Enter to submit (or next), 1/2/3 to rate during self-assessment
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as HTMLElement).isContentEditable === true
      );

      // When self-assessment is visible, map 1/2/3 to correct/partial/wrong
      if (showSelfAssessment && (!hideImmediateResults || showDeferredSelfAssessment)) {
        if (['1', '2', '3'].includes(event.key)) {
          event.preventDefault();
          const map: Record<string, 'correct' | 'partial' | 'wrong'> = {
            '1': 'correct',
            '2': 'partial',
            '3': 'wrong',
          };
          handleSelfAssessment(map[event.key]);
        }
        return; // don’t fall through to Enter handling while assessing
      }

      // Submit with Enter (only when not typing in inputs, textarea handles its own Enter)
      if (!submitted && !isTyping && event.key === 'Enter' && !event.shiftKey) {
        if (disableIndividualSubmit && hideImmediateResults) return; // blocked in grouped mode
        event.preventDefault();
        if (answer.trim()) {
          handleSubmit();
        }
        return;
      }

      // Next question with Enter after assessment is complete
      if (submitted && assessmentCompleted && !isTyping && event.key === 'Enter') {
        event.preventDefault();
        onNext();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSelfAssessment, hideImmediateResults, showDeferredSelfAssessment, submitted, assessmentCompleted, answer]);

  return (
    <motion.div
      ref={questionRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="space-y-2 w-full max-w-full"
    >
  {/**
   * Simple QROC mode: compact single-container layout shown after submission
   * (non-clinical, immediate results). Grouped/clinical flows are untouched.
   */}
      
      {(() => {
        // simple (non-clinical) QROC: immediate results, individual submit enabled
        const isSimpleQroc = !hideImmediateResults && !disableIndividualSubmit;
        // Can show reference answer under same rules as original logic
        const correctArr: string[] = (question as any).correctAnswers || (question as any).correct_answers || [];
        const expectedFromArray = Array.isArray(correctArr) && correctArr.length > 0 ? correctArr.filter(Boolean).join(' / ') : '';
        const expected = expectedFromArray || (question as any).course_reminder || (question as any).courseReminder || question.explanation || (question as any).correctAnswer || '';
        const expectedReferenceInline = expected || '';
        const canShowReferenceInline = submitted && expectedReferenceInline && (!hideImmediateResults || (showSelfAssessment && showDeferredSelfAssessment) || assessmentCompleted);

        if (!(submitted && isSimpleQroc)) return null;

        return (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 space-y-2">
            {/* Inline compact question text inside the same container */}
            <div className="inline-block">
              <HighlightableQuestionText
                questionId={question.id}
                text={question.text}
                className="mt-0 text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 leading-relaxed break-words whitespace-pre-wrap inline"
                confirmMode={highlightConfirm}
              />
            </div>

            {/* Reference answer (green card) */}
            {canShowReferenceInline && (
              <div className="mt-1">
                <div className="rounded-xl border border-emerald-300/60 dark:border-emerald-600/70 bg-emerald-50/80 dark:bg-emerald-900/50 px-6 py-2 shadow-sm">
                  <div className="mb-2">
                    <h3 className="text-base md:text-lg font-bold tracking-tight text-emerald-800 dark:text-emerald-50">Réponse</h3>
                  </div>
                  <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none leading-relaxed text-emerald-800 dark:text-emerald-50">
                    <RichTextDisplay text={expectedReferenceInline} enableImageZoom={true} />
                  </div>
                </div>
              </div>
            )}

            {/* Self assessment buttons */}
            {showSelfAssessment && (!hideImmediateResults || showDeferredSelfAssessment) && (
              <div ref={selfAssessmentRef}>
                <OpenQuestionSelfAssessment
                  onAssessment={handleSelfAssessment}
                  userAnswerText={submitted ? answer : undefined}
                  questionId={question.id}
                  enableHighlighting={enableAnswerHighlighting}
                  highlightConfirm={highlightConfirm}
                />
              </div>
            )}
          </div>
        );
      })()}
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex-1 min-w-0 max-w-3xl">
          {/* In simple QROC post-submit wrapper we already show the question text inside the container */}
          {!hideMeta && !(submitted && !hideImmediateResults && !disableIndividualSubmit) && (
            <OpenQuestionHeader 
              questionText={question.text} 
              questionNumber={question.number}
              session={question.session}
              lectureTitle={lectureTitle}
              specialtyName={specialtyName}
              questionId={question.id}
              highlightConfirm={highlightConfirm}
              hideMeta={hideMeta}
            />
          )}
          {hideMeta && !(submitted && !hideImmediateResults && !disableIndividualSubmit) && (
            <div className="inline-block">
              <HighlightableQuestionText
                questionId={question.id}
                text={question.text}
                className="mt-0 text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 leading-relaxed break-words whitespace-pre-wrap inline"
                confirmMode={highlightConfirm}
              />
            </div>
          )}
          {/* Inline media attached to the question (not the reminder) */}
          {(() => {
            const mediaUrl = (question as any).media_url || (question as any).mediaUrl;
            const mediaType = (question as any).media_type || (question as any).mediaType;
            if (!mediaUrl) return null;
            const isImageByExt = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(mediaUrl);
            const isImage = mediaType === 'image' || (!mediaType && isImageByExt);
            if (!isImage) return null;
            return (
              <div className="mt-3">
                <ZoomableImage
                  src={mediaUrl}
                  alt="Illustration de la question"
                  thumbnailClassName="max-h-64 w-auto sm:max-h-80 max-w-full rounded-md border object-contain shadow-sm"
                />
              </div>
            );
          })()}
        </div>
      </div>
      
  {/* Media is now displayed inside the "Rappel du cours" section on the page */}

    {(!submitted || keepInputAfterSubmit) && (
        <OpenQuestionInput
          answer={answer}
          setAnswer={setAnswer}
      isSubmitted={submitted && !keepInputAfterSubmit}
          onSubmit={handleSubmit}
          onBlur={handleBlur}
        />
      )}

  {/* Reference answer now shown inside self-assessment panel */}

  {/* Persistent reference + user answer block (including during self-assessment) */}
  {(() => {
    // Avoid duplicate reference/self-assessment when wrapped in simple QROC container
    const usingWrapper = submitted && !hideImmediateResults && !disableIndividualSubmit;
    if (usingWrapper) return null;
    const canShowReference = submitted && expectedReference && (!hideImmediateResults || (showSelfAssessment && showDeferredSelfAssessment) || assessmentCompleted);
    if (!canShowReference) return null;
    return (
      <div className="mt-1">
        <div className="rounded-xl border border-emerald-300/60 dark:border-emerald-600/70 bg-emerald-50/80 dark:bg-emerald-900/50 px-6 py-2 shadow-sm">
          <div className="mb-2">
            <h3 className="text-base md:text-lg font-bold tracking-tight text-emerald-800 dark:text-emerald-50">Réponse</h3>
          </div>
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none leading-relaxed text-emerald-800 dark:text-emerald-50">
            <RichTextDisplay text={expectedReference} enableImageZoom={true} />
          </div>
        </div>
      </div>
    );
  })()}

  {(() => {
    const usingWrapper = submitted && !hideImmediateResults && !disableIndividualSubmit;
    if (usingWrapper) return null;
    if (!(showSelfAssessment && (!hideImmediateResults || showDeferredSelfAssessment))) return null;
    return (
      <div ref={selfAssessmentRef}>
        <OpenQuestionSelfAssessment
          onAssessment={handleSelfAssessment}
          userAnswerText={submitted ? answer : undefined}
          questionId={question.id}
          enableHighlighting={enableAnswerHighlighting}
          highlightConfirm={highlightConfirm}
        />
      </div>
    );
  })()}

      {!hideActions && (
        <OpenQuestionActions
          isSubmitted={submitted}
          canSubmit={!hasSubmitted}
          onSubmit={handleSubmit}
          onNext={onNext}
          showNext={submitted} // Show "Suivant" immediately after submission
          hasSubmitted={hasSubmitted}
          assessmentCompleted={assessmentCompleted}
          showNotesArea={showNotesArea}
          hideNotesButton={false} // Always show notes button so users can hide/show notes
          onToggleNotes={() => {
            setShowNotesArea(prev => !prev);
            setNotesManuallyControlled(true);
            setTimeout(() => {
              if (!showNotesArea && notesRef.current) {
                notesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 30);
          }}
        />
      )}

  {/* Rappel du cours (après soumission) */}
  {submitted && !suppressReminder && (() => {
    const text = (question as any).course_reminder || (question as any).courseReminder || question.explanation;
    const reminderMediaUrl = (question as any).course_reminder_media_url || (question as any).courseReminderMediaUrl;
    const reminderMediaType = (question as any).course_reminder_media_type || (question as any).courseReminderMediaType;
    if (!text && !reminderMediaUrl) return null;
    return (
      <Card className="mt-2">
        <CardHeader className="py-3">
          <Collapsible defaultOpen={false}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                Rappel du cours
              </CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2 group">
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-3">
                {reminderMediaUrl && (reminderMediaType === 'image' || /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(reminderMediaUrl)) && (
                  <ZoomableImage src={reminderMediaUrl} alt="Image du rappel" />
                )}
                {text && (
                  <div className="prose dark:prose-invert max-w-none text-sm">
                    <RichTextDisplay text={text} enableImageZoom={true} />
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </CardHeader>
      </Card>
    );
  })()}

  {/* Notes - always render for content detection, but show/hide based on showNotesArea */}
  {!hideNotes && (
        <div ref={notesRef} className={showNotesArea ? "" : "hidden"}>
          <QuestionNotes 
            questionId={question.id} 
            onHasContentChange={setNotesHasContent}
            autoEdit={showNotesArea && !notesHasContent} // Auto-edit when manually opened and empty
          />
        </div>
      )}
  {/* Comments (after submission) */}
  {submitted && !hideComments && <QuestionComments questionId={question.id} />}
      
      <QuestionEditDialog
        question={question}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onQuestionUpdated={handleQuestionUpdated}
      />
      
      <ReportQuestionDialog
        question={question}
        lectureId={lectureId!}
        isOpen={isReportDialogOpen}
        onOpenChange={setIsReportDialogOpen}
      />
    </motion.div>
  );
}
