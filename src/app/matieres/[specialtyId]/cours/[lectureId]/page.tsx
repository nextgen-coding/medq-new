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
// ProgressiveClinicalCase temporarily disabled in favor of legacy ClinicalCaseQuestion UI
// import ProgressiveClinicalCase from '@/components/questions/ProgressiveClinicalCase'
import { QuestionNotes } from '@/components/questions/QuestionNotes'
import { QuestionComments } from '@/components/questions/QuestionComments'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Clock, ArrowLeft, ArrowRight, Eye, EyeOff, Settings, RotateCcw, X, Pin, Flag, Pencil, Trash2, StickyNote, ChevronRight, PinOff, CheckCircle, Circle, AlertCircle, FileText, PlusCircle, Loader2, ChevronDown, ChevronUp, Download, Upload, MoreVertical, Play, Pause, Save, Edit, Share, Copy, Check, ListOrdered, List, Grid, Filter, Search, Home, User, Menu, Info, Star, BookOpen, Book, ArrowUp, ArrowDown, RefreshCw, Plus, Minus } from 'lucide-react'
import { GroupedQrocEditDialog } from '@/components/questions/edit/GroupedQrocEditDialog'
import { GroupedMcqEditDialog } from '@/components/questions/edit/GroupedMcqEditDialog'
import { ClinicalCaseEditDialog } from '@/components/questions/edit/ClinicalCaseEditDialog'
import { useTranslation } from 'react-i18next'
import { ClinicalCase, Question } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
// Card/collapsible also reused for grouped QROC shared reminder
import { QuestionManagementDialog } from '@/components/questions/QuestionManagementDialog'
import { QuestionEditDialog } from '@/components/questions/QuestionEditDialog'
import { ReportQuestionDialog } from '@/components/questions/ReportQuestionDialog'
import { OrganizerProvider } from '@/contexts/OrganizerContext'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
// import ZoomableImage from '@/components/questions/ZoomableImage'
// import { LectureComments } from '@/components/lectures/LectureComments'

