"use client";
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Button } from "../ui/button";
import { ChevronRight } from "lucide-react";
import { MCQQuestion } from './MCQQuestion';
import { OpenQuestion } from './OpenQuestion';

/**
 * ProgressiveClinicalCase (refactored)
 * Phase 1: Progressive answering with minimal lightweight UI (case text -> Q1 -> Q2 ...)
 * Phase 2: Review mode re-renders each sub-question using the platform's standard MCQ/Open components
 *          showing explanations, reminders, correctness, etc., for visual consistency.
 * Enter key behaviour:
 *  - From case intro: shows first question
 *  - While answering a sub-question: Enter locks answer & advances (if answered)
 *  - After final question locked: auto-switch to review (or user can click) then Enter moves to next case
 */

export interface ProgressiveClinicalCaseQuestion {
  id: string;
  type: 'qcm' | 'qroc';
  text: string;
  options?: string[];
  correctAnswers?: string[];
  explanation?: string | null;
  referenceAnswer?: string | null;
  course_reminder?: string | null;
  courseReminder?: string | null;
  correct_answers?: string[]; // legacy alias consumed by MCQQuestion/OpenQuestion
}

export interface ProgressiveClinicalCaseProps {
  caseId: string;
  caseText: string;
  questions: ProgressiveClinicalCaseQuestion[];
  onAnswerSubmit: (qId: string, answer: { selectedOptions?: string[]; textAnswer?: string }) => void;
  onComplete: () => void;
  onNextCase: () => void;
  autoFocus?: boolean;
}

