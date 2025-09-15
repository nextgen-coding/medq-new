'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
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
  ArrowLeft
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { MCQQuestion } from '@/components/questions/MCQQuestion'
import { OpenQuestion } from '@/components/questions/OpenQuestion'
import { QuestionControlPanel } from '@/components/lectures/QuestionControlPanel'
import { Question } from '@/types'

interface TestAnswer {
  questionId: string
  answer: string
  isCorrect: boolean
  timeSpent: number
}

export default function PinnedQuestionsTestPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<TestAnswer[]>([])
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [isTestComplete, setIsTestComplete] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null)
  
  const lectureId = params?.lectureId as string
  const specialtyId = params?.specialtyId as string
  const { lecture } = useLecture(lectureId)

  if (!lectureId) {
    return <div>Lecture ID not found</div>
  }

  // Override back navigation to use nested route
  const handleBack = () => {
    if (specialtyId) {
      router.push(`/exercices/${specialtyId}`)
    } else {
      router.push('/exercices')
    }
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
          title: "Error",
          description: "Failed to load pinned questions",
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
    setSelectedAnswer('')

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setQuestionStartTime(new Date())
    } else {
      setIsTestComplete(true)
    }
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setQuestionStartTime(new Date())
    }
  }

  const handleRestartTest = () => {
    setCurrentQuestionIndex(0)
    setAnswers([])
    setSelectedAnswer('')
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

  if (questions.length === 0) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-gray-900 dark:to-blue-950/20">
          <div className="container mx-auto px-4 py-12">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-md mx-auto">
                <div className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-8 shadow-lg">
                  <Dumbbell className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    No Pinned Questions
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    You haven&apos;t pinned any questions from this lecture yet. 
                    Pin questions while studying to create your personal test set.
                  </p>
                  <Button 
                    onClick={() => router.push(`/exercices/${specialtyId}/lecture/${lectureId}`)} 
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 mr-3"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Study All Questions
                  </Button>
                  <Button 
                    onClick={handleBack} 
                    variant="outline"
                  >
                    Back to Specialty
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
              <div className="flex justify-between items-center">
                {/* Back to specialty button */}
                <Button
                  onClick={handleBack}
                  variant="ghost"
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Specialty
                </Button>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Dumbbell className="w-4 h-4" />
                  Pinned Questions Test
                </div>
              </div>

              {currentQuestion && !isTestComplete && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Pinned Question
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Question {currentQuestionIndex + 1} of {questions.length}
                      </div>
                    </div>
                    
                    <h2 className="text-lg font-semibold mb-6 text-gray-900 dark:text-gray-100">
                      {currentQuestion.text}
                    </h2>

                    {currentQuestion.type === 'mcq' && currentQuestion.options ? (
                      <div className="space-y-3">
                        {currentQuestion.options.map((option, index) => (
                          <Button
                            key={option.id}
                            variant={selectedAnswer === option.text ? "default" : "outline"}
                            className="w-full justify-start p-4 h-auto text-left"
                            onClick={() => {
                              setSelectedAnswer(option.text)
                              handleAnswerSelect(option.text)
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-medium">
                                {String.fromCharCode(65 + index)}.
                              </span>
                              <span>{option.text}</span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Button
                          variant={selectedAnswer === 'true' ? "default" : "outline"}
                          className="w-full justify-start p-4 h-auto"
                          onClick={() => {
                            setSelectedAnswer('true')
                            handleAnswerSelect('true')
                          }}
                        >
                          <CheckCircle className="w-5 h-5 mr-3" />
                          True
                        </Button>
                        <Button
                          variant={selectedAnswer === 'false' ? "default" : "outline"}
                          className="w-full justify-start p-4 h-auto"
                          onClick={() => {
                            setSelectedAnswer('false')
                            handleAnswerSelect('false')
                          }}
                        >
                          <XCircle className="w-5 h-5 mr-3" />
                          False
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isTestComplete && (
                <div className="space-y-6">
                  <div className="text-center">
                    <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Test Complete!</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                      Here are your results for the pinned questions test
                    </p>
                  </div>

                  {(() => {
                    const results = getTestResults()
                    return (
                      <Card className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 shadow-lg">
                        <CardHeader>
                          <CardTitle>Test Results</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {results.score}%
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Final Score
                              </div>
                            </div>
                            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {results.correctAnswers}/{results.totalQuestions}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Correct Answers
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
                                Total Time
                              </div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="flex items-center justify-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span className="font-medium">{results.averageTime}s</span>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Avg per Question
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
                      Restart Test
                    </Button>
                    <Button
                      onClick={handleBack}
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Specialty
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:block lg:w-80 lg:flex-shrink-0">
              <QuestionControlPanel
                questions={questions}
                currentQuestionIndex={currentQuestionIndex}
                answers={{}}
                answerResults={{}}
                onQuestionSelect={(index: number) => setCurrentQuestionIndex(index)}
                onPrevious={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                onNext={handleNextQuestion}
                isComplete={false}
              />
            </div>
          </div>
          
          {/* Mobile Control Panel - rendered separately to avoid layout issues */}
          <div className="lg:hidden mt-4 sm:mt-6">
            <QuestionControlPanel
              questions={questions}
              currentQuestionIndex={currentQuestionIndex}
              answers={{}}
              answerResults={{}}
              onQuestionSelect={(index: number) => setCurrentQuestionIndex(index)}
              onPrevious={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              onNext={handleNextQuestion}
              isComplete={false}
            />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