export default function CoursPageRoute() {
  const params = useParams()
  const searchParams = useSearchParams()
  // Render only one control panel variant depending on screen size to avoid duplicate mounts
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)') // lg breakpoint
    const update = () => setIsLargeScreen(prev => (prev !== mq.matches ? mq.matches : prev))
    update()
    mq.addEventListener?.('change', update as any)
    return () => mq.removeEventListener?.('change', update as any)
  }, [])
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [openQuestionsDialog, setOpenQuestionsDialog] = useState(false)
  const [openOrganizer, setOpenOrganizer] = useState(false)
  const [openAdminDialog, setOpenAdminDialog] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false)
  // Editors for clinical/grouped blocks
  const [openClinicalCaseEdit, setOpenClinicalCaseEdit] = useState(false)
  const [openGroupedQrocEdit, setOpenGroupedQrocEdit] = useState(false)
  const [openGroupedMcqEdit, setOpenGroupedMcqEdit] = useState(false)
  // Notes visibility state
  const [showAllNotes, setShowAllNotes] = useState(false)
  
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

  // Update pinned state when current question changes
  useEffect(() => {
    if (currentQuestion) {
      if ('questions' in currentQuestion) {
        // For clinical cases, check if any subquestion is pinned
        const clinicalCase = currentQuestion as ClinicalCase;
        const isAnyPinned = clinicalCase.questions.some(q => pinnedQuestionIds.includes(q.id));
        setIsPinned(isAnyPinned);
      } else {
        // Regular question
        const questionId = (currentQuestion as Question).id;
        setIsPinned(pinnedQuestionIds.includes(questionId));
      }
    }
  }, [currentQuestion, pinnedQuestionIds]);

  if (!lectureId) {
    return <div>ID de cours introuvable</div>
  }

  // Override back navigation to use nested route
  const handleBackToSpecialtyNested = () => {
    if (specialtyId) {
      router.push(`/matieres/${specialtyId}`)
    } else {
      handleBackToSpecialty()
    }
  }


  // Always render the page layout, but show skeletons for question area and icons while loading


  if (!isLoading && !lecture) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-gray-900 dark:to-blue-950/20">
          <div className="container mx-auto px-4 py-12">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-md mx-auto">
                <div className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-8 shadow-lg">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Cours introuvable
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Le cours que vous recherchez n'existe pas ou a été supprimé.
                  </p>
                  <Button 
                    onClick={handleBackToSpecialtyNested} 
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Retour
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
              lectureTitle={lecture ? lecture.title : ''}
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

  const handleNotesVisibilityChange = (showAll: boolean) => {
    setShowAllNotes(showAll);
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

  // Pin/unpin handlers for current question
  const handlePinQuestion = async () => {
    if (!currentQuestion || !user?.id) return;
    
    // For clinical cases, pin the first subquestion (representing the whole case)
    if ('questions' in currentQuestion) {
      const clinicalCase = currentQuestion as ClinicalCase;
      const questionId = clinicalCase.questions[0]?.id;
      if (!questionId) return;
      
      try {
        const response = await fetch('/api/pinned-questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            questionId,
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
    } else {
      // Regular question
      const questionId = (currentQuestion as Question).id;
      try {
        const response = await fetch('/api/pinned-questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            questionId,
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
    }
  };

  const handleUnpinQuestion = async () => {
    if (!currentQuestion || !user?.id) return;
    
    // For clinical cases, unpin the first subquestion (representing the whole case)
    if ('questions' in currentQuestion) {
      const clinicalCase = currentQuestion as ClinicalCase;
      const questionId = clinicalCase.questions[0]?.id;
      if (!questionId) return;
      
      try {
        const response = await fetch(`/api/pinned-questions?userId=${user.id}&questionId=${questionId}`, {
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
    } else {
      // Regular question
      const questionId = (currentQuestion as Question).id;
      try {
        const response = await fetch(`/api/pinned-questions?userId=${user.id}&questionId=${questionId}`, {
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
    }
  };

  const handleToggleQuestionVisibility = async () => {
    if (!currentQuestion || !user?.id) return;
    
    // For clinical cases, toggle visibility of all subquestions
    if ('questions' in currentQuestion) {
      const clinicalCase = currentQuestion as ClinicalCase;
      const firstQuestion = clinicalCase.questions[0];
      if (!firstQuestion) return;
      
      const newHiddenState = !firstQuestion.hidden;
      
      try {
        setIsTogglingVisibility(true);
        
        for (const question of clinicalCase.questions) {
          const res = await fetch(`/api/questions/${question.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ hidden: newHiddenState })
          });
          
          if (!res.ok) throw new Error('Failed');
          
          // Update the question in the current state
          handleQuestionUpdate(question.id, { hidden: newHiddenState });
        }
        
        // Show toast
        toast({
          title: newHiddenState ? 'Cas clinique masqué' : 'Cas clinique visible',
          description: newHiddenState 
            ? 'Le cas clinique est maintenant masqué des étudiants' 
            : 'Le cas clinique est maintenant visible aux étudiants'
        });
        
      } catch (error) {
        console.error('Error toggling visibility:', error);
      } finally {
        setIsTogglingVisibility(false);
      }
    } else {
      // Regular question
      const question = currentQuestion as Question;
      const newHiddenState = !question.hidden;
      
      try {
        setIsTogglingVisibility(true);
        
        const res = await fetch(`/api/questions/${question.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ hidden: newHiddenState })
        });
        
        if (!res.ok) throw new Error('Failed');
        
        // Update the question in the current state
        handleQuestionUpdate(question.id, { hidden: newHiddenState });
        
        // Show toast
        toast({
          title: newHiddenState ? 'Question masquée' : 'Question visible',
          description: newHiddenState 
            ? 'La question est maintenant masquée des étudiants' 
            : 'La question est maintenant visible aux étudiants'
        });
        
      } catch (error) {
        console.error('Error toggling visibility:', error);
      } finally {
        setIsTogglingVisibility(false);
      }
    }
  };

  const handleDeleteCurrentQuestion = async () => {
    if (!currentQuestion || !user?.id || user.role !== 'admin') return;
    
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette question ?')) return;
    
    try {
      if ('questions' in currentQuestion) {
        // For clinical cases, delete all subquestions
        const clinicalCase = currentQuestion as ClinicalCase;
        for (const question of clinicalCase.questions) {
          const res = await fetch(`/api/questions/${question.id}`, { 
            method: 'DELETE', 
            credentials: 'include' 
          });
          if (!res.ok) throw new Error('Failed to delete question');
        }
      } else {
        // Regular question
        const question = currentQuestion as Question;
        const res = await fetch(`/api/questions/${question.id}`, { 
          method: 'DELETE', 
          credentials: 'include' 
        });
        if (!res.ok) throw new Error('Failed to delete question');
      }
      
      // Reload the page to refresh the questions list
      window.location.reload();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la question',
        variant: 'destructive'
      });
    }
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

    // Use original ClinicalCaseQuestion UI for clinical/grouped cases
    if ('caseNumber' in currentQuestion && 'questions' in currentQuestion) {
      let clinicalCase = currentQuestion as ClinicalCase;
      // Normalize sub-question types to legacy 'clinic_mcq' / 'clinic_croq' expected by ClinicalCaseQuestion
      if (clinicalCase.questions.some(q => q.type === 'mcq' || q.type === 'qroc')) {
        clinicalCase = {
          ...clinicalCase,
          questions: clinicalCase.questions.map(q => {
            if (q.type === 'mcq') return { ...q, type: 'clinic_mcq' } as any;
            if (q.type === 'qroc' || (q.type as any) === 'open') return { ...q, type: 'clinic_croq' } as any;
            return q;
          })
        } as ClinicalCase;
      }
      return (
        <ClinicalCaseQuestion
          key={`case-${clinicalCase.caseNumber}`}
          clinicalCase={clinicalCase}
          onSubmit={handleClinicalCaseComplete}
          onNext={handleNext}
          lectureId={lectureId}
          lectureTitle={lecture?.title}
          specialtyName={lecture?.specialty?.name}
          displayMode={(clinicalCase.questions.every(q=> q.type==='clinic_croq') ? 'multi_qroc' : clinicalCase.questions.every(q=> q.type==='clinic_mcq') ? 'multi_qcm' : 'clinical') as any}
          isAnswered={clinicalCase.questions.every(q=> answers[q.id] !== undefined)}
          answerResult={(() => {
            const resVals = clinicalCase.questions.map(q => answerResults[q.id]).filter(r => r !== undefined);
            if (!resVals.length) return undefined;
            if (resVals.every(r => r === true)) return true;
            if (resVals.some(r => r === true || r === 'partial')) return 'partial';
            return false;
          })() as any}
          userAnswers={answers}
          answerResults={answerResults}
          onAnswerUpdate={(qid, ans, res) => handleAnswerSubmit(qid, ans as any, res as any)}
        />
      );
    }

  // Regular question handling
  const revisionMode = mode === 'revision';
  const isAnswered = revisionMode ? true : (answers[currentQuestion.id] !== undefined);
  const answerResult = revisionMode ? true : answerResults[currentQuestion.id];
  const userAnswer = revisionMode
    ? (currentQuestion.type === 'mcq'
      ? (currentQuestion.correct_answers || currentQuestion.correctAnswers || [])
      : ((currentQuestion as any).correctAnswers || (currentQuestion as any).correct_answers || (currentQuestion as any).course_reminder || (currentQuestion as any).explanation || ''))
    : answers[currentQuestion.id];
    

    
  if (currentQuestion.type === 'mcq') {
      return (
        <MCQQuestion
          key={currentQuestion.id}
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
          highlightConfirm={!revisionMode}
          hideMeta
          enableOptionHighlighting={true}
          hideActions={revisionMode}
          showNotesAfterSubmit={isAnswered}
          // Ensure keyboard shortcuts (digits/letters, Enter) are active on this route
          isActive={true}
        />
      );
    } else {
      return (
        <OpenQuestion
          key={currentQuestion.id}
          question={currentQuestion}
          onSubmit={handleOpenSubmit}
          onNext={handleNext}
          lectureId={lectureId}
          lectureTitle={lecture?.title}
          specialtyName={lecture?.specialty?.name}
          isAnswered={isAnswered}
          answerResult={answerResult}
          userAnswer={userAnswer as any}
          onQuestionUpdate={handleQuestionUpdate}
          highlightConfirm={!revisionMode}
          hideMeta={(currentQuestion as any).type === 'qroc'}
          enableAnswerHighlighting={true}
          hideActions={revisionMode}
          showNotesAfterSubmit={isAnswered}
        />
      );
    }
  };


  // Removed animated variants (restored static rendering)

  return (
    <ProtectedRoute>
      <OrganizerProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-gray-900 dark:to-blue-950/20">
          <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 pb-10 lg:pb-0">
              <div className="flex-1 space-y-4 sm:space-y-6 min-w-0 w-full max-w-full">
              {currentQuestion && (
                <div className="space-y-2">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                    <div className="flex flex-col">
                      <h1 className="text-base md:text-lg font-semibold leading-tight text-gray-900 dark:text-gray-100">
                        {(() => {
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

                          // Handle clinical cases and grouped blocks
                          if ('caseNumber' in currentQuestion && 'questions' in currentQuestion) {
                            const clinicalCase = currentQuestion as ClinicalCase;
                            const parts: string[] = [];

                            const isGroupedQrocOnly = clinicalCase.questions.every(q => q.type === 'qroc');
                            const isGroupedMcqOnly = clinicalCase.questions.every(q => q.type === 'mcq');

                            if (isGroupedQrocOnly) {
                              parts.push(`Multi QROC ${clinicalCase.caseNumber}`);
                            } else if (isGroupedMcqOnly) {
                              parts.push(`Multi QCM ${clinicalCase.caseNumber}`);
                            } else {
                              parts.push(`Cas Clinique ${clinicalCase.caseNumber}`);
                            }
                            
                            // Add session info if available from the first question
                            const firstQuestion = clinicalCase.questions[0];
                            if (firstQuestion?.session) {
                              const formattedSession = formatSession(firstQuestion.session);
                              if (formattedSession) {
                                parts.push(formattedSession);
                              }
                            }
                            
                            return parts.join(' / ');
                          }
                          
                          // Handle regular questions with enhanced metadata
                          const question = currentQuestion as any;
                          const parts: string[] = [];
                          
                          // Add question type and number
                          if (question.type === 'mcq') {
                            parts.push(`QCM ${question.number ?? currentQuestionIndex + 1}`);
                          } else if (question.type === 'qroc' || question.type === 'open') {
                            parts.push(`QROC ${question.number ?? currentQuestionIndex + 1}`);
                          } else {
                            parts.push(`${(question.type || '').toUpperCase()} ${question.number ?? currentQuestionIndex + 1}`);
                          }
                          
                          // Add formatted session if available
                          if (question.session) {
                            const formattedSession = formatSession(question.session);
                            if (formattedSession) {
                              parts.push(formattedSession);
                            }
                          }
                          
                          return parts.join(' / ');
                        })()}
                      </h1>
                      {(lecture?.title || lecture?.specialty?.name) && (
                        <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {lecture?.specialty?.name ? `${lecture.specialty.name}${lecture?.title ? ' • ' : ''}` : ''}{lecture?.title || ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* Pin button for current question */}
                      {currentQuestion && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={isPinned ? handleUnpinQuestion : handlePinQuestion}
                          className="whitespace-nowrap backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-xl shadow-md"
                        >
                          {isPinned ? (
                            <PinOff className="h-4 w-4 mr-2" />
                          ) : (
                            <Pin className="h-4 w-4 mr-2" />
                          )}
                          <span className="hidden sm:inline">{isPinned ? 'Détacher' : 'Épingler'}</span>
                        </Button>
                      )}
                      
                      {/* Signaler button for current question */}
                      {currentQuestion && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsReportDialogOpen(true)}
                          className="whitespace-nowrap backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-xl shadow-md"
                        >
                          <Flag className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Signaler</span>
                        </Button>
                      )}
                      
                      {/* Admin Dialog for other actions */}
                      {(user?.role === 'admin' || user?.role === 'maintainer') && (
                        <Dialog open={openAdminDialog} onOpenChange={setOpenAdminDialog}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="whitespace-nowrap"
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">Admin</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Actions administrateur</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-3 py-4">
                              {/* Current Question Actions */}
                              {currentQuestion && (
                                <>
                                  <div className="text-sm text-gray-600 dark:text-gray-400 font-medium border-b pb-2 mb-2">
                                    Question actuelle
                                  </div>
                                  
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      if (currentQuestion && 'questions' in currentQuestion) {
                                        const cc = currentQuestion as ClinicalCase;
                                        const isGroupedQrocOnly = cc.questions.every(q => q.type === 'qroc');
                                        const isGroupedMcqOnly = cc.questions.every(q => q.type === 'mcq');
                                        if (isGroupedQrocOnly) {
                                          setOpenGroupedQrocEdit(true);
                                        } else if (isGroupedMcqOnly) {
                                          setOpenGroupedMcqEdit(true);
                                        } else {
                                          setOpenClinicalCaseEdit(true);
                                        }
                                      } else {
                                        setIsEditDialogOpen(true);
                                      }
                                      setOpenAdminDialog(false);
                                    }}
                                    className="justify-start"
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Modifier la question
                                  </Button>
                                  
                                  <Button
                                    variant="outline"
                                    onClick={handleToggleQuestionVisibility}
                                    disabled={isTogglingVisibility}
                                    className="justify-start"
                                  >
                                    {(() => {
                                      // Determine if current question is hidden
                                      let isHidden = false;
                                      if ('questions' in currentQuestion) {
                                        // For clinical cases, check first question
                                        const clinicalCase = currentQuestion as ClinicalCase;
                                        isHidden = clinicalCase.questions[0]?.hidden || false;
                                      } else {
                                        // Regular question
                                        const question = currentQuestion as Question;
                                        isHidden = question.hidden || false;
                                      }
                                      
                                      return (
                                        <>
                                          {isHidden ? (
                                            <Eye className="h-4 w-4 mr-2" />
                                          ) : (
                                            <EyeOff className="h-4 w-4 mr-2" />
                                          )}
                                          {isHidden ? 'Afficher la question' : 'Masquer la question'}
                                        </>
                                      );
                                    })()}
                                  </Button>
                                  
                                  {user?.role === 'admin' && (
                                    <Button
                                      variant="outline"
                                      onClick={handleDeleteCurrentQuestion}
                                      className="justify-start text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Supprimer la question
                                    </Button>
                                  )}
                                  
                                  <div className="text-sm text-gray-600 dark:text-gray-400 font-medium border-b pb-2 mb-2 mt-4">
                                    Gestion globale
                                  </div>
                                </>
                              )}
                              
                              {/* Global Actions */}
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setOpenQuestionsDialog(true);
                                  setOpenAdminDialog(false);
                                }}
                                className="justify-start"
                              >
                                <PlusCircle className="h-4 w-4 mr-2" />
                                Créer une question
                              </Button>
                              {user?.role === 'admin' && (
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setOpenOrganizer(true);
                                    setOpenQuestionsDialog(true);
                                    setOpenAdminDialog(false);
                                  }}
                                  className="justify-start"
                                >
                                  <ListOrdered className="h-4 w-4 mr-2" />
                                  Organiser les questions
                                </Button>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      
                      {/* Quit button - mobile only, positioned between Admin and Timer */}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBackToSpecialtyNested}
                        className="sm:hidden whitespace-nowrap bg-red-600 hover:bg-red-700 text-white border-0 rounded-xl shadow-md"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        <span>Quitter</span>
                      </Button>
                      
                      {/* Timer at the very right */}
                      <LectureTimer lectureId={lectureId} />
                    </div>
                  </div>
                  {/* Divider under metadata (blue, thicker, indented) */}
                  <div className="h-1 bg-blue-500 dark:bg-blue-600 rounded w-[250px]" />
                </div>
              )}

              <div ref={contentTopRef} className="space-y-4 sm:space-y-6">
                {currentQuestion && renderCurrentQuestion()}
              </div>
            </div>

            {isLargeScreen && (
              <div className="lg:w-80 lg:flex-shrink-0">
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
                  onQuit={handleBackToSpecialtyNested}
                  mode={mode}
                />
              </div>
            )}
          </div>
          
          {/* Mobile Control Panel - rendered exclusively on mobile */}
          {!isLargeScreen && (
            <div className="mt-4 sm:mt-6">
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
                onQuit={handleBackToSpecialtyNested}
                mode={mode}
              />
            </div>
          )}
            
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
      
      {/* Question Edit Dialog */}
      {currentQuestion && !('questions' in currentQuestion) && (
        <QuestionEditDialog
          question={currentQuestion as Question}
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onQuestionUpdated={() => {
            // Refresh the page to reload the updated question
            window.location.reload();
          }}
        />
      )}

      {/* Clinical/Grouped Editors */}
      {currentQuestion && 'questions' in currentQuestion && (
        <>
          {/* True clinical case */}
          {openClinicalCaseEdit && (
            <ClinicalCaseEditDialog
              caseNumber={(currentQuestion as ClinicalCase).caseNumber}
              questions={(currentQuestion as ClinicalCase).questions}
              isOpen={openClinicalCaseEdit}
              onOpenChange={setOpenClinicalCaseEdit}
              onSaved={() => { try { window.location.reload(); } catch {} }}
            />
          )}
          {/* Grouped QROC */}
          {openGroupedQrocEdit && (
            <GroupedQrocEditDialog
              caseNumber={(currentQuestion as ClinicalCase).caseNumber}
              questions={(currentQuestion as ClinicalCase).questions}
              isOpen={openGroupedQrocEdit}
              onOpenChange={setOpenGroupedQrocEdit}
              onSaved={() => { try { window.location.reload(); } catch {} }}
            />
          )}
          {/* Grouped MCQ */}
          {openGroupedMcqEdit && (
            <GroupedMcqEditDialog
              caseNumber={(currentQuestion as ClinicalCase).caseNumber}
              questions={(currentQuestion as ClinicalCase).questions}
              isOpen={openGroupedMcqEdit}
              onOpenChange={setOpenGroupedMcqEdit}
              onSaved={() => { try { window.location.reload(); } catch {} }}
            />
          )}
        </>
      )}
      
      {/* Report Question Dialog */}
      {currentQuestion && (
        <ReportQuestionDialog
          question={'questions' in currentQuestion ? currentQuestion.questions[0] : currentQuestion as Question}
          lectureId={lectureId}
          isOpen={isReportDialogOpen}
          onOpenChange={setIsReportDialogOpen}
        />
      )}
      </OrganizerProvider>
    </ProtectedRoute>
  )
}
// Local helper component: grouped QROC aggregated notes gating
function GroupedQrocContainer({ clinicalCase, answers, answerResults, pinnedQuestionIds, user, lecture, lectureId, specialtyId, onAnswerSubmit, onNext, onQuestionUpdate, setOpenQuestionsDialog }: any) {
  const [openNotes, setOpenNotes] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [notesHasContent, setNotesHasContent] = useState(false); // track if notes have content
  const notesRef = useRef<HTMLDivElement | null>(null);

  // Auto-close notes when content becomes empty
  useEffect(() => {
    if (!notesHasContent) {
      setOpenNotes(false);
    }
  }, [notesHasContent]);

  const groupAnswered = clinicalCase.questions.every((q: any) => answers[q.id] !== undefined);
  // Duplicate group-level controls (pin/hide/edit/report/delete) removed to avoid redundancy with header actions



  return (
    <div className="space-y-2" data-grouped-qroc>
      <div className="rounded-xl border bg-white/90 dark:bg-gray-800/90 p-3 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Multi QROC #{clinicalCase.caseNumber}</h2>
          <div className="text-xs text-gray-500 dark:text-gray-400">{clinicalCase.totalQuestions} QROC</div>
        </div>
        {/* Group-level action buttons removed; use global header Admin/Pin/Report */}
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
      {/* Edit for grouped QROC is accessible from the global Admin dialog */}
    </div>
  );
}

// (GroupedMcqContainer removed: legacy ProgressiveClinicalCase disabled)
