'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Eye, 
  Calendar, 
  Clock, 
  User,
  BookOpen,
  Target,
  Award,
  Timer,
  PlayCircle,
  CheckCircle2,
  FileCheck,
  Loader2,
  Users,
  GraduationCap,
  School,
  Sparkles,
  Zap,
  TrendingUp,
  BarChart3,
  Clock3,
  Star,
  Trophy,
  Activity,
  Brain
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { UniversalHeader } from '@/components/layout/UniversalHeader'
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar'
import { SidebarInset } from '@/components/ui/sidebar'
import { getMedicalIcon, getIconBySpecialtyName } from '@/lib/medical-icons'

type Session = {
  id: string
  name: string
  pdfUrl?: string
  correctionUrl?: string
  createdAt: string
  updatedAt: string
  specialty: {
    id: string
    name: string
    description?: string
    icon?: string
  }
  niveau?: {
    id: string
    name: string
  }
  semester?: {
    id: string
    name: string
    order: number
  }
}

export default function SessionDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progressData, setProgressData] = useState({
    timeSpent: 0,
    lastVisited: null as Date | null,
    completionRate: 0,
    totalVisits: 0,
    averageScore: null as number | null
  })
  const [userProgress, setUserProgress] = useState<any>(null)
  const [loadingProgress, setLoadingProgress] = useState(false)

  const specialtyId = Array.isArray(params.id) ? params.id[0] : params.id
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId

  const fetchProgressData = useCallback(async () => {
    if (!sessionId || !user) return

    try {
      // Simulate progress data - replace with actual API call
      const mockProgress = {
        timeSpent: Math.floor(Math.random() * 7200), // 0-2 hours in seconds
        lastVisited: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 7)), // Within last week
        completionRate: Math.floor(Math.random() * 101), // 0-100%
        totalVisits: Math.floor(Math.random() * 20) + 1, // 1-20 visits
        averageScore: Math.random() > 0.3 ? Math.floor(Math.random() * 40) + 60 : null // 60-100% or null
      }
      
      setProgressData(mockProgress)
    } catch (err) {
      console.error('Failed to load progress:', err)
    }
  }, [sessionId, user])

  const fetchSession = useCallback(async () => {
    if (!sessionId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error('Session introuvable')
      }

      const data: Session = await response.json()
      setSession(data)
      
      // Fetch progress data after session is loaded
      await fetchProgressData()
    } catch (err) {
      console.error('Failed to load session:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [sessionId, fetchProgressData])

  const fetchUserProgress = useCallback(async () => {
    if (!sessionId || !user) return

    setLoadingProgress(true)
    try {
      // Simulate fetching user progress - replace with actual API call
      const mockProgress = {
        completionPercentage: Math.floor(Math.random() * 101),
        questionsAnswered: Math.floor(Math.random() * 50),
        totalQuestions: 50,
        correctAnswers: Math.floor(Math.random() * 40),
        timeSpent: Math.floor(Math.random() * 3600), // seconds
        lastAccessed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        attempts: Math.floor(Math.random() * 5) + 1,
        bestScore: Math.floor(Math.random() * 100),
        averageScore: Math.floor(Math.random() * 85),
        streak: Math.floor(Math.random() * 10),
      }
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500))
      setUserProgress(mockProgress)
    } catch (err) {
      console.error('Failed to load user progress:', err)
    } finally {
      setLoadingProgress(false)
    }
  }, [sessionId, user])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  useEffect(() => {
    if (session && user) {
      fetchUserProgress()
    }
  }, [session, user, fetchUserProgress])

  const handleBackToSessions = () => {
    if (specialtyId) {
      router.push(`/session/${specialtyId}`)
    } else if (session?.specialty?.id) {
      router.push(`/session/${session.specialty.id}`)
    } else {
      router.push('/session')
    }
  }

  const handleViewPDF = () => {
    if (session?.pdfUrl) {
      router.push(`/session/${specialtyId}/${sessionId}/viewer`)
    }
  }

  const handleDownloadPDF = () => {
    if (session?.pdfUrl) {
      window.open(session.pdfUrl, '_blank')
    }
  }

  const handleViewCorrection = () => {
    if (session?.correctionUrl) {
      window.open(session.correctionUrl, '_blank')
    }
  }

  const canViewCorrection = user?.role === 'admin' || user?.role === 'maintainer'

  // Format time in a readable way
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
  }

  // Format relative time
  const formatRelativeTime = (date: Date | null) => {
    if (!date) return 'Jamais'
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Il y a moins d\'une heure'
    if (diffInHours < 24) return `Il y a ${diffInHours}h`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `Il y a ${diffInDays}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  // Progress calculation helpers
  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'from-emerald-500 to-emerald-600'
    if (percentage >= 60) return 'from-blue-500 to-blue-600'
    if (percentage >= 40) return 'from-yellow-500 to-yellow-600'
    return 'from-red-500 to-red-600'
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400'
    if (score >= 70) return 'text-blue-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <AppSidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col">
            <UniversalHeader 
              hideSeparator
              leftActions={(
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => router.push('/session')}
                  className="gap-2 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all duration-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="font-medium">Retour</span>
                </Button>
              )}
            />
            <div className="flex-1 bg-gray-900">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
                <div className="flex items-center justify-center min-h-[50vh]">
                  <div className="flex items-center gap-3 bg-gray-800/80 px-8 py-6 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="text-gray-300 font-medium text-lg">Chargement de la session...</span>
                  </div>
                </div>
              </div>
            </div>
            </SidebarInset>
          </div>
        </AppSidebarProvider>
      </ProtectedRoute>
    )
  }

  if (error || !session) {
    return (
      <ProtectedRoute>
        <AppSidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col">
              <UniversalHeader 
                hideSeparator
                leftActions={(
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleBackToSessions}
                    className="gap-2 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all duration-200"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="font-medium">Retour</span>
                  </Button>
                )}
              />
              <div className="flex-1 bg-gray-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
                  <div className="flex items-center justify-center min-h-[50vh]">
                    <Card className="max-w-md w-full bg-gray-800/70 backdrop-blur-sm border-red-500/30 shadow-xl">
                      <CardContent className="pt-8 pb-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                          <FileText className="h-8 w-8 text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold text-red-400 mb-2">
                          {error || 'Session introuvable'}
                        </h2>
                        <p className="text-red-300/80 mb-6 text-sm">
                          La session que vous recherchez n'existe pas ou a été supprimée.
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Button 
                            variant="outline" 
                            onClick={handleBackToSessions}
                            className="gap-2 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Retour
                          </Button>
                          <Button 
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Réessayer
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </SidebarInset>
          </div>
        </AppSidebarProvider>
      </ProtectedRoute>
    )
  }

  // Get specialty icon
  const iconData = session.specialty.icon 
    ? getMedicalIcon(session.specialty.icon) 
    : getIconBySpecialtyName(session.specialty.name)
  const SpecialtyIcon = iconData.icon

  const createdDate = new Date(session.createdAt)
  const updatedDate = new Date(session.updatedAt)

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col">
            <UniversalHeader 
              hideSeparator
              leftActions={(
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleBackToSessions}
                  className="gap-2 text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all duration-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="font-medium">Retour aux sessions</span>
                </Button>
              )}
            />
            
            <div className="flex-1 bg-gray-900">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8 space-y-6">
                
                {/* Hero Section - Specialty Header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5" />
                  <div className="relative p-6">
                    <div className="flex items-center gap-4">
                      {/* Specialty Icon */}
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg border-2 border-blue-400/20 flex items-center justify-center">
                        <SpecialtyIcon className="w-8 h-8 text-white" />
                      </div>
                      
                      {/* Specialty Info */}
                      <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-white mb-2">{session.specialty.name}</h1>
                        <div className="flex flex-wrap gap-2 items-center">
                          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium bg-blue-500/20 text-blue-300 border-blue-400/30">
                            {/* We'll get the session count from parent or show "Session d'examen" */}
                            Session d'examen
                          </Badge>
                          {session.semester && (
                            <div className="flex items-center gap-1 text-xs text-blue-300 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-400/20">
                              <Users className="h-3 w-3" /> Semestre {session.semester.order}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress & Stats Section */}
                <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-lg font-bold text-white">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-white" />
                      </div>
                      Votre Progression
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    
                    {/* Progress Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      {/* Completion Rate */}
                      <div className="p-4 bg-gray-700/30 rounded-xl border border-gray-600/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-blue-400" />
                            <span className="text-sm font-medium text-gray-300">Progression</span>
                          </div>
                          <span className="text-lg font-bold text-white">{progressData.completionRate}%</span>
                        </div>
                        <Progress 
                          value={progressData.completionRate} 
                          className="h-2 bg-gray-700"
                        />
                        <div className="mt-2 text-xs text-gray-400">
                          {progressData.completionRate === 100 ? 'Terminé !' : 
                           progressData.completionRate > 50 ? 'En bonne voie' : 'Débutant'}
                        </div>
                      </div>

                      {/* Time Spent */}
                      <div className="p-4 bg-gray-700/30 rounded-xl border border-gray-600/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock3 className="h-5 w-5 text-green-400" />
                          <span className="text-sm font-medium text-gray-300">Temps d'étude</span>
                        </div>
                        <div className="text-lg font-bold text-white mb-1">
                          {formatTime(progressData.timeSpent)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {progressData.timeSpent > 3600 ? 'Excellent effort !' : 
                           progressData.timeSpent > 1800 ? 'Bon travail' : 'Continuez !'}
                        </div>
                      </div>

                      {/* Average Score */}
                      <div className="p-4 bg-gray-700/30 rounded-xl border border-gray-600/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Trophy className="h-5 w-5 text-yellow-400" />
                          <span className="text-sm font-medium text-gray-300">Score moyen</span>
                        </div>
                        <div className={`text-lg font-bold mb-1 ${
                          progressData.averageScore ? getScoreColor(progressData.averageScore) : 'text-gray-500'
                        }`}>
                          {progressData.averageScore ? `${progressData.averageScore}%` : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {progressData.averageScore ? 
                            (progressData.averageScore >= 80 ? 'Excellent !' : 
                             progressData.averageScore >= 70 ? 'Très bien' : 
                             progressData.averageScore >= 60 ? 'Bien' : 'À améliorer') : 
                            'Pas encore de score'}
                        </div>
                      </div>

                      {/* Total Visits */}
                      <div className="p-4 bg-gray-700/30 rounded-xl border border-gray-600/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Activity className="h-5 w-5 text-orange-400" />
                          <span className="text-sm font-medium text-gray-300">Visites</span>
                        </div>
                        <div className="text-lg font-bold text-white mb-1">
                          {progressData.totalVisits}
                        </div>
                        <div className="text-xs text-gray-400">
                          Dernière: {formatRelativeTime(progressData.lastVisited)}
                        </div>
                      </div>
                    </div>

                    {/* Study Streak & Recommendations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Study Insights */}
                      <div className="p-4 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-xl border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-3">
                          <Brain className="h-5 w-5 text-blue-400" />
                          <span className="text-sm font-semibold text-blue-300">Insights d'étude</span>
                        </div>
                        <div className="space-y-2 text-sm text-gray-300">
                          {progressData.completionRate === 0 ? (
                            <p>🚀 Commencez votre première session pour débloquer des insights personnalisés !</p>
                          ) : progressData.completionRate < 25 ? (
                            <p>📚 Vous venez de commencer. Continuez pour améliorer votre compréhension !</p>
                          ) : progressData.completionRate < 75 ? (
                            <p>⚡ Vous progressez bien ! Maintenez ce rythme pour maîtriser le sujet.</p>
                          ) : (
                            <p>🏆 Excellent travail ! Vous maîtrisez bien cette session d'examen.</p>
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="p-4 bg-gradient-to-r from-green-600/10 to-emerald-600/10 rounded-xl border border-green-500/20">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="h-5 w-5 text-green-400" />
                          <span className="text-sm font-semibold text-green-300">Recommandations</span>
                        </div>
                        <div className="space-y-2">
                          {progressData.completionRate < 100 && session.pdfUrl && (
                            <Button
                              onClick={handleViewPDF}
                              size="sm"
                              className="w-full justify-start gap-2 bg-green-600/20 hover:bg-green-600/30 border-green-500/30 text-green-300 text-xs"
                            >
                              <PlayCircle className="h-3 w-3" />
                              Continuer l'examen
                            </Button>
                          )}
                          {progressData.completionRate === 100 && (
                            <Button
                              onClick={handleViewPDF}
                              size="sm"
                              className="w-full justify-start gap-2 bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/30 text-blue-300 text-xs"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Réviser l'examen
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Session Details Card */}
                <Card className="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
                  <CardContent className="p-6">
                    {/* Session Header */}
                    <div className="flex items-center gap-4 mb-6">
                      {/* Session Icon with dynamic gradient */}
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg border-2 border-emerald-400/20 flex items-center justify-center">
                          <Calendar className="w-8 h-8 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 border-2 border-gray-800 flex items-center justify-center">
                          <FileText className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      
                      {/* Session Title and Meta */}
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-white mb-1 leading-tight">
                          {session.name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {createdDate.toLocaleDateString('fr-FR', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                          {session.semester && (
                            <>
                              <span className="text-gray-600">•</span>
                              <span>Semestre {session.semester.order}</span>
                            </>
                          )}
                          {session.niveau && (
                            <>
                              <span className="text-gray-600">•</span>
                              <span>{session.niveau.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator className="my-6 bg-gray-700/50" />

                    {/* Resources Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-blue-400" />
                        Ressources disponibles
                      </h3>
                      
                      <div className="grid gap-4">
                        {/* PDF Resource */}
                        {session.pdfUrl ? (
                          <div className="group p-4 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl border border-gray-600/30 hover:border-blue-500/30 transition-all duration-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-white group-hover:text-blue-300 transition-colors">
                                    Sujet d'examen
                                  </h4>
                                  <p className="text-sm text-gray-400">
                                    Document PDF • Disponible
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  onClick={handleViewPDF}
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Voir
                                </Button>
                                <Button 
                                  onClick={handleDownloadPDF}
                                  variant="outline"
                                  size="sm"
                                  className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Télécharger
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-700/20 rounded-xl border border-gray-600/20">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gray-600/50 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-gray-500" />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-400">
                                  Sujet d'examen
                                </h4>
                                <p className="text-sm text-gray-500">
                                  Document non disponible
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Correction Resource - Only for admins */}
                        {canViewCorrection && (
                          session.correctionUrl ? (
                            <div className="group p-4 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl border border-gray-600/30 hover:border-purple-500/30 transition-all duration-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                                    <FileCheck className="w-5 h-5 text-white" />
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-white group-hover:text-purple-300 transition-colors">
                                      Correction officielle
                                    </h4>
                                    <p className="text-sm text-gray-400">
                                      Corrigé • Admin uniquement
                                    </p>
                                  </div>
                                </div>
                                <Button 
                                  onClick={handleViewCorrection}
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700 text-white border-0"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Voir la correction
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-gray-700/20 rounded-xl border border-gray-600/20">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gray-600/50 flex items-center justify-center">
                                  <FileCheck className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-400">
                                    Correction officielle
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    Corrigé non disponible
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <Separator className="my-6 bg-gray-700/50" />

                    {/* Quick Actions */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-400" />
                        Actions rapides
                      </h3>
                      
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Link href={`/session/${session.specialty.id}`}>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start gap-3 bg-gray-700/30 hover:bg-gray-700/50 border-gray-600/50 hover:border-blue-500/50 text-gray-300 hover:text-white transition-all duration-200"
                          >
                            <Users className="h-4 w-4 text-blue-400" />
                            Autres sessions de {session.specialty.name}
                          </Button>
                        </Link>

                        <Link href="/session">
                          <Button 
                            variant="outline" 
                            className="w-full justify-start gap-3 bg-gray-700/30 hover:bg-gray-700/50 border-gray-600/50 hover:border-purple-500/50 text-gray-300 hover:text-white transition-all duration-200"
                          >
                            <BookOpen className="h-4 w-4 text-purple-400" />
                            Toutes les sessions
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Primary Action - Main CTA */}
                {session.pdfUrl && (
                  <Card className="bg-gradient-to-r from-blue-600/20 to-blue-700/20 border-blue-500/30 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <PlayCircle className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              Prêt à commencer ?
                            </h3>
                            <p className="text-sm text-blue-300">
                              Accédez au sujet d'examen dans le visualiseur PDF
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={handleViewPDF}
                          size="lg"
                          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-3 text-base font-medium"
                        >
                          <Eye className="h-5 w-5 mr-2" />
                          Commencer l'examen
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </SidebarInset>
        </div>
      </AppSidebarProvider>
    </ProtectedRoute>
  )
}
