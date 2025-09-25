'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Question } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import { MCQHeader } from './mcq/MCQHeader';
import { HighlightableQuestionText } from './HighlightableQuestionText';
import { MCQOptionItem } from './mcq/MCQOptionItem';
// Rappel du cours section (collapsible) replaces MCQExplanation
import { MCQActions } from './mcq/MCQActions';
import { QuestionEditDialog } from './QuestionEditDialog';
import { ReportQuestionDialog } from './ReportQuestionDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BookOpen, ChevronRight } from 'lucide-react';
import ZoomableImage from './ZoomableImage';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import { Pencil, Pin, PinOff, Eye, EyeOff, Trash2, Plus, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProgress } from '@/hooks/use-progress';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

import { QuestionNotes } from './QuestionNotes';
import { logActivity } from '@/lib/logActivity';
import { QuestionComments } from './QuestionComments';

interface MCQQuestionProps {
  question: Question;
  onSubmit: (selectedOptionIds: string[], isCorrect: boolean) => void;
  onAnswerChange?: (selectedOptionIds: string[], isCorrect: boolean) => void;
  onNext: () => void;
  lectureId?: string;
  lectureTitle?: string;
  specialtyName?: string;
  isAnswered?: boolean;
  answerResult?: boolean | 'partial';
  userAnswer?: string[];
  hideImmediateResults?: boolean;
  onQuestionUpdate?: (questionId: string, updates: Partial<Question>) => void;
  hideActions?: boolean;
  hideNotes?: boolean;
  hideComments?: boolean;
  highlightConfirm?: boolean;
  hideMeta?: boolean;
  suppressReminder?: boolean; // hide reminder section (for clinical cases)
  enableOptionHighlighting?: boolean; // enable highlighting for MCQ options (for clinical cases)
  disableKeyboardHandlers?: boolean; // disable Enter/keyboard shortcuts (for clinical cases)
  allowEnterSubmit?: boolean; // when false, Enter won't submit/next; lets parent handle Enter
  isActive?: boolean; // when true, this instance accepts keyboard shortcuts
  showNotesAfterSubmit?: boolean; // show notes area after submit (for task page)
  onFocus?: () => void; // callback when any part of the question receives focus
  customActionButton?: React.ReactNode; // custom button to render between actions and rappel du cours
}