export const ProgressiveClinicalCase: React.FC<ProgressiveClinicalCaseProps> = ({
  caseId, // not used yet but kept for future notes/comments feature
  caseText,
  questions,
  onAnswerSubmit,
  onComplete,
  onNextCase,
  autoFocus
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(-1); // -1 = only case text
  const [answers, setAnswers] = useState<Record<string, { selectedOptions?: string[]; textAnswer?: string; locked?: boolean; isCorrect?: boolean | 'partial' }>>({});
  const [completed, setCompleted] = useState(false); // all sub-questions answered
  const [reviewMode, setReviewMode] = useState(false); // show full MCQ/Open components
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Client side lightweight evaluation (boolean only, partial unused for now for MCQ; open treated heuristically)
  const evaluate = (q: ProgressiveClinicalCaseQuestion, a: { selectedOptions?: string[]; textAnswer?: string }) => {
    if (q.type === 'qcm') {
      if (!q.correctAnswers || !a.selectedOptions) return undefined;
      const expected = q.correctAnswers.map(c => c.trim().toLowerCase()).sort();
      const got = a.selectedOptions.map(c => c.trim().toLowerCase()).sort();
      return JSON.stringify(expected) === JSON.stringify(got);
    } else {
      if (!q.referenceAnswer || !a.textAnswer) return undefined;
      const ref = q.referenceAnswer.trim().toLowerCase();
      const user = a.textAnswer.trim().toLowerCase();
      if (!ref || !user) return undefined;
      if (user === ref) return true;
      if (ref.length > 8 && (user.includes(ref) || ref.includes(user))) return true; // basic inclusion heuristic
      return false;
    }
  };

  // Prepare enriched question objects for review (reuse explanation/reminder channels)
  const reviewQuestions = useMemo(() => {
    if (!reviewMode) return [] as ProgressiveClinicalCaseQuestion[];
    return questions.map(q => ({
      ...q,
      correct_answers: q.correctAnswers,
      correctAnswers: q.correctAnswers,
      course_reminder: q.explanation || q.referenceAnswer || q.course_reminder || q.courseReminder || null,
      courseReminder: q.explanation || q.referenceAnswer || q.courseReminder || q.course_reminder || null,
      explanation: q.explanation || null
    }));
  }, [questions, reviewMode]);

  // Global Enter key navigation
  const handleEnter = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (e.isComposing) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && active.tagName === 'TEXTAREA') {
      if (e.shiftKey) return; // allow newline with Shift+Enter
      e.preventDefault();
    }
    // Review mode: Enter directly advances to next case
    if (reviewMode) {
      e.preventDefault();
      onNextCase();
      return;
    }
    if (!completed) {
      if (currentIndex === -1) { // show first question
        e.preventDefault();
        setCurrentIndex(0);
        return;
      }
      const q = questions[currentIndex];
      const a = answers[q.id];
      if (!a || ((q.type === 'qroc') && (!a.textAnswer || !a.textAnswer.trim())) || (q.type === 'qcm' && (!a.selectedOptions || a.selectedOptions.length === 0))) {
        return; // require an answer
      }
      if (!a.locked) {
        setAnswers(prev => ({ ...prev, [q.id]: { ...a, locked: true } }));
      }
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(i => i + 1);
      } else {
        // Complete sequence
        setCompleted(true);
        setAnswers(prev => {
          const updated = { ...prev };
            questions.forEach(q2 => {
            const a2 = updated[q2.id];
            if (a2) {
              const isCorrect = evaluate(q2, a2);
              updated[q2.id] = { ...a2, isCorrect };
            }
          });
          return updated;
        });
        onComplete();
        setTimeout(() => {
          containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 40);
        // Auto enter review mode after short delay
        setTimeout(() => setReviewMode(true), 140);
      }
    }
  }, [reviewMode, completed, currentIndex, answers, questions, onComplete]);

  useEffect(() => {
    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [handleEnter]);

  // Answer handlers
  const toggleOption = (qId: string, option: string) => {
    setAnswers(prev => {
      const existing = prev[qId]?.selectedOptions || [];
      const locked = prev[qId]?.locked;
      if (locked) return prev;
      const next = existing.includes(option) ? existing.filter(o => o !== option) : [...existing, option];
      const record = { ...prev[qId], selectedOptions: next };
      onAnswerSubmit(qId, { selectedOptions: next });
      return { ...prev, [qId]: record };
    });
  };
  const setTextAnswer = (qId: string, text: string) => {
    setAnswers(prev => {
      if (prev[qId]?.locked) return prev;
      const record = { ...prev[qId], textAnswer: text };
      onAnswerSubmit(qId, { textAnswer: text });
      return { ...prev, [qId]: record };
    });
  };

  return (
    <div ref={containerRef} className="space-y-4" data-progressive-clinical-case>
      {!reviewMode && (
        <div className="rounded-xl border bg-white/90 dark:bg-gray-800/90 p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Cas clinique</h2>
          {caseText && <div className="whitespace-pre-wrap text-sm mb-4 text-muted-foreground">{caseText}</div>}
          {currentIndex === -1 && !completed && (
            <div className="flex justify-end">
              <Button onClick={() => setCurrentIndex(0)} autoFocus={autoFocus}>Commencer <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          )}
          {currentIndex > -1 && (
            <div className="space-y-6">
              {questions.slice(0, currentIndex + 1).map((q, idx) => {
                const a = answers[q.id];
                const isCurrent = idx === currentIndex && !completed;
                return (
                  <div key={q.id} className={`rounded-md border p-3 ${isCurrent ? 'ring-2 ring-blue-400/40 border-blue-300 dark:border-blue-700' : 'border-muted'}`}>
                    <div className="text-sm font-medium mb-2 flex items-start gap-2">
                      <span className="text-xs rounded bg-blue-100 dark:bg-blue-900 px-2 py-0.5 font-semibold text-blue-700 dark:text-blue-300">{idx + 1}</span>
                      <span>{q.text}</span>
                    </div>
                    {q.type === 'qcm' && (
                      <div className="space-y-2">
                        {(q.options || []).map(opt => {
                          const selected = (a?.selectedOptions || []).includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              disabled={!!a?.locked && !selected}
                              onClick={() => toggleOption(q.id, opt)}
                              className={`w-full text-left text-sm px-3 py-2 rounded border transition ${selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700/40'} ${a?.locked ? 'opacity-70 cursor-default' : ''}`}
                            >{opt}</button>
                          );
                        })}
                        {isCurrent && <p className="text-xs text-muted-foreground">Sélectionnez vos réponses puis Entrée.</p>}
                      </div>
                    )}
                    {q.type === 'qroc' && (
                      <div>
                        <textarea
                          className="w-full rounded-md border bg-background dark:bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/20 focus-visible:border-blue-400"
                          placeholder="Votre réponse..."
                          value={a?.textAnswer || ''}
                          disabled={!!a?.locked}
                          onChange={e => setTextAnswer(q.id, e.target.value)}
                          rows={3}
                        />
                        {isCurrent && <p className="text-xs text-muted-foreground mt-1">Répondez puis Entrée.</p>}
                      </div>
                    )}
                    {a?.locked && !completed && <div className="mt-2 text-[11px] text-muted-foreground">Entrée pour continuer.</div>}
                  </div>
                );
              })}
            </div>
          )}
          {completed && (
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">Réponses enregistrées.</div>
              <Button size="sm" variant="outline" onClick={() => setReviewMode(true)}>Afficher la correction</Button>
            </div>
          )}
        </div>
      )}
      {reviewMode && (
        <div className="space-y-8">
          <div className="rounded-xl border bg-white/90 dark:bg-gray-800/90 p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Cas clinique - Correction</h2>
            {caseText && <div className="whitespace-pre-wrap text-xs mb-4 text-muted-foreground">{caseText}</div>}
            <div className="space-y-10">
              {reviewQuestions.map((q, idx) => {
                const a = answers[q.id];
                const userAnswerArr = a?.selectedOptions || [];
                const userOpenAns = a?.textAnswer || '';
                if (q.type === 'qcm') {
                  const mcqQuestion: any = {
                    id: q.id,
                    text: q.text,
                    type: 'mcq',
                    options: (q.options || []).map((o, i) => ({ id: String(i), text: o })),
                    correctAnswers: q.correctAnswers,
                    correct_answers: q.correctAnswers,
                    explanation: q.explanation,
                    course_reminder: q.explanation,
                    number: idx + 1
                  };
                  return (
                    <div key={q.id} className="pt-2 border-t first:border-t-0 first:pt-0">
                      <MCQQuestion
                        question={mcqQuestion}
                        onSubmit={() => {}}
                        onNext={() => {}}
                        isAnswered={true}
                        answerResult={a?.isCorrect === true}
                        userAnswer={userAnswerArr}
                        hideImmediateResults={false}
                        hideActions
                        hideComments
                        hideNotes
                        highlightConfirm
                        suppressReminder={false}
                        enableOptionHighlighting
                        hideMeta
                      />
                    </div>
                  );
                } else {
                  const openQuestion: any = {
                    id: q.id,
                    text: q.text,
                    type: 'qroc',
                    explanation: q.referenceAnswer || q.explanation,
                    course_reminder: q.referenceAnswer || q.explanation,
                    correctAnswers: [q.referenceAnswer || ''],
                    correct_answers: [q.referenceAnswer || ''],
                    number: idx + 1
                  };
                  return (
                    <div key={q.id} className="pt-2 border-t first:border-t-0 first:pt-0">
                      <OpenQuestion
                        question={openQuestion}
                        onSubmit={() => {}}
                        onNext={() => {}}
                        isAnswered={true}
                        answerResult={a?.isCorrect === true ? true : (a?.isCorrect === false ? false : 'partial')}
                        userAnswer={userOpenAns}
                        hideImmediateResults={false}
                        hideActions
                        hideComments
                        hideNotes
                        highlightConfirm
                        suppressReminder={false}
                        hideMeta
                        enableAnswerHighlighting
                      />
                    </div>
                  );
                }
              })}
            </div>
            <div className="mt-8 flex justify-end"><Button onClick={onNextCase}>Suivant <ChevronRight className="h-4 w-4 ml-1" /></Button></div>
          </div>
          <div className="text-center text-xs text-muted-foreground">Entrée pour continuer</div>
        </div>
      )}
      {!reviewMode && !completed && currentIndex > -1 && currentIndex < questions.length && (<div className="text-center text-xs text-muted-foreground">Entrée pour valider et continuer</div>)}
      {!reviewMode && completed && (<div className="text-center text-xs text-muted-foreground">Vous pouvez afficher la correction ou appuyer sur Entrée pour passer</div>)}
    </div>
  );
};

export default ProgressiveClinicalCase;
