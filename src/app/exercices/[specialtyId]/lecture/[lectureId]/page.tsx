'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useLecture } from '@/hooks/use-lecture'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { LectureTimer } from '@/components/lectures/LectureTimer'
import { LectureComplete } from '@/components/lectures/LectureComplete'
import { LectureLoadingState } from '@/components/lectures/LectureLoadingState'
import { QuestionControlPanel } from '@/components/lectures/QuestionControlPanel'
import { MCQQuestion } from '@/components/questions/MCQQuestion'
import { OpenQuestion } from '@/components/questions/OpenQuestion'
import { ClinicalCaseQuestion } from '@/components/questions/ClinicalCaseQuestion'
import { QuestionNotes } from '@/components/questions/QuestionNotes'
import { QuestionComments } from '@/components/questions/QuestionComments'
import { Button } from '@/components/ui/button'
import { ArrowLeft, PlusCircle, ListOrdered, Pin, PinOff, Flag, Pencil, Eye, EyeOff, Trash2, StickyNote, ChevronRight, BookOpen } from 'lucide-react'
import { GroupedQrocEditDialog } from '@/components/questions/edit/GroupedQrocEditDialog'
import { useTranslation } from 'react-i18next'
import { ClinicalCase, Question } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
// Card/collapsible also reused for grouped QROC shared reminder
import { QuestionManagementDialog } from '@/components/questions/QuestionManagementDialog'
import { useAuth } from '@/contexts/AuthContext'
// import ZoomableImage from '@/components/questions/ZoomableImage'
// import { LectureComments } from '@/components/lectures/LectureComments'

