'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { useLecture } from '@/hooks/use-lecture'
import { useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Star,
  Clock,
  Trophy,
  RotateCcw,
  Dumbbell,
  ArrowLeft,
  Pin,
  PinOff,
  Flag,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Settings
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { MCQQuestion } from '@/components/questions/MCQQuestion'
import { OpenQuestion } from '@/components/questions/OpenQuestion'
import { QuestionControlPanel } from '@/components/lectures/QuestionControlPanel'
import { QuestionEditDialog } from '@/components/questions/QuestionEditDialog'
import { ReportQuestionDialog } from '@/components/questions/ReportQuestionDialog'
import { LectureTimer } from '@/components/lectures/LectureTimer'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Question } from '@/types'

interface TestAnswer {
  questionId: string
  answer: string
  isCorrect: boolean
  timeSpent: number
}

export default function QuestionsEpingleesTestPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<TestAnswer[]>([])
  const [isTestComplete, setIsTestComplete] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null)
  const [isPinned, setIsPinned] = useState(false)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [openAdminDialog, setOpenAdminDialog] = useState(false)
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set())
  const [notesMap, setNotesMap] = useState<Record<string, boolean>>({})
  
  const lectureId = params?.lectureId as string
  const specialtyId = params?.specialtyId as string
  const { lecture, answers: previousAnswers, answerResults: previousAnswerResults } = useLecture(lectureId)

  if (!lectureId) {
    return <div>ID de cours introuvable</div>
  }

  // Override back navigation to use nested route
  const handleBack = () => {
    if (specialtyId) {
      router.push(`/matieres/${specialtyId}`)
    } else {
      router.push('/matieres')
    }
  }

  // Handle quit button - go back to the specialty page
  const handleQuit = () => {
    router.push(`/matieres/${specialtyId}`)
  }

  // Load pinned questions for this lecture
  useEffect(() => {
    const loadPinnedQuestions = async () => {
      if (!lectureId || !user?.id) return
      
      try {
        setIsLoading(true)
        // First get all pinned questions for this user
        const pinnedResponse = await fetch(`/api/pinned-questions?userId=${user.id}`)
        if (!pinnedResponse.ok) {
          throw new Error('Failed to load pinned questions')
        }
        
        const pinnedQuestions = await pinnedResponse.json()
        
        // Then get all questions for this lecture
        const questionsResponse = await fetch(`/api/questions?lectureId=${lectureId}`)
        if (!questionsResponse.ok) {
          throw new Error('Failed to load lecture questions')
        }
        
        const allQuestions = await questionsResponse.json()
        
        // Filter to only show pinned questions from this lecture
        const pinnedQuestionIds = pinnedQuestions.map((pq: any) => pq.questionId)
        const filteredQuestions = allQuestions.filter((q: Question) => pinnedQuestionIds.includes(q.id))
        
        setQuestions(filteredQuestions)
        
        if (filteredQuestions.length > 0) {
          setStartTime(new Date())
          setQuestionStartTime(new Date())
        }
      } catch (error) {
        console.error('Error loading pinned questions:', error)
        toast({
          title: "Erreur",
          description: "Échec du chargement des questions épinglées",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadPinnedQuestions()
  }, [lectureId, user?.id])

  const currentQuestion = questions[currentQuestionIndex]
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0

  // Combine current session answers with previous answers
  // Current session answers take precedence
  const combinedAnswers = useMemo(() => {
    const combined: Record<string, any> = { ...(previousAnswers || {}) }
    
    // Add current session answers 
    answers.forEach(answer => {
      if (answer.questionId && currentQuestion?.type === 'mcq') {
        // For MCQ, convert comma-separated answer back to array
        combined[answer.questionId] = answer.answer.split(',').filter(Boolean)
      } else if (answer.questionId) {
        // For other question types
        combined[answer.questionId] = answer.answer
      }
    })
    
    return combined
  }, [previousAnswers, answers, currentQuestion?.type])

  // Combine current session results with previous results  
  const combinedResults = useMemo(() => {
    const combined: Record<string, boolean | 'partial'> = { ...(previousAnswerResults || {}) }
    
    // Add current session results
    answers.forEach(answer => {
      if (answer.questionId) {
        combined[answer.questionId] = answer.isCorrect
      }
    })
    
    return combined
  }, [previousAnswerResults, answers])

  // Update pinned status when current question changes
  useEffect(() => {
    const checkPinnedStatus = async () => {
      if (!currentQuestion || !user?.id) return
      
      try {
        const response = await fetch(`/api/pinned-questions?userId=${user.id}`)
        if (response.ok) {
          const pinnedData = await response.json()
          const isQuestionPinned = pinnedData.some((item: any) => item.questionId === currentQuestion.id)
          setIsPinned(isQuestionPinned)
        }
      } catch (error) {
        console.error('Error loading pinned question status:', error)
      }
    }

    if (user?.id && currentQuestion?.id) {
      checkPinnedStatus()
    }
  }, [currentQuestion?.id, user?.id])

  // Add lifecycle logging and mock data fallback for debugging
  useEffect(() => {
    console.log('Component mounted or updated. User ID:', user?.id, 'Questions:', questions);

    const fetchNotesStatus = async () => {
      if (!user?.id || questions.length === 0) {
        console.log('Skipping fetchNotesStatus due to missing user ID or empty questions list.');
        return;
      }

      console.log('Fetching notes status for pinned questions:', questions.map(q => q.id));

      try {
        const results = await Promise.all(
          questions.map(async (question) => {
            try {
              const res = await fetch(`/api/user-question-state?userId=${encodeURIComponent(user.id)}&questionId=${encodeURIComponent(question.id)}`, {
                headers: {
                  'Cache-Control': 'no-cache',
                },
              });
              console.log(`Raw response for question ${question.id}:`, res);
              if (!res.ok) return [question.id, false] as [string, boolean];
              const data = await res.json();
              console.log(`Parsed data for question ${question.id}:`, data);
              const hasNote = data?.notes != null && String(data.notes).trim().length > 0;
              console.log(`Computed hasNote for question ${question.id}:`, hasNote);
              return [question.id, hasNote] as [string, boolean];
            } catch (error) {
              console.error(`Failed to fetch notes for question ${question.id}:`, error);
              return [question.id, false] as [string, boolean];
            }
          })
        );

        const notesData: Record<string, boolean> = {};
        results.forEach(([id, hasNote]) => {
          notesData[id] = hasNote;
        });

        console.log('Final notes map:', notesData);
        setNotesMap(notesData);
      } catch (error) {
        console.error('Error fetching notes status:', error);
      }
    };

    fetchNotesStatus();
  }, [user?.id, questions])

  // Pin/Unpin handlers
  const handlePinQuestion = async () => {
    if (!currentQuestion || !user?.id) return
    
    try {
      const response = await fetch('/api/pinned-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          questionId: currentQuestion.id,
        }),
      })

      if (response.ok) {
        setIsPinned(true)
        toast({
          title: "Question épinglée",
          description: "Cette question a été ajoutée à votre collection.",
        })
        window.dispatchEvent(new Event('pinned-updated'))
      } else {
        toast({
          title: "Erreur",
          description: "Échec de l'épinglage de la question.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error pinning question:', error)
      toast({
        title: "Erreur",
        description: "Échec de l'épinglage de la question.",
        variant: "destructive",
      })
    }
  }

  const handleUnpinQuestion = async () => {
    if (!currentQuestion || !user?.id) return
    
    try {
      const response = await fetch(`/api/pinned-questions?userId=${user.id}&questionId=${currentQuestion.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setIsPinned(false)
        toast({
          title: "Question désépinglée",
          description: "Cette question a été retirée de votre collection.",
        })
        
        // Remove the question from the current test questions list
        const updatedQuestions = questions.filter(q => q.id !== currentQuestion.id)
        setQuestions(updatedQuestions)
        
        // Remove corresponding answer if it exists
        setAnswers(prev => prev.filter(a => a.questionId !== currentQuestion.id))
        
        // Adjust current question index if needed
        if (updatedQuestions.length === 0) {
          // No more pinned questions - end the test if it was in progress
          if (!isTestComplete) {
            setIsTestComplete(true)
          }
          setCurrentQuestionIndex(0)
        } else if (currentQuestionIndex >= updatedQuestions.length) {
          // Current index is beyond the new list length, go to last question
          setCurrentQuestionIndex(updatedQuestions.length - 1)
        }
        // If current index is still valid, it will automatically show the next question
        
        // Reset states for the new current question
        if (updatedQuestions.length > 0) {
          setQuestionStartTime(new Date())
        }
        
        window.dispatchEvent(new Event('pinned-updated'))
      } else {
        toast({
          title: "Erreur",
          description: "Échec du désépinglage de la question.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error unpinning question:', error)
      toast({
        title: "Erreur",
        description: "Échec du désépinglage de la question.",
        variant: "destructive",
      })
    }
  }

  const handleQuestionUpdate = (questionId: string, updates: Partial<Question>) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, ...updates } : q
    ))
  }

  const handleAnswerSelect = (answer: string) => {
    if (!currentQuestion || !questionStartTime) return

    const timeSpent = new Date().getTime() - questionStartTime.getTime()
    
    // For MCQ questions, check if the answer matches any of the correct answers
    let isCorrect = false
    if (currentQuestion.type === 'mcq' && currentQuestion.correctAnswers) {
      isCorrect = currentQuestion.correctAnswers.includes(answer)
    } else if (currentQuestion.correct_answers) {
      // Find the option ID that matches the answer text
      const selectedOption = currentQuestion.options?.find(opt => opt.text === answer)
      if (selectedOption) {
        isCorrect = currentQuestion.correct_answers.includes(selectedOption.id)
      }
    }

    const newAnswer: TestAnswer = {
      questionId: currentQuestion.id,
      answer: answer,
      isCorrect,
      timeSpent
    }

    setAnswers(prev => [...prev, newAnswer])
    
    // MCQQuestion component handles state internally, just track answer for results
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setQuestionStartTime(new Date())
    } else {
      setIsTestComplete(true)
    }
  }

  const handleRestartTest = () => {
    setCurrentQuestionIndex(0)
    setAnswers([])
    setIsTestComplete(false)
    setStartTime(new Date())
    setQuestionStartTime(new Date())
  }

  const getTestResults = () => {
    const correctAnswers = answers.filter(a => a.isCorrect).length
    const totalTime = answers.reduce((sum, a) => sum + a.timeSpent, 0)
    const averageTime = totalTime / answers.length / 1000 // in seconds
    const score = Math.round((correctAnswers / answers.length) * 100)

    return {
      correctAnswers,
      totalQuestions: answers.length,
      score,
      totalTime: Math.round(totalTime / 1000),
      averageTime: Math.round(averageTime)
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-gray-900 dark:to-blue-950/20">
          <div className="container mx-auto px-4 py-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!isLoading && questions.length === 0) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-gray-900 dark:to-blue-950/20">
          <div className="container mx-auto px-4 py-12">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-md mx-auto">
                <div className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-8 shadow-lg">
                  <Dumbbell className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Aucune question épinglée
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Vous n'avez pas encore épinglé de questions de ce cours. 
                    Épinglez des questions pendant vos études pour créer votre set de test personnel.
                  </p>
                  <Button 
                    onClick={() => router.push(`/matieres/${specialtyId}/cours/${lectureId}`)} 
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 mr-3"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Étudier toutes les questions
                  </Button>
                  <Button 
                    onClick={handleBack} 
                    variant="outline"
                  >
                    Retour à la matière
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 pb-10 lg:pb-0">
            <div className="flex-1 space-y-4 sm:space-y-6 min-w-0 w-full max-w-full">
              {/* Header with 'Retour à la matière' and 'Test de questions épinglées' removed as requested */}

              {currentQuestion && !isTestComplete && (
                <div className="space-y-4 sm:space-y-6">
                  {/* Header section with metadata and action buttons (like in target page) */}
                  <div className="space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                      <div className="flex flex-col">
                        <h1 className="text-base md:text-lg font-semibold leading-tight text-gray-900 dark:text-gray-100">
                          {(() => {
                            const parts: string[] = [];
                            
                            // Add question type and number
                            if (currentQuestion.type === 'mcq') {
                              parts.push(`QCM ${currentQuestion.number ?? currentQuestionIndex + 1}`);
                            } else if (currentQuestion.type === 'qroc' || currentQuestion.type === 'open') {
                              parts.push(`QROC ${currentQuestion.number ?? currentQuestionIndex + 1}`);
                            } else {
                              parts.push(`${(currentQuestion.type || '').toUpperCase()} ${currentQuestion.number ?? currentQuestionIndex + 1}`);
                            }
                            
                            // Add session if available
                            if ((currentQuestion as any).session) {
                              const sessionValue = (currentQuestion as any).session;
                              let cleaned = sessionValue.replace(/^\(|\)$/g, '').trim();
                              if (!/session/i.test(cleaned) && /^\d+$/.test(cleaned)) {
                                cleaned = `Session ${cleaned}`;
                              }
                              if (cleaned) {
                                parts.push(cleaned);
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
                        {/* Removed pinned question meta data */}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* Pin button for current question */}
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
                        
                        {/* Report button for current question */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsReportDialogOpen(true)}
                          className="whitespace-nowrap backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-xl shadow-md"
                        >
                          <Flag className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Signaler</span>
                        </Button>
                        
                        {/* Admin Dialog for other actions */}
                        {(user?.role === 'admin' || user?.role === 'maintainer') && (
                          <Dialog open={openAdminDialog} onOpenChange={setOpenAdminDialog}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="whitespace-nowrap backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-xl shadow-md"
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
                                        setIsEditDialogOpen(true);
                                        setOpenAdminDialog(false);
                                      }}
                                      className="justify-start"
                                    >
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Modifier la question
                                    </Button>
                                    
                                    {user?.role === 'admin' && (
                                      <Button
                                        variant="outline"
                                        onClick={async () => {
                                          if (!confirm('Supprimer cette question ?')) return
                                          try {
                                            await fetch(`/api/questions/${currentQuestion.id}`, {
                                              method: 'DELETE',
                                              credentials: 'include'
                                            })
                                            toast({
                                              title: "Question supprimée",
                                              description: "La question a été supprimée avec succès.",
                                            })
                                            // Remove from questions list and navigate
                                            const updatedQuestions = questions.filter(q => q.id !== currentQuestion.id)
                                            setQuestions(updatedQuestions)
                                            if (updatedQuestions.length === 0) {
                                              setIsTestComplete(true)
                                            } else if (currentQuestionIndex >= updatedQuestions.length) {
                                              setCurrentQuestionIndex(updatedQuestions.length - 1)
                                            }
                                            setOpenAdminDialog(false);
                                          } catch (error) {
                                            toast({
                                              title: "Erreur",
                                              description: "Échec de la suppression de la question.",
                                              variant: "destructive",
                                            })
                                          }
                                        }}
                                        className="justify-start text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Supprimer la question
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        
                        {/* Red Quitter Button - Mobile Only */}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleQuit}
                          className="sm:hidden whitespace-nowrap bg-red-600 hover:bg-red-700 text-white border-0 rounded-xl shadow-md"
                        >
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Quitter
                        </Button>
                        
                        {/* Timer at the very right */}
                        <LectureTimer lectureId={lectureId} />
                      </div>
                    </div>
                    {/* Blue divider like in target page */}
                    <div className="h-1 bg-blue-500 dark:bg-blue-600 rounded w-[250px]" />
                  </div>

                  {/* Use the actual MCQQuestion component like in the target page */}
                  {currentQuestion.type === 'mcq' ? (
                    <MCQQuestion
                      key={currentQuestion.id}
                      question={currentQuestion}
                      onSubmit={(selectedOptionIds: string[], isCorrect: boolean) => {
                        // Handle the submission
                        if (!questionStartTime) return
                        
                        const timeSpent = new Date().getTime() - questionStartTime.getTime()
                        const newAnswer: TestAnswer = {
                          questionId: currentQuestion.id,
                          answer: selectedOptionIds.join(','),
                          isCorrect,
                          timeSpent
                        }
                        
                        setAnswers(prev => [...prev, newAnswer])
                        setAnsweredQuestions(prev => new Set(prev).add(currentQuestion.id))
                      }}
                      onNext={handleNextQuestion}
                      lectureId={lectureId}
                      lectureTitle={lecture?.title}
                      specialtyName={lecture?.specialty?.name}
                      isAnswered={combinedAnswers[currentQuestion.id] !== undefined}
                      answerResult={combinedResults[currentQuestion.id]}
                      userAnswer={combinedAnswers[currentQuestion.id]}
                      onQuestionUpdate={handleQuestionUpdate}
                      highlightConfirm={true}
                      hideMeta={false}
                      enableOptionHighlighting={true}
                      showNotesAfterSubmit={combinedAnswers[currentQuestion.id] !== undefined}
                    />
                  ) : (
                    <OpenQuestion
                      key={currentQuestion.id}
                      question={currentQuestion}
                      onSubmit={(answer: string, resultValue: boolean | 'partial') => {
                        // Handle the submission
                        if (!questionStartTime) return
                        
                        const timeSpent = new Date().getTime() - questionStartTime.getTime()
                        const newAnswer: TestAnswer = {
                          questionId: currentQuestion.id,
                          answer: answer,
                          isCorrect: resultValue === true,
                          timeSpent
                        }
                        
                        setAnswers(prev => [...prev, newAnswer])
                        setAnsweredQuestions(prev => new Set(prev).add(currentQuestion.id))
                      }}
                      onNext={handleNextQuestion}
                      lectureId={lectureId}
                      lectureTitle={lecture?.title}
                      specialtyName={lecture?.specialty?.name}
                      isAnswered={combinedAnswers[currentQuestion.id] !== undefined}
                      answerResult={combinedResults[currentQuestion.id]}
                      userAnswer={combinedAnswers[currentQuestion.id] as string}
                      onQuestionUpdate={handleQuestionUpdate}
                      highlightConfirm={true}
                      hideMeta={false}
                      enableAnswerHighlighting={true}
                      showNotesAfterSubmit={combinedAnswers[currentQuestion.id] !== undefined}
                    />
                  )}
                </div>
              )}

              {isTestComplete && (
                <div className="space-y-6">
                  <div className="text-center">
                    <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Test terminé !</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                      Voici vos résultats pour le test de questions épinglées
                    </p>
                  </div>

                  {(() => {
                    const results = getTestResults()
                    return (
                      <Card className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 shadow-lg">
                        <CardHeader>
                          <CardTitle>Résultats du test</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {results.score}%
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Score final
                              </div>
                            </div>
                            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {results.correctAnswers}/{results.totalQuestions}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Réponses correctes
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="flex items-center justify-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span className="font-medium">{results.totalTime}s</span>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Temps total
                              </div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="flex items-center justify-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span className="font-medium">{results.averageTime}s</span>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Moyenne par question
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })()}

                  <div className="flex gap-3">
                    <Button
                      onClick={handleRestartTest}
                      variant="outline"
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Recommencer le test
                    </Button>
                    <Button
                      onClick={handleBack}
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Retour à la matière
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:block lg:w-80 lg:flex-shrink-0">
              <QuestionControlPanel
                questions={questions}
                currentQuestionIndex={currentQuestionIndex}
                answers={combinedAnswers}
                answerResults={combinedResults}
                onQuestionSelect={(index: number) => setCurrentQuestionIndex(index)}
                onPrevious={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                onNext={handleNextQuestion}
                isComplete={false}
                onQuit={handleQuit}
              />
            </div>
          </div>
          
          {/* Mobile Control Panel - rendered separately to avoid layout issues */}
          <div className="lg:hidden mt-4 sm:mt-6">
            <QuestionControlPanel
              questions={questions}
              currentQuestionIndex={currentQuestionIndex}
              answers={combinedAnswers}
              answerResults={combinedResults}
              onQuestionSelect={(index: number) => setCurrentQuestionIndex(index)}
              onPrevious={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              onNext={handleNextQuestion}
              isComplete={false}
              onQuit={handleQuit}
            />
          </div>
        </div>
      </div>
      
      {/* Dialogs */}
      {currentQuestion && (
        <>
          <QuestionEditDialog
            question={currentQuestion}
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onQuestionUpdated={() => {
              // Reload questions after update
              window.location.reload()
            }}
          />
          
          <ReportQuestionDialog
            question={currentQuestion}
            lectureId={lectureId!}
            isOpen={isReportDialogOpen}
            onOpenChange={setIsReportDialogOpen}
          />
        </>
      )}
    </ProtectedRoute>
  )
}