export function MCQQuestion({ 
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
  onQuestionUpdate,
  hideActions,
  hideNotes,
  hideComments,
  highlightConfirm,
  hideMeta,
  suppressReminder,
  enableOptionHighlighting = false,
  disableKeyboardHandlers = false,
  allowEnterSubmit = true,
  isActive = false,
  onFocus,
  customActionButton
}: MCQQuestionProps) {
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | 'partial' | null>(null);
  const [expandedExplanations, setExpandedExplanations] = useState<string[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false); // Track if question has been submitted
  const [isSubmitting, setIsSubmitting] = useState(false); // Track if currently submitting
  const [isPinned, setIsPinned] = useState(false); // Track if question is pinned
  const [showNotesArea, setShowNotesArea] = useState(false); // control notes/comments visibility
  const [notesHasContent, setNotesHasContent] = useState(false); // track if notes have content
  const [notesManuallyControlled, setNotesManuallyControlled] = useState(false); // track if user manually opened/closed notes

  // Auto-show notes when content is detected, but don't auto-hide when content is deleted
  useEffect(() => {
    if (!notesManuallyControlled) {
      // Show notes if they have content, but don't hide them if content is deleted
      // This allows users to continue editing even when notes are empty
      if (notesHasContent) {
        setShowNotesArea(true);
      }
      // Don't auto-hide when content becomes empty - keep notes visible for editing
    }
  }, [notesHasContent, notesManuallyControlled]);

  // Keep notes area visible even when content is deleted
  useEffect(() => {
    if (notesHasContent === false && showNotesArea) {
      // Notes area is already visible, keep it visible even with no content
      // This ensures users can still see the modify button
    }
  }, [notesHasContent, showNotesArea]);

  // If another branch introduced a prop to force-show notes after submit,
  // we intentionally keep local behavior (auto-show only when content exists
  // and user hasn't manually toggled), so no extra effect is needed here.
  // Server aggregated stats
  const [optionStats, setOptionStats] = useState<Record<string, number>>({});
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const notesRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null); // Ref for results section
  const questionRef = useRef<HTMLDivElement | null>(null); // Ref for question top
  const hasSubmittedRef = useRef(false); // Ref for immediate access to submission state
  const buttonRef = useRef<HTMLButtonElement>(null); // Ref to directly control button
  const { t } = useTranslation();
  const { user } = useAuth();
  const { trackQuestionProgress } = useProgress();
  const isAdmin = user?.role === 'admin';
  const isMaintainer = user?.role === 'maintainer';
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  // Local override for hidden to ensure instant UI toggle regardless of parent update timing
  const [localHidden, setLocalHidden] = useState<boolean | undefined>(undefined);
  // Highlight handled inside HighlightableQuestionText; no inline buttons here

  // Keep local override in sync when question changes
  useEffect(() => {
    setLocalHidden(undefined);
  }, [question.id]);

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
          title: "Question épinglée",
          description: "Cette question a été ajoutée à votre collection épinglée.",
        });
  window.dispatchEvent(new Event('pinned-updated'));
      } else {
        toast({
          title: "Erreur",
          description: "Impossible d'épingler la question.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error pinning question:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'épingler la question.",
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
          title: "Question désépinglée",
          description: "Cette question a été retirée de votre collection épinglée.",
        });
  window.dispatchEvent(new Event('pinned-updated'));
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de désépingler la question.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error unpinning question:', error);
      toast({
        title: "Erreur",
        description: "Impossible de désépingler la question.",
        variant: "destructive",
      });
    }
  }, [user?.id, question.id]);

  // Force reset when question changes (safety net)
  useEffect(() => {
    hasSubmittedRef.current = false;
    setHasSubmitted(false);
    setIsSubmitting(false);
  // Close notes area when moving to a different question to avoid leaking state
  setShowNotesArea(false);
    setNotesHasContent(false);
    setNotesManuallyControlled(false);
  }, [question.id]);

  // Handle userAnswer changes separately to avoid reinitialization loops
  useEffect(() => {
    const ua = Array.isArray(userAnswer) ? userAnswer : [];
    // Always mirror external userAnswer. If empty, clear the local selection.
    setSelectedOptionIds(ua);
  }, [userAnswer]);

  // Initialize component state based on whether question is already answered
  useEffect(() => {
    
    if (isAnswered && answerResult !== undefined) {
      // Set the previously selected options
      setSelectedOptionIds(userAnswer || []);
      setHasSubmitted(true); // Question has been submitted
      setIsSubmitting(false); // Not currently submitting (already submitted)
      hasSubmittedRef.current = true; // Set ref as well
      
      // For clinical case questions with hidden results, don't set submitted to true
      // This keeps the UI in "answering" mode while still showing the selected options
      if (!hideImmediateResults) {
        setSubmitted(true);
        setIsCorrect(answerResult === true);
        // Auto-expand only missed correct options and wrong selections
        const correct = question.correctAnswers || question.correct_answers || [];
        const ua = Array.isArray(userAnswer) ? userAnswer : [];
        if (answerResult === true) {
          setExpandedExplanations([]);
        } else {
          const wrongSelected = ua.filter((id) => !correct.includes(id));
          const missedCorrect = correct.filter((id: string) => !ua.includes(id));
          const autoExpandIds = Array.from(new Set([...wrongSelected, ...missedCorrect]));
          setExpandedExplanations(autoExpandIds);
        }
      } else {
        // For clinical case questions with hidden results, keep UI in answering mode
        setSubmitted(false);
        setIsCorrect(null);
        setExpandedExplanations([]);
      }
    } else {
      // Don't reset selectedOptionIds if userAnswer exists (preserve selections)
      if (!userAnswer || userAnswer.length === 0) {
        setSelectedOptionIds([]);
      }
      setSubmitted(false);
      setIsCorrect(null);
      setExpandedExplanations([]);
      setHasSubmitted(false); // Question has not been submitted
      setIsSubmitting(false); // Not currently submitting
      hasSubmittedRef.current = false; // Reset ref as well
    }
  }, [question.id, isAnswered, answerResult, question.options, question.correctAnswers, question.correct_answers, hideImmediateResults]);

  // Load existing stats whenever question changes (initial load)
  useEffect(() => {
    let abort = false;
    const load = async () => {
      setLoadingStats(true);
      try {
        const res = await fetch(`/api/question-option-stats?questionId=${question.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (abort) return;
        const counts: Record<string, number> = {};
        (data.options || []).forEach((o: any) => { counts[o.optionId] = o.count; });
        setOptionStats(counts);
        setTotalSubmissions(data.total || 0);
      } catch {} finally { if (!abort) setLoadingStats(false); }
    };
    load();
    return () => { abort = true; };
  }, [question.id]);

  // Normalize options to ensure they have the correct format
  const normalizedOptions = useMemo(() => {
    if (!question.options) return [];
    
    return question.options
      .map((option, index) => {
        if (typeof option === 'string') {
          // Convert string option to object format
          return {
            id: index.toString(),
            text: option,
            explanation: undefined
          };
        } else if (option && typeof option === 'object') {
          // Ensure object option has required properties
          return {
            id: option.id || index.toString(),
            text: option.text || '',
            explanation: option.explanation
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{ id: string; text: string; explanation?: string }>;
  }, [question.options]);

  // Get correct answers array from question
  const correctAnswers = question.correctAnswers || question.correct_answers || [];

  // Handle checkbox change
  const handleOptionSelect = (optionId: string) => {
    // Don't allow changes when question is submitted
    if (submitted) return;
    
    // Calculate the new selection
    const newSelectedOptionIds = selectedOptionIds.includes(optionId)
      ? selectedOptionIds.filter(id => id !== optionId)
      : [...selectedOptionIds, optionId];
    
    // Update state
    setSelectedOptionIds(newSelectedOptionIds);
    
    // Calculate if the new selection is correct (for immediate feedback)
    const correctAnswers = question.correctAnswers || question.correct_answers || [];
    const selectedSet = new Set(newSelectedOptionIds);
    const correctSet = new Set(correctAnswers);
    const isSelectionCorrect = selectedSet.size === correctSet.size && 
      [...selectedSet].every(id => correctSet.has(id));
    
    // Call onAnswerChange for immediate updates (e.g., in clinical cases)
    if (onAnswerChange) {
      onAnswerChange(newSelectedOptionIds, isSelectionCorrect);
    }
  };

  // Toggle explanation visibility
  const toggleExplanation = (optionId: string) => {
    setExpandedExplanations(prev =>
      prev.includes(optionId)
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  const handleSubmit = async () => {
    if (selectedOptionIds.length === 0) return;
    if (hasSubmittedRef.current) return; // Prevent double submission
    if (isSubmitting) return; // Prevent double submission during processing
    
    // Mark that this question is being submitted IMMEDIATELY
    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    setHasSubmitted(true);
    
    // For clinical case questions with hidden results, NEVER set submitted to true
    // This keeps the UI in "answering" mode while still tracking the answer
    if (!hideImmediateResults) {
      setSubmitted(true);
    }
    // Keep notes hidden by default - user can manually open if needed
    
    // If hideImmediateResults is true, keep submitted as false to show checkboxes
    
    // Compute detailed scoring (fractional credit)
    const correctSet = new Set(correctAnswers);
    const selectedSet = new Set(selectedOptionIds);
    const totalCorrect = correctAnswers.length || 1; // avoid division by zero
    let numCorrectChosen = 0;
    let numWrongChosen = 0;
    selectedSet.forEach(id => {
      if (correctSet.has(id)) numCorrectChosen++; else numWrongChosen++;
    });

    // Basic proportional credit: credit for each correct selected, penalty for each wrong selected
    // Penalty ratio: each wrong answer subtracts one correct-equivalent.
    let rawScore = (numCorrectChosen - numWrongChosen) / totalCorrect;
    // Clamp between 0 and 1
    if (rawScore < 0) rawScore = 0;
    if (rawScore > 1) rawScore = 1;

    const isAnswerCorrect = rawScore === 1;
    // Determine qualitative result for UI (treat any 0<score<1 as partial)
    const qualitative: boolean | 'partial' = isAnswerCorrect ? true : (rawScore > 0 ? 'partial' : false);
    setIsCorrect(qualitative); // Use qualitative result for UI display
    
    // Auto-expand explanations for incorrect answers and correct answers that weren't selected
    // Only do this if results are not hidden
    if (!hideImmediateResults) {
      const autoExpandIds: string[] = [];
      
      // Add incorrect selections to auto-expand
      selectedOptionIds.forEach(id => {
        if (!correctAnswers.includes(id)) {
          autoExpandIds.push(id);
        }
      });
      
      // Add correct answers that weren't selected to auto-expand
      correctAnswers.forEach(id => {
        if (!selectedOptionIds.includes(id)) {
          autoExpandIds.push(id);
        }
      });
      
      setExpandedExplanations(autoExpandIds);
      
      // Auto-scroll to question top after submission to see the full question and results
      setTimeout(() => {
        if (questionRef.current) {
          questionRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
        }
      }, 100);
    }
    
    // Track progress if lectureId is provided (pass rawScore for fine-grained credit)
    if (lectureId) {
      trackQuestionProgress(lectureId, question.id, qualitative, rawScore);
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
      lastScore: rawScore,
          }),
        });
        // Log activity (central helper)
        logActivity('question_attempt', () => {
          window.dispatchEvent(new CustomEvent('activity-attempt'));
        });
      } catch {}
    }

    // Post option selection stats only upon submission
    try {
      fetch('/api/question-option-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, optionIds: selectedOptionIds })
      })
        .then(() => {
          // Refresh stats after posting
          fetch(`/api/question-option-stats?questionId=${question.id}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (!data) return;
              const counts: Record<string, number> = {};
              (data.options || []).forEach((o: any) => { counts[o.optionId] = o.count; });
              setOptionStats(counts);
              setTotalSubmissions(data.total || 0);
            }).catch(()=>{});
        })
        .catch(()=>{});
    } catch {}
    
    onSubmit(selectedOptionIds, isAnswerCorrect); // existing signature expects boolean
    // Don't automatically move to next question - let user see the result first
  };

  const handleQuestionUpdated = async () => {
    try {
      const res = await fetch(`/api/questions/${question.id}`, { credentials: 'include' });
      if (!res.ok) return;
      const q = await res.json();
      // Map API camelCase fields to app types
      const updates: Partial<Question> = {
        text: q.text,
        options: q.options,
        correctAnswers: q.correctAnswers,
        correct_answers: q.correctAnswers, // keep both in sync
        explanation: q.explanation,
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

  const handleResubmit = () => {
    console.log('🔄 handleResubmit called for MCQ question:', question.id);
    console.log('Current state before resubmit:', {
      selectedOptionIds,
      submitted,
      hasSubmitted,
      isCorrect
    });

    // Reset all question state to allow resubmission
    setSelectedOptionIds([]);
    setSubmitted(false);
    setIsCorrect(null);
    setExpandedExplanations([]);
    setHasSubmitted(false);
    setIsSubmitting(false);
    hasSubmittedRef.current = false;

    // Reset notes area state
    setShowNotesArea(false);
    setNotesHasContent(false);
    setNotesManuallyControlled(false);

    console.log('✅ MCQ question state reset via resubmit');

    // Scroll to question top
    setTimeout(() => {
      if (questionRef.current) {
        questionRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
  };

  // Keyboard shortcuts (robust): digits/numpad 1-9 or letters A-I to toggle, Backspace clear, Enter submit/next
  const rootRef = useRef<HTMLDivElement | null>(null);
  const shortcutHandler = useCallback((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey) return;
  const target = event.target as HTMLElement | null;
  // Scope by active question index from parent
  if (!isActive) return;
    // Don't interfere with typing in textarea or text-like inputs; allow radio/checkbox
    if (target) {
      const tag = target.tagName;
      const type = (target as HTMLInputElement).type;
      const isEditable = (target as any).isContentEditable;
      const isTextualInput = tag === 'INPUT' && type && !['radio','checkbox','button','submit'].includes(type);
      if (tag === 'TEXTAREA' || isTextualInput || isEditable) return;
    }
    const opts = normalizedOptions; // use normalized list with guaranteed ids
    if (!opts.length) return;
    const key = event.key;
    // Digit (supports AZERTY & numpad via event.code)
    if (!submitted) {
      let digit: number | null = null;
      if (/^[1-9]$/.test(key)) {
        digit = parseInt(key, 10);
      } else if (/^Digit[1-9]$/.test(event.code)) {
        digit = parseInt(event.code.replace('Digit',''), 10);
      } else if (/^Numpad[1-9]$/.test(event.code)) {
        digit = parseInt(event.code.replace('Numpad',''), 10);
      }
      if (digit !== null) {
        const idx = digit - 1;
        if (idx >= 0 && idx < opts.length) {
          handleOptionSelect(opts[idx].id);
          event.preventDefault();
          return;
        }
      }
    }
    // Letter A-I mapping
    if (!submitted && /^[a-i]$/i.test(key)) {
      const idx = key.toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && idx < opts.length) {
        handleOptionSelect(opts[idx].id);
        event.preventDefault();
        return;
      }
    }
    // Backspace clear
    if (!submitted && key === 'Backspace' && selectedOptionIds.length) {
      setSelectedOptionIds([]);
      event.preventDefault();
      return;
    }
    // Submit with Enter when not submitted (if allowed)
    if (allowEnterSubmit && key === 'Enter' && !submitted && selectedOptionIds.length > 0) {
      event.preventDefault();
      handleSubmit();
      return;
    }
    // Next with Enter when submitted
    if (allowEnterSubmit && key === 'Enter' && submitted) {
      event.preventDefault();
      onNext();
      return;
    }
    // Next after submission: N (keeping as backup)
    if (allowEnterSubmit && submitted && key.toLowerCase() === 'n') {
      onNext();
      event.preventDefault();
      return;
    }
  }, [normalizedOptions, submitted, selectedOptionIds, onNext, handleSubmit, allowEnterSubmit, isActive]);

  useEffect(() => {
    // Don't add keyboard handlers if disabled (for clinical cases)
    if (disableKeyboardHandlers) return;
    
    // Use capture to ensure we get the event early
    window.addEventListener('keydown', shortcutHandler, { capture: true });
    return () => window.removeEventListener('keydown', shortcutHandler, { capture: true } as any);
  }, [shortcutHandler, disableKeyboardHandlers]);

  return (
    <motion.div
  ref={(el) => { rootRef.current = el; questionRef.current = el; }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 w-full max-w-full"
      onFocus={onFocus}
    >
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex-1 min-w-0 max-w-3xl">
          {!hideMeta && (
            <MCQHeader
              questionText={question.text}
              isSubmitted={submitted}
              questionNumber={question.number}
              session={question.session}
              lectureTitle={lectureTitle}
              specialtyName={specialtyName}
              questionId={question.id}
              highlightConfirm={highlightConfirm}
              hideMeta={hideMeta}
            />
          )}
          {hideMeta && (
            <HighlightableQuestionText
              questionId={question.id}
              text={question.text}
              className="mt-0 text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-snug break-words whitespace-pre-wrap"
              confirmMode={highlightConfirm}
            />
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
      
  {/* Media for explanation is displayed inside the "Rappel du cours" section below */}

      <div className="space-y-2">
        {normalizedOptions.map((option, index) => (
          <MCQOptionItem
            key={option.id}
            option={option}
            index={index}
            isSelected={selectedOptionIds.includes(option.id)}
            isSubmitted={submitted}
            isCorrect={correctAnswers.includes(option.id)}
            explanation={option.explanation}
            onSelect={handleOptionSelect}
            expandedExplanations={expandedExplanations}
            toggleExplanation={toggleExplanation}
            hideImmediateResults={hideImmediateResults}
            totalAttempts={totalSubmissions}
            optionPickCount={optionStats[option.id] || 0}
            questionId={question.id}
            enableHighlighting={enableOptionHighlighting}
            highlightConfirm={highlightConfirm}
          />
        ))}
      </div>

      {!hideActions && (
        <div ref={resultsRef}>
          <MCQActions
            isSubmitted={submitted}
            canSubmit={!hasSubmitted && !isSubmitting && selectedOptionIds.length > 0}
            isCorrect={isCorrect}
            onSubmit={handleSubmit}
            onNext={onNext}
            hasSubmitted={hasSubmitted || isSubmitting}
            buttonRef={buttonRef}
            showNotesArea={showNotesArea}
            hideNotesButton={false} // Always show notes button so users can hide/show notes
            onResubmit={handleResubmit}
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
        </div>
      )}

      {/* Custom action button (e.g. for revision mode) */}
      {customActionButton && (
        <div className="mt-4">
          {customActionButton}
        </div>
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
                        <div className="prose dark:prose-invert max-w-none text-base sm:text-lg">
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
            questionType="regular"
            onHasContentChange={setNotesHasContent}
            autoEdit={!notesHasContent && !notesManuallyControlled}
          />
        </div>
      )}

      {/* Commentaires (après soumission) */}
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