export default function LecturePageRoute() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [openQuestionsDialog, setOpenQuestionsDialog] = useState(false)
  const [openOrganizer, setOpenOrganizer] = useState(false)
  
  const lectureId = params?.lectureId as string
  const specialtyId = params?.specialtyId as string
  const mode = searchParams?.get('mode') // 'pinned' or null for all questions

  // Always call hooks at the top level
  const {
    lecture,
    questions,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    answerResults,
    isLoading,
    isComplete,
    currentQuestion,
  progress,
  pinnedQuestionIds,
    handleAnswerSubmit,
    handleClinicalCaseSubmit,
    handleNext,
    handleRestart,
    handleBackToSpecialty,
    handleQuestionUpdate,
  } = useLecture(lectureId, mode);

  // Optional: keep simple top anchor scroll without animations
  const contentTopRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (contentTopRef.current) {
      try { contentTopRef.current.scrollIntoView({ behavior: 'instant', block: 'start' } as any); } catch {}
    }
  }, [currentQuestionIndex]);

  if (!lectureId) {
    return <div>Lecture ID not found</div>
  }

  // Override back navigation to use nested route
  const handleBackToSpecialtyNested = () => {
    if (specialtyId) {
      router.push(`/exercices/${specialtyId}`)
    } else {
      handleBackToSpecialty()
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-gray-900 dark:to-blue-950/20">
          <div className="container mx-auto px-4 py-6">
             <LectureLoadingState />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!lecture) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-gray-900 dark:to-blue-950/20">
          <div className="container mx-auto px-4 py-12">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-md mx-auto">
                <div className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-8 shadow-lg">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    {t('lectures.lectureNotFound')}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    The lecture you&apos;re looking for doesn&apos;t exist or has been removed.
                  </p>
                  <Button 
                    onClick={handleBackToSpecialtyNested} 
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {t('common.back')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (isComplete) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-gray-900 dark:to-blue-950/20">
          <div className="container mx-auto px-4 py-6">
            <LectureComplete
              onRestart={handleRestart}
              onBackToSpecialty={handleBackToSpecialtyNested}
              questions={questions}
              answers={answers}
              answerResults={answerResults}
              lectureTitle={lecture.title}
              lectureId={lectureId}
            />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const handleQuestionSelect = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleMCQSubmit = (selectedOptionIds: string[], isCorrect: boolean) => {
    // Only handle regular questions here, clinical cases are handled separately
    // Check if this is actually a clinical case (has questions array) vs a regular question
    if (!('questions' in currentQuestion!)) {
      const question = currentQuestion as Question;

      handleAnswerSubmit(question.id, selectedOptionIds, isCorrect);
    }
    // Don't automatically move to next question - let user see the result first
  };

  const handleOpenSubmit = (answer: string, resultValue: boolean | 'partial') => {
    // Only handle regular questions here, clinical cases are handled separately
    // Check if this is actually a clinical case (has questions array) vs a regular question
    if (!('questions' in currentQuestion!)) {
      const question = currentQuestion as Question;

      // For open questions, we store the answer and the self-assessment result
      handleAnswerSubmit(question.id, answer, resultValue);
    }
    // Don't automatically move to next question - let user see the result first
  };

  const handleClinicalCaseComplete = (caseNumber: number, caseAnswers: Record<string, any>, caseResults: Record<string, boolean | 'partial'>) => {
    handleClinicalCaseSubmit(caseNumber, caseAnswers, caseResults);
    // Log one activity event per clinical case completion
    try {
      fetch('/api/user-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'clinical_case_attempt' })
      }).catch(()=>{});
    } catch {}
  };

  const renderCurrentQuestion = () => {
    console.log('renderCurrentQuestion called:', {
      currentQuestion: currentQuestion,
      currentQuestionIndex,
      questionsLength: questions.length
    });
    
    if (!currentQuestion) {
      console.log('No current question - returning null');
      return null;
    }

    // Check if current question is a clinical case or a grouped multi-QROC (all subquestions type qroc)
    if ('caseNumber' in currentQuestion && 'questions' in currentQuestion) {
      const clinicalCase = currentQuestion as ClinicalCase;
      const isGroupedQrocOnly = clinicalCase.questions.every(q => q.type === 'qroc');
      
      // Add null checks for questions array
      if (!clinicalCase.questions || !Array.isArray(clinicalCase.questions)) {
        console.error('Invalid clinical case structure:', clinicalCase);
        return null;
      }
      
      const isAnswered = clinicalCase.questions.every(q => answers[q.id] !== undefined);
      const caseAnswerResult = isAnswered ? 
        (clinicalCase.questions.every(q => answerResults[q.id] === true) ? true : 
         clinicalCase.questions.some(q => answerResults[q.id] === true || answerResults[q.id] === 'partial') ? 'partial' : false) : 
        undefined;
      
      const caseUserAnswers: Record<string, any> = {};
      const caseAnswerResults: Record<string, boolean | 'partial'> = {};
      clinicalCase.questions.forEach(q => {
        if (answers[q.id] !== undefined) {
          caseUserAnswers[q.id] = answers[q.id];
        }
        if (answerResults[q.id] !== undefined) {
          caseAnswerResults[q.id] = answerResults[q.id];
        }
      });

      if (!isGroupedQrocOnly) {
        return (
          <ClinicalCaseQuestion
            clinicalCase={clinicalCase}
            onSubmit={handleClinicalCaseComplete}
            onNext={handleNext}
            lectureId={lectureId}
            lectureTitle={lecture?.title}
            specialtyName={lecture?.specialty?.name}
            isAnswered={isAnswered}
            answerResult={caseAnswerResult}
            userAnswers={caseUserAnswers}
            answerResults={caseAnswerResults}
            onAnswerUpdate={handleAnswerSubmit}
          />
        );
      }

      return (
        <GroupedQrocContainer
          clinicalCase={clinicalCase}
          answers={answers}
          answerResults={answerResults}
          pinnedQuestionIds={pinnedQuestionIds}
          user={user}
          lecture={lecture}
          lectureId={lectureId}
          specialtyId={specialtyId as string}
          onAnswerSubmit={handleAnswerSubmit}
          onNext={handleNext}
          onQuestionUpdate={handleQuestionUpdate}
          setOpenQuestionsDialog={setOpenQuestionsDialog}
        />
      );
    }

    // Regular question handling
    const isAnswered = answers[currentQuestion.id] !== undefined;
    const answerResult = answerResults[currentQuestion.id];
    const userAnswer = answers[currentQuestion.id];
    

    
    if (currentQuestion.type === 'mcq') {
      return (
        <MCQQuestion
          question={currentQuestion}
          onSubmit={handleMCQSubmit}
          onNext={handleNext}
          lectureId={lectureId}
          lectureTitle={lecture?.title}
          specialtyName={lecture?.specialty?.name}
          isAnswered={isAnswered}
          answerResult={answerResult}
          userAnswer={userAnswer}
          onQuestionUpdate={handleQuestionUpdate}
          highlightConfirm
          enableOptionHighlighting={true}
        />
      );
    } else {
      return (
        <OpenQuestion
          question={currentQuestion}
          onSubmit={handleOpenSubmit}
          onNext={handleNext}
          lectureId={lectureId}
          lectureTitle={lecture?.title}
          specialtyName={lecture?.specialty?.name}
          isAnswered={isAnswered}
          answerResult={answerResult}
          userAnswer={userAnswer}
          onQuestionUpdate={handleQuestionUpdate}
          highlightConfirm
          enableAnswerHighlighting={true}
        />
      );
    }
  };


  // Removed animated variants (restored static rendering)

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 pb-10 lg:pb-0">
            <div className="flex-1 space-y-4 sm:space-y-6 min-w-0 w-full max-w-full">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3">
                {/* Back to specialty button */}
                <Button
                  onClick={handleBackToSpecialtyNested}
                  variant="ghost"
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 w-fit"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Specialty</span>
                </Button>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {(user?.role === 'admin' || user?.role === 'maintainer') && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenQuestionsDialog(true)}
                        className="whitespace-nowrap"
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">creer</span>
                      </Button>
                      {user?.role === 'admin' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setOpenOrganizer(true); setOpenQuestionsDialog(true); }}
                          className="whitespace-nowrap"
                        >
                          <ListOrdered className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Organiser</span>
                        </Button>
                      )}
                    </>
                  )}
                  <LectureTimer lectureId={lectureId} />
                </div>
              </div>

              <div ref={contentTopRef} className="space-y-4 sm:space-y-6">
                {currentQuestion && renderCurrentQuestion()}
              </div>
            </div>

            <div className="hidden lg:block lg:w-80 lg:flex-shrink-0">
              <QuestionControlPanel
                questions={questions}
                currentQuestionIndex={currentQuestionIndex}
                answers={answers}
                answerResults={answerResults}
                onQuestionSelect={handleQuestionSelect}
                onPrevious={handlePrevious}
                onNext={handleNext}
                isComplete={isComplete}
                pinnedIds={pinnedQuestionIds}
              />
            </div>
          </div>
          
          {/* Mobile Control Panel - rendered separately to avoid layout issues */}
          <div className="lg:hidden mt-4 sm:mt-6">
            <QuestionControlPanel
              questions={questions}
              currentQuestionIndex={currentQuestionIndex}
              answers={answers}
              answerResults={answerResults}
              onQuestionSelect={handleQuestionSelect}
              onPrevious={handlePrevious}
              onNext={handleNext}
              isComplete={isComplete}
              pinnedIds={pinnedQuestionIds}
            />
          </div>
            
        </div>
      </div>
    {/* Admin and Maintainer: Maintainers can create/edit, but not organizer */}
    {(user?.role === 'admin' || user?.role === 'maintainer') && lecture && (
        <QuestionManagementDialog
          lecture={lecture}
          isOpen={openQuestionsDialog}
      onOpenChange={(o)=>{ setOpenQuestionsDialog(o); if(!o) setOpenOrganizer(false); }}
      initialOrganizerOpen={user?.role === 'admin' ? openOrganizer : false}
          initialCreateOpen
        />
      )}
    </ProtectedRoute>
  )
}
// Local helper component: grouped QROC aggregated notes gating
function GroupedQrocContainer({ clinicalCase, answers, answerResults, pinnedQuestionIds, user, lecture, lectureId, specialtyId, onAnswerSubmit, onNext, onQuestionUpdate, setOpenQuestionsDialog }: any) {
  const [openNotes, setOpenNotes] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [openGroupEdit, setOpenGroupEdit] = useState(false);
  const [notesHasContent, setNotesHasContent] = useState(false); // track if notes have content
  const notesRef = useRef<HTMLDivElement | null>(null);

  // Auto-close notes when content becomes empty
  useEffect(() => {
    if (!notesHasContent) {
      setOpenNotes(false);
    }
  }, [notesHasContent]);

  const groupAnswered = clinicalCase.questions.every((q: any) => answers[q.id] !== undefined);
  const groupPinned = clinicalCase.questions.some((q: any) => pinnedQuestionIds.includes(q.id));
  const groupHidden = clinicalCase.questions.every((q: any) => (q as any).hidden);

  const toggleGroupPin = async () => {
    for (const q of clinicalCase.questions) {
      try {
        if (!groupPinned) {
          await fetch('/api/pinned-questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user?.id, questionId: q.id }) });
        } else {
          await fetch(`/api/pinned-questions?userId=${user?.id}&questionId=${q.id}`, { method: 'DELETE' });
        }
      } catch {}
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('pinned-updated'));
  };

  const toggleGroupHidden = async () => {
    for (const q of clinicalCase.questions) {
      try {
        await fetch(`/api/questions/${q.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ hidden: !groupHidden }) });
        onQuestionUpdate(q.id, { hidden: !groupHidden });
      } catch {}
    }
  };



  return (
    <div className="space-y-2" data-grouped-qroc>
      <div className="rounded-xl border bg-white/90 dark:bg-gray-800/90 p-3 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Groupe QROC #{clinicalCase.caseNumber}</h2>
          <div className="text-xs text-gray-500 dark:text-gray-400">{clinicalCase.totalQuestions} QROC</div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={toggleGroupPin} className="flex items-center gap-1">
            {groupPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{groupPinned ? 'Unpin' : 'Pin'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => { window.location.href = `/exercices/${specialtyId}/lecture/${lectureId}?report=${clinicalCase.questions[0].id}`; }} className="flex items-center gap-1">
            <Flag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Signaler</span>
          </Button>
          {(user?.role === 'admin' || user?.role === 'maintainer') && (
            <Button variant="outline" size="sm" onClick={() => setOpenGroupEdit(true)} className="flex items-center gap-1" title="Edit bloc QROC">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'maintainer') && (
            <Button variant="outline" size="sm" onClick={toggleGroupHidden} className="flex items-center gap-1" title={groupHidden ? 'Unhide' : 'Hide'}>
              {groupHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Button>
          )}
          {user?.role === 'admin' && (
            <Button variant="outline" size="sm" className="flex items-center gap-1 text-destructive" onClick={async () => { if (!confirm('Delete all questions in group?')) return; for (const q of clinicalCase.questions) { try { await fetch(`/api/questions/${q.id}`, { method: 'DELETE', credentials: 'include' }); } catch {} } window.location.reload(); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="grid gap-2">
          {clinicalCase.questions.map((q: any) => {
            const answered = answers[q.id] !== undefined;
            const resultVal = answerResults[q.id];
            const userAnswerVal = answers[q.id];
            return (
              <OpenQuestion
                key={q.id}
                question={q as any}
                onSubmit={(ans, res) => {
                  onAnswerSubmit(q.id, ans, res);
                  try {
                    fetch('/api/user-activity', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'qroc_attempt' })
                    }).catch(()=>{});
                  } catch {}
                }}
                onNext={onNext}
                lectureId={lectureId}
                lectureTitle={lecture?.title}
                specialtyName={lecture?.specialty?.name}
                isAnswered={answered}
                answerResult={resultVal}
                userAnswer={userAnswerVal}
                hideNotes
                hideComments
                hideActions
                highlightConfirm
                onQuestionUpdate={onQuestionUpdate}
                resetSignal={resetCounter}
                // behave like simple QROC: hide textarea after submit, so do not keep input mounted
                suppressReminder
              />
            );
          })}
        </div>
        {/* Single shared reminder displayed once after all sub-questions answered */}
        {groupAnswered && (() => {
          const firstWithReminder = clinicalCase.questions.find((q: any) => (q.course_reminder || (q as any).courseReminder || (q as any).course_reminder_media_url));
          const text = firstWithReminder ? ((firstWithReminder as any).course_reminder || (firstWithReminder as any).courseReminder || firstWithReminder.explanation) : '';
          const mediaUrl = firstWithReminder ? ((firstWithReminder as any).course_reminder_media_url || (firstWithReminder as any).courseReminderMediaUrl) : undefined;
          const mediaType = firstWithReminder ? ((firstWithReminder as any).course_reminder_media_type || (firstWithReminder as any).courseReminderMediaType) : undefined;
          if (!text && !mediaUrl) return null;
          return (
            <Card className="mt-4">
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
                      {mediaUrl && (mediaType === 'image' || /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(mediaUrl)) && (
                        <img src={mediaUrl} alt="Image du rappel" className="max-h-80 w-auto object-contain rounded-md border" />
                      )}
                      {text && (
                        <div className="prose dark:prose-invert max-w-none text-sm">
                          <div className="whitespace-pre-wrap text-foreground">{text}</div>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </CardHeader>
            </Card>
          );
        })()}
        {groupAnswered && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 flex-wrap">
              <div className="flex gap-2 flex-wrap justify-end">
                {groupAnswered && !notesHasContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpenNotes(p => !p);
                      if (!openNotes) setTimeout(() => { notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
                    }}
                    className="flex items-center gap-1"
                  >
                    <StickyNote className="h-4 w-4" />
                    <span className="hidden sm:inline">{openNotes ? 'Fermer les notes' : 'Prendre une note'}</span>
                  </Button>
                )}

                <Button onClick={onNext} size="sm" className="flex items-center gap-1">
                  <span className="hidden sm:inline">Suivant</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div ref={notesRef} className="space-y-6">
              {(openNotes || (groupAnswered && notesHasContent)) && (
                <QuestionNotes 
                  questionId={`group-qroc-${clinicalCase.caseNumber}`} 
                  onHasContentChange={setNotesHasContent}
                  autoEdit={openNotes && !notesHasContent} // Auto-edit when manually opened and empty
                />
              )}
              <QuestionComments questionId={`group-qroc-${clinicalCase.caseNumber}`} />
            </div>
          </div>
        )}
      </div>
      {openGroupEdit && (
        <GroupedQrocEditDialog
          caseNumber={clinicalCase.caseNumber}
          questions={clinicalCase.questions}
          isOpen={openGroupEdit}
          onOpenChange={setOpenGroupEdit}
          onSaved={() => { try { window.location.reload(); } catch {} }}
        />
      )}
    </div>
  );
}
            
