'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useSpecialty } from '@/hooks/use-specialty'
import { useAuth } from '@/contexts/AuthContext'
import { UniversalHeader } from '@/components/layout/UniversalHeader'
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar'
import { SidebarInset } from '@/components/ui/sidebar'
import { EditSpecialtyDialog } from '@/components/specialties/EditSpecialtyDialog'
import { AddLectureDialog } from '@/components/specialties/AddLectureDialog'
import { AddQuestionDialog } from '@/components/specialties/AddQuestionDialog'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
// import { Progress } from '@/components/ui/progress'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  Settings, 
  Plus, 
  Folder, 
  File,
  Trash,
  Edit,
  Play,
  ExternalLink,
  ArrowLeft,
  AlertTriangle,
  MessageCircle,
  ArrowUpDown
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { LectureComments } from '@/components/lectures/LectureComments'

// Disable static generation to prevent SSR issues with useAuth
export const dynamic = 'force-dynamic'

export default function SpecialtyPageRoute() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [sortOption, setSortOption] = useState<'default' | 'name' | 'note' | 'lastAccessed'>('default')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  // const [selectedLecture, setSelectedLecture] = useState<any>(null)
  // const [commentsDialogOpen, setCommentsDialogOpen] = useState(false)
  // const [questionTypeDialogOpen, setQuestionTypeDialogOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // Per-lecture selected mode for the Start button
  type ModeKey = 'study' | 'revision' | 'pinned'
  const [selectedModes, setSelectedModes] = useState<Record<string, ModeKey>>({})

  // Group management state - DB backed
  const [courseGroups, setCourseGroups] = useState<Record<string, string[]>>({})
  const [isGroupManagementOpen, setIsGroupManagementOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [selectedCourseIds, setSelectedCourseIds] = useState<Record<string, boolean>>({})
  // Comments modal state
  const [commentsLectureId, setCommentsLectureId] = useState<string | null>(null)

  const { isAdmin, user } = useAuth()
  const specialtyId = params?.specialtyId as string

  const {
    specialty,
    lectures,
    isLoading,
  } = useSpecialty(specialtyId)

  if (!specialtyId) {
    return <div>Identifiant de matière introuvable</div>
  }

  // Load course groups from database
  useEffect(() => {
    const loadCourseGroups = async () => {
      if (!user?.id || !specialtyId) return
      try {
        const response = await fetch(`/api/course-groups?userId=${user.id}&specialtyId=${specialtyId}`)
        if (response.ok) {
          const groups = await response.json()
          const groupsMap: Record<string, string[]> = {}
          groups.forEach((group: any) => {
            if (group.lectureGroups) {
              groupsMap[group.name] = group.lectureGroups.map((lg: any) => lg.lectureId)
            }
          })
          setCourseGroups(groupsMap)
          // Expand all groups initially
          const exp: Record<string, boolean> = {}
          Object.keys(groupsMap).forEach((gn) => { exp[gn] = true })
          setExpandedGroups(exp)
        }
      } catch (error) {
        console.error('Error loading course groups:', error)
      }
    }
    loadCourseGroups()
  }, [user?.id, specialtyId])

  // Create, delete, and assignment helpers
  const createGroup = async () => {
    if (!newGroupName.trim() || !user?.id || !specialtyId) return
    try {
      const response = await fetch('/api/course-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim(), userId: user.id, specialtyId }),
      })
      if (response.ok) {
        const name = newGroupName.trim()
        setCourseGroups(prev => ({ ...prev, [name]: [] }))
        setExpandedGroups(prev => ({ ...prev, [name]: true }))
        setNewGroupName('')
        toast({ title: 'Groupe créé', description: `Le groupe de cours "${name}" a été créé.` })
      }
    } catch (error) {
      console.error('Error creating group:', error)
      toast({ title: 'Erreur', description: 'Échec de la création du groupe', variant: 'destructive' })
    }
  }

  const deleteGroup = async (groupName: string) => {
    if (!user?.id || !specialtyId) return
    try {
      const groupsResponse = await fetch(`/api/course-groups?userId=${user.id}&specialtyId=${specialtyId}`)
      if (!groupsResponse.ok) return
      const groups = await groupsResponse.json()
      const groupToDelete = groups.find((g: any) => g.name === groupName)
      if (!groupToDelete) return

      const response = await fetch(`/api/course-groups/${groupToDelete.id}`, { method: 'DELETE' })
      if (response.ok) {
        setCourseGroups(prev => {
          const updated = { ...prev }
          delete updated[groupName]
          return updated
        })
        setExpandedGroups(prev => {
          const updated = { ...prev }
          delete updated[groupName]
          return updated
        })
        toast({ title: 'Groupe supprimé', description: `Le groupe de cours "${groupName}" a été supprimé.` })
      }
    } catch (error) {
      console.error('Error deleting group:', error)
      toast({ title: 'Erreur', description: 'Échec de la suppression du groupe', variant: 'destructive' })
    }
  }

  const moveCourseToGroup = async (courseId: string, newGroupName: string) => {
    if (!user?.id || !specialtyId) return
    try {
      // Remove from any group first
      await fetch('/api/lecture-groups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lectureId: courseId }),
      })

      if (newGroupName !== '__none__') {
        // Assign to selected group
        const groupsResponse = await fetch(`/api/course-groups?userId=${user.id}&specialtyId=${specialtyId}`)
        if (groupsResponse.ok) {
          const groups = await groupsResponse.json()
          const targetGroup = groups.find((g: any) => g.name === newGroupName)
          if (targetGroup) {
            await fetch('/api/lecture-groups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lectureId: courseId, courseGroupId: targetGroup.id }),
            })
          }
        }
      }

      // Update local
      setCourseGroups(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(gn => { updated[gn] = updated[gn].filter(id => id !== courseId) })
        if (newGroupName !== '__none__') {
          if (!updated[newGroupName]) updated[newGroupName] = []
          updated[newGroupName].push(courseId)
        }
        return updated
      })
      toast({ title: 'Cours mis à jour', description: newGroupName === '__none__' ? 'Cours retiré du groupe' : `Cours déplacé vers ${newGroupName}` })
    } catch (error) {
      console.error('Error moving course:', error)
      toast({ title: 'Erreur', description: 'Échec du déplacement du cours', variant: 'destructive' })
    }
  }

  const bulkAssignToGroup = async (targetGroupName: string) => {
    if (!user?.id || !specialtyId) return
    const ids = Object.entries(selectedCourseIds).filter(([, v]) => v).map(([id]) => id)
    if (ids.length === 0) return
    try {
      const groupsResponse = await fetch(`/api/course-groups?userId=${user.id}&specialtyId=${specialtyId}`)
      if (!groupsResponse.ok) return
      const groups = await groupsResponse.json()
      const targetGroup = groups.find((g: any) => g.name === targetGroupName)
      if (!targetGroup) return

      const res = await fetch('/api/lecture-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lectureIds: ids, courseGroupId: targetGroup.id }),
      })
      if (!res.ok) throw new Error('Failed bulk assign')

      setCourseGroups(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(gn => { updated[gn] = updated[gn].filter(id => !ids.includes(id)) })
        if (!updated[targetGroupName]) updated[targetGroupName] = []
        updated[targetGroupName] = [...updated[targetGroupName], ...ids]
        return updated
      })
      setSelectedCourseIds({})
      toast({ title: 'Affectés', description: `${ids.length} cours affecté(s) à ${targetGroupName}` })
    } catch (e) {
      console.error(e)
      toast({ title: 'Erreur', description: 'Échec de l\'affectation en masse', variant: 'destructive' })
    }
  }

  const handleEdit = () => setIsEditDialogOpen(true)
  // const handleCommentsOpen = (lecture: any) => { setSelectedLecture(lecture); setCommentsDialogOpen(true) }
  // const handleQuestionTypeOpen = (lecture: any) => { setSelectedLecture(lecture); setQuestionTypeDialogOpen(true) }
  const handleSpecialtyUpdated = () => { window.location.reload() }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <AppSidebarProvider>
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col">
            <UniversalHeader title="Chargement..." hideSeparator />
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-4 lg:p-6 overflow-hidden">
              <div className="max-w-7xl mx-auto h-full flex flex-col gap-6">
                {/* HEADER CARD */}
                <div className="rounded-2xl border border-gray-200/60 dark:border-gray-800 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm p-5 lg:p-6 flex flex-col gap-6 animate-fade-in">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1 space-y-4">
                      <div className="h-7 w-48 sm:w-64 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
                        {[...Array(3)].map((_,i)=>(
                          <div key={i} className="h-16 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        ))}
                      </div>
                    </div>
                    <div className="h-8 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse self-start" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                      <span>Progression globale</span>
                      <span className="h-3 w-8 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 relative">
                      <div className="absolute inset-y-0 left-0 w-1/4 bg-gray-300 dark:bg-gray-600 animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* GROUP MANAGEMENT BAR */}
                <div className="rounded-2xl border border-gray-200/60 dark:border-gray-800 bg-white/60 dark:bg-gray-800/50 backdrop-blur-sm px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 animate-pulse">
                  <div className="h-5 w-56 sm:w-72 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="sm:ml-auto flex gap-3">
                    <div className="h-9 w-32 sm:w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>

                {/* SEARCH + FILTERS ROW */}
                <div className="flex flex-col md:flex-row gap-3 animate-pulse">
                  <div className="h-11 flex-1 min-w-[240px] rounded-xl bg-white/70 dark:bg-gray-800/60 border border-gray-200/60 dark:border-gray-800" />
                  <div className="flex gap-3 md:ml-auto">
                    <div className="h-11 w-28 sm:w-32 rounded-xl bg-white/70 dark:bg-gray-800/60 border border-gray-200/60 dark:border-gray-800" />
                    <div className="h-11 w-28 sm:w-32 rounded-xl bg-white/70 dark:bg-gray-800/60 border border-gray-200/60 dark:border-gray-800" />
                  </div>
                </div>

                {/* TABLE SKELETON */}
                <div className="flex-1 rounded-2xl border border-gray-200/60 dark:border-gray-800 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm flex flex-col overflow-hidden">
                  {/* Column headers */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-4 lg:px-6 py-3 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <div className="col-span-4 h-4 bg-gray-200/70 dark:bg-gray-700/70 rounded" />
                    <div className="col-span-1 h-4 bg-gray-200/70 dark:bg-gray-700/70 rounded" />
                    <div className="col-span-1 h-4 bg-gray-200/70 dark:bg-gray-700/70 rounded" />
                    <div className="col-span-2 h-4 bg-gray-200/70 dark:bg-gray-700/70 rounded" />
                    <div className="col-span-2 h-4 bg-gray-200/70 dark:bg-gray-700/70 rounded" />
                    <div className="col-span-2 h-4 bg-gray-200/70 dark:bg-gray-700/70 rounded" />
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scroll-thin divide-y divide-gray-100 dark:divide-gray-800">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="grid grid-cols-12 items-center gap-3 sm:gap-4 px-4 lg:px-6 py-4 animate-pulse">
                        {/* Course / title */}
                        <div className="col-span-12 md:col-span-4 flex items-start gap-3">
                          <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 mt-1" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-40 sm:w-48 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="h-3 w-32 sm:w-40 bg-gray-100 dark:bg-gray-600 rounded" />
                          </div>
                        </div>
                        {/* Reports (hide on small) */}
                        <div className="hidden md:flex col-span-1 items-center gap-2">
                          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                          <div className="h-4 w-5 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                        {/* Note */}
                        <div className="hidden md:flex col-span-1">
                          <div className="h-6 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                        </div>
                        {/* Progress */}
                        <div className="col-span-8 md:col-span-2 space-y-2">
                          <div className="h-4 w-10 bg-gray-200 dark:bg-gray-700 rounded" />
                          <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-600 overflow-hidden relative">
                            <div className="absolute inset-y-0 left-0 w-1/3 bg-gray-300 dark:bg-gray-500" />
                          </div>
                        </div>
                        {/* Comments */}
                        <div className="hidden md:flex col-span-2 items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700" />
                          <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                        {/* Action */}
                        <div className="col-span-4 md:col-span-2 flex items-center gap-2 sm:gap-3 justify-end">
                          <div className="h-8 w-20 sm:w-24 rounded-md bg-sky-200/50 dark:bg-sky-700/40" />
                          <div className="h-8 w-8 rounded-md bg-gray-200 dark:bg-gray-700" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SidebarInset>
        </AppSidebarProvider>
      </ProtectedRoute>
    )
  }

  if (!specialty) {
    return (
      <ProtectedRoute>
        <AppSidebarProvider>
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col">
            <UniversalHeader title="Matière introuvable" />
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-8">
              <p>Matière introuvable</p>
            </div>
          </SidebarInset>
        </AppSidebarProvider>
      </ProtectedRoute>
    )
  }

  // Filter lectures based on search and filter
  const filteredLectures = lectures.filter(lecture => {
    const matchesSearch = lecture.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = selectedFilter === 'all' || 
      (selectedFilter === 'completed' && lecture.progress?.percentage === 100) ||
      (selectedFilter === 'in-progress' && lecture.progress && lecture.progress.percentage > 0 && lecture.progress.percentage < 100) ||
      (selectedFilter === 'not-started' && (!lecture.progress || lecture.progress.percentage === 0))
    return matchesSearch && matchesFilter
  })

  // Apply sorting
  const sortedLectures = (() => {
    if (sortOption === 'default') return filteredLectures
    const arr = [...filteredLectures]
    switch (sortOption) {
      case 'name':
        arr.sort((a, b) => {
          const comp = a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
          return sortDirection === 'asc' ? comp : -comp
        })
        break
      case 'note':
        arr.sort((a: any, b: any) => {
          const missingHigh = sortDirection === 'asc'
          const an = typeof a.culmonNote === 'number' ? a.culmonNote : (missingHigh ? Infinity : -Infinity)
          const bn = typeof b.culmonNote === 'number' ? b.culmonNote : (missingHigh ? Infinity : -Infinity)
          if (an !== bn) {
            const comp = an - bn // ascending base
            return sortDirection === 'asc' ? comp : -comp
          }
          const titleComp = a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
          return sortDirection === 'asc' ? titleComp : -titleComp
        })
        break
      case 'lastAccessed':
        arr.sort((a: any, b: any) => {
          const ad = a.progress?.lastAccessed ? new Date(a.progress.lastAccessed).getTime() : 0
          const bd = b.progress?.lastAccessed ? new Date(b.progress.lastAccessed).getTime() : 0
          if (ad !== bd) {
            const comp = ad - bd // ascending base (oldest first)
            return sortDirection === 'asc' ? comp : -comp
          }
          const titleComp = a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
          return sortDirection === 'asc' ? titleComp : -titleComp
        })
        break
    }
    return arr
  })()

  // Build groups -> lectures map from current data
  const groupedLectures = Object.keys(courseGroups).reduce((acc, groupName) => {
    const ids = courseGroups[groupName]
    const list = sortedLectures.filter(l => ids.includes(l.id))
    if (list.length > 0) acc[groupName] = list
    return acc
  }, {} as Record<string, typeof lectures>)

  // Ungrouped are those not in any group
  const assignedLectureIds = Object.values(courseGroups).flat()
  const ungroupedLectures = sortedLectures.filter(l => !assignedLectureIds.includes(l.id))

  const getCourseGroup = (courseId: string): string => {
    for (const [gn, ids] of Object.entries(courseGroups)) {
      if (ids.includes(courseId)) return gn
    }
    return '__none__'
  }

  // Header tri-color progress values
  const headerTotalQuestions = specialty.progress?.totalQuestions || 1
  const headerCorrect = specialty.progress?.correctQuestions || 0
  const headerIncorrect = specialty.progress?.incorrectQuestions || 0
  const headerPartial = specialty.progress?.partialQuestions || 0
  const headerCorrectPercent = (headerCorrect / headerTotalQuestions) * 100
  const headerPartialPercent = (headerPartial / headerTotalQuestions) * 100
  const headerIncorrectPercent = (headerIncorrect / headerTotalQuestions) * 100

  // Per-lecture mode helpers
  const getLectureMode = (lectureId: string): ModeKey => selectedModes[lectureId] || 'study'
  const getModeLabel = (mode: ModeKey) => mode === 'study' ? 'Étude' : mode === 'revision' ? 'Révision' : 'Épinglé'
  const getModePath = (mode: ModeKey) => mode === 'study' ? '' : mode === 'revision' ? '/revision' : '/pinned-test'
  const setLectureMode = (lectureId: string, mode: ModeKey) => setSelectedModes(prev => ({ ...prev, [lectureId]: mode }))
  const goToLectureMode = (lectureId: string) => {
    const mode = getLectureMode(lectureId)
    router.push(`/matieres/${specialtyId}/cours/${lectureId}${getModePath(mode)}`)
  }

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          <UniversalHeader title={specialty.name} />

          <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Breadcrumb */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/matieres')}
                    className="flex items-center gap-1 px-2 py-1 h-auto hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Matières
                  </Button>
                  <span>/</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{specialty.name}</span>
                </div>
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleEdit} 
                    className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Modifier
                  </Button>
                )}
              </div>

              {/* Overview */}
              <Card className="bg-white dark:bg-gray-800 shadow-sm">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="flex-1">
                      {specialty.description && (
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{specialty.description}</p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{specialty.progress?.totalLectures || 0}</div>
                          <div className="text-sm text-blue-600 dark:text-blue-400">Cours totaux</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                          <div className="text-2xl font-bold text-green-700 dark:text-green-300">{specialty.progress?.completedLectures || 0}</div>
                          <div className="text-sm text-green-600 dark:text-green-400">Terminés</div>
                        </div>
                        <div className="bg-medblue-50 dark:bg-medblue-900/20 rounded-lg p-4">
                          <div className="text-2xl font-bold text-medblue-700 dark:text-medblue-300">{Math.round(specialty.progress?.questionProgress || 0)}%</div>
                          <div className="text-sm text-medblue-600 dark:text-medblue-400">Progression</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Progression globale</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{Math.round(specialty.progress?.questionProgress || 0)}%</span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div className="absolute h-full bg-green-500" style={{ width: `${headerCorrectPercent}%` }} />
                      <div className="absolute h-full bg-orange-500" style={{ left: `${headerCorrectPercent}%`, width: `${headerPartialPercent}%` }} />
                      <div className="absolute h-full bg-red-500" style={{ left: `${headerCorrectPercent + headerPartialPercent}%`, width: `${headerIncorrectPercent}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Group Management */}
              {isAdmin && (
                <Card className="bg-white dark:bg-gray-800 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Gestion des groupes de cours</h3>
                      <Button onClick={() => setIsGroupManagementOpen(!isGroupManagementOpen)} variant="outline" size="sm" className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-100 transition-colors">
                        <Settings className="w-4 h-4 mr-2" />
                        {isGroupManagementOpen ? 'Masquer' : 'Gérer les groupes'}
                      </Button>
                    </div>

                    {isGroupManagementOpen && (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Input placeholder="Nom du nouveau groupe..." value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="flex-1" />
                          <Button onClick={createGroup} disabled={!newGroupName.trim()} className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <Plus className="w-4 h-4 mr-2" />
                            Créer un groupe
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.keys(courseGroups).map((groupName) => (
                            <div key={groupName} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Folder className="w-4 h-4 text-blue-600" />
                                <span className="font-medium">{groupName}</span>
                                <Badge variant="secondary" className="text-xs">{courseGroups[groupName].length}</Badge>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => deleteGroup(groupName)} className="h-8 w-8 p-0 text-red-600 hover:bg-red-50">
                                <Trash className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Search and Filter */}
              <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input placeholder="Rechercher des cours..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-white dark:bg-gray-800" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-100 transition-colors">
                      <Filter className="w-4 h-4" />
                      Filtrer
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedFilter('all')}>Tous les cours</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedFilter('completed')}>Terminés</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedFilter('in-progress')}>En cours</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedFilter('not-started')}>Non commencés</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-100 transition-colors">
                      <ArrowUpDown className="w-4 h-4" />
                      {(() => {
                        if (sortOption === 'default') return 'Trier';
                        const dirArrow = sortDirection === 'asc' ? '↑' : '↓';
                        if (sortOption === 'name') return `Nom ${dirArrow}`;
                        if (sortOption === 'note') return `Note ${dirArrow}`;
                        if (sortOption === 'lastAccessed') return `Accès ${dirArrow}`;
                        return 'Trier';
                      })()}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => { setSortOption('default'); setSortDirection('asc'); }}>Par défaut</DropdownMenuItem>
                    <div className="px-2 py-1 text-xs text-gray-500">Nom</div>
                    <DropdownMenuItem onClick={() => { setSortOption('name'); setSortDirection('asc'); }}>Nom A→Z</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortOption('name'); setSortDirection('desc'); }}>Nom Z→A</DropdownMenuItem>
                    <div className="px-2 pt-2 pb-1 text-xs text-gray-500">Note /20</div>
                    <DropdownMenuItem onClick={() => { setSortOption('note'); setSortDirection('desc'); }}>Note haute→basse</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortOption('note'); setSortDirection('asc'); }}>Note basse→haute</DropdownMenuItem>
                    <div className="px-2 pt-2 pb-1 text-xs text-gray-500">Dernier accès</div>
                    <DropdownMenuItem onClick={() => { setSortOption('lastAccessed'); setSortDirection('desc'); }}>Plus récent</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortOption('lastAccessed'); setSortDirection('asc'); }}>Plus ancien</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Lectures table */}
              <Card className="bg-white dark:bg-gray-800 shadow-sm">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {isAdmin && (
                          <TableHead className="w-8">
                            <Checkbox
                              aria-label="Tout sélectionner"
                              checked={(() => {
                                const ids = [...ungroupedLectures, ...Object.values(groupedLectures).flat()].map(l => l.id)
                                return ids.length > 0 && ids.every(id => selectedCourseIds[id])
                              })()}
                              onCheckedChange={(checked) => {
                                const allIds = [...ungroupedLectures, ...Object.values(groupedLectures).flat()].map(l => l.id)
                                const next: Record<string, boolean> = { ...selectedCourseIds }
                                allIds.forEach(id => { next[id] = !!checked })
                                setSelectedCourseIds(next)
                              }}
                            />
                          </TableHead>
                        )}
                        <TableHead>Cours</TableHead>
                        {isAdmin && <TableHead>Rapports</TableHead>}
                        <TableHead>Note /20</TableHead>
                        <TableHead className="w-64">Progression</TableHead>
                        <TableHead>Commentaires</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isAdmin && Object.values(selectedCourseIds).some(v => v) && (
                        <TableRow className="bg-blue-50/40 dark:bg-blue-900/10">
                          <TableCell colSpan={isAdmin ? 7 : 5}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">Affecter en masse au groupe :</span>
                              <Select onValueChange={(v) => v && bulkAssignToGroup(v)}>
                                <SelectTrigger className="w-56">
                                  <SelectValue placeholder="Choisir un groupe" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.keys(courseGroups).map((groupName) => (
                                    <SelectItem key={groupName} value={groupName}>{groupName}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedCourseIds({})} className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-100 transition-colors">Effacer la sélection</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Ungrouped rows */}
                      {ungroupedLectures.map((lecture) => (
                        <TableRow key={`lecture-ungrouped-${lecture.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          {isAdmin && (
                            <TableCell className="align-middle">
                              <Checkbox
                                checked={!!selectedCourseIds[lecture.id]}
                                onCheckedChange={(checked) => setSelectedCourseIds(prev => ({ ...prev, [lecture.id]: !!checked }))
                                }
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <File className="w-4 h-4 text-gray-500" />
                              <div>
                                <div className="font-medium">{lecture.title}</div>
                                <div className="text-sm text-gray-500">{lecture.description}</div>
                              </div>
                            </div>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/admin/reports?lectureId=${lecture.id}`)}
                                className="flex items-center gap-2 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                              >
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                                <span className="font-medium">{lecture.reportsCount || 0}</span>
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                              </Button>
                            </TableCell>
                          )}
                          <TableCell>
                            {(() => {
                              const note = lecture.culmonNote;
                              if (note == null || isNaN(note)) return <span className="text-xs text-gray-400">-</span>;
                              const color = note >= 16 ? 'bg-green-100 text-green-700 border-green-300' : note >= 12 ? 'bg-blue-100 text-blue-700 border-blue-300' : note >= 8 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-red-100 text-red-700 border-red-300';
                              return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${color}`}>{note.toFixed(2)}</span>;
                            })()}
                          </TableCell>
                          <TableCell className="w-64">
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{Math.round(lecture.progress?.percentage || 0)}%</span>
                                <span className="text-xs text-gray-500">{lecture.progress?.completedQuestions || 0}/{lecture.progress?.totalQuestions || 0}</span>
                              </div>
                              <div className="relative h-2 w-56 overflow-hidden rounded-full bg-gray-200">
                                {(() => {
                                  const total = lecture.progress?.totalQuestions || 1
                                  const correct = lecture.progress?.correctAnswers || 0
                                  const incorrect = lecture.progress?.incorrectAnswers || 0
                                  const partial = lecture.progress?.partialAnswers || 0
                                  const correctPercent = (correct / total) * 100
                                  const incorrectPercent = (incorrect / total) * 100
                                  const partialPercent = (partial / total) * 100
                                  return (
                                    <>
                                      <div className="absolute top-0 left-0 h-full bg-green-500" style={{ width: `${correctPercent}%` }} />
                                      <div className="absolute top-0 h-full bg-red-500" style={{ left: `${correctPercent}%`, width: `${incorrectPercent}%` }} />
                                      <div className="absolute top-0 h-full bg-yellow-500" style={{ left: `${correctPercent + incorrectPercent}%`, width: `${partialPercent}%` }} />
                                    </>
                                  )
                                })()}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCommentsLectureId(lecture.id)}
                              className="group flex items-center gap-2 px-2 py-1 hover:bg-transparent"
                              aria-label="Voir les commentaires"
                            >
                              <span className="flex items-center justify-center w-[30px] h-[30px] rounded-full bg-blue-500/10 dark:bg-blue-400/10">
                                <MessageCircle className="w-4 h-4 sm:w-[16px] sm:h-[16px] text-blue-500 dark:text-blue-400" strokeWidth={2} />
                              </span>
                              <span className="text-sm font-semibold leading-none tabular-nums text-blue-500 dark:text-blue-400">
                                {lecture.commentsCount ?? 0}
                              </span>
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => goToLectureMode(lecture.id)}
                                className="h-8 bg-sky-500 hover:bg-sky-600 text-white"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                {getModeLabel(getLectureMode(lecture.id))}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    aria-label="Changer le mode"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-md bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setLectureMode(lecture.id, 'study')}>Étude</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setLectureMode(lecture.id, 'revision')}>Révision</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setLectureMode(lecture.id, 'pinned')}>Épinglé</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Grouped rows */}
                      {Object.entries(groupedLectures).map(([groupName, glist]) => [
                        <TableRow key={`group-${groupName}`} className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                          <TableCell colSpan={isAdmin ? 7 : 5}>
                            <Button variant="ghost" onClick={() => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))} className="flex items-center gap-2 p-0 h-auto font-medium text-gray-900 dark:text-gray-100">
                              <Folder className="w-4 h-4 text-blue-600" />
                              {expandedGroups[groupName] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              {groupName}
                              <Badge variant="secondary" className="ml-2">{glist.length} cours</Badge>
                            </Button>
                          </TableCell>
                        </TableRow>,
                        ...(expandedGroups[groupName] ? glist.map((lecture) => (
                          <TableRow key={`lecture-${lecture.id}`} className="border-l-4 border-l-blue-200 dark:border-l-blue-800">
                            {isAdmin && (
                              <TableCell className="align-middle">
                                <Checkbox
                                  checked={!!selectedCourseIds[lecture.id]}
                                  onCheckedChange={(checked) => setSelectedCourseIds(prev => ({ ...prev, [lecture.id]: !!checked }))
                                  }
                                />
                               </TableCell>
                            )}
                            <TableCell>
                              <div className="flex items-center gap-2 pl-6">
                                <File className="w-4 h-4 text-gray-500" />
                                <div>
                                  <div className="font-medium">{lecture.title}</div>
                                  <div className="text-sm text-gray-500">{lecture.description}</div>
                                </div>
                              </div>
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/reports?lectureId=${lecture.id}`)} className="flex items-center gap-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">
                                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                                  <span className="font-medium">{lecture.reportsCount || 0}</span>
                                  <ExternalLink className="w-3 h-3 text-gray-400" />
                                </Button>
                              </TableCell>
                            )}
                            <TableCell>
                              {(() => {
                                const note = (lecture as any).culmonNote;
                                if (note == null || isNaN(note)) return <span className="text-xs text-gray-400">-</span>;
                                const color = note >= 16 ? 'bg-green-100 text-green-700 border-green-300' : note >= 12 ? 'bg-blue-100 text-blue-700 border-blue-300' : note >= 8 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-red-100 text-red-700 border-red-300';
                                return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${color}`}>{note.toFixed(2)}</span>;
                              })()}
                            </TableCell>
                            <TableCell className="w-64">
                              <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span>{Math.round(lecture.progress?.percentage || 0)}%</span>
                                  <span className="text-xs text-gray-500">{lecture.progress?.completedQuestions || 0}/{lecture.progress?.totalQuestions || 0}</span>
                                </div>
                                {/* Three-color progress bar with real data */}
                                <div className="relative h-2 w-56 overflow-hidden rounded-full bg-gray-200">
                                  {(() => {
                                    const total = lecture.progress?.totalQuestions || 1;
                                    const correct = lecture.progress?.correctAnswers || 0;
                                    const incorrect = lecture.progress?.incorrectAnswers || 0;
                                    const partial = lecture.progress?.partialAnswers || 0;
                                    
                                    const correctPercent = (correct / total) * 100;
                                    const incorrectPercent = (incorrect / total) * 100;
                                    const partialPercent = (partial / total) * 100;
                                    
                                    return (
                                      <>
                                        {/* Correct answers - green */}
                                        <div 
                                          className="absolute top-0 left-0 h-full bg-green-500"
                                          style={{ width: `${correctPercent}%` }}
                                        />
                                        {/* Incorrect answers - red */}
                                        <div 
                                          className="absolute top-0 h-full bg-red-500"
                                          style={{ 
                                            left: `${correctPercent}%`,
                                            width: `${incorrectPercent}%` 
                                          }}
                                        />
                                        {/* Partial answers - yellow */}
                                        <div 
                                          className="absolute top-0 h-full bg-yellow-500"
                                          style={{ 
                                            left: `${correctPercent + incorrectPercent}%`,
                                            width: `${partialPercent}%` 
                                          }}
                                        />
                                      </>
                                    );
                                  })()}
                                </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCommentsLectureId(lecture.id)}
                              className="group flex items-center gap-2 px-2 py-1 hover:bg-transparent"
                              aria-label="Voir les commentaires"
                            >
                              <span className="flex items-center justify-center w-[30px] h-[30px] rounded-full bg-blue-500/10 dark:bg-blue-400/10">
                                <MessageCircle className="w-4 h-4 sm:w-[16px] sm:h-[16px] text-blue-500 dark:text-blue-400" strokeWidth={2} />
                              </span>
                              <span className="text-sm font-semibold leading-none tabular-nums text-blue-500 dark:text-blue-400">
                                {lecture.commentsCount ?? 0}
                              </span>
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => goToLectureMode(lecture.id)}
                                className="h-8 bg-sky-500 hover:bg-sky-600 text-white"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                {getModeLabel(getLectureMode(lecture.id))}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    aria-label="Changer le mode"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-md bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setLectureMode(lecture.id, 'study')}>Étude</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLectureMode(lecture.id, 'revision')}>Révision</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLectureMode(lecture.id, 'pinned')}>Épinglé</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                        )) : [])
                      ].flat())}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Lecture Comments Modal */}
          <Dialog open={!!commentsLectureId} onOpenChange={(open) => { if (!open) setCommentsLectureId(null) }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <DialogHeader>
                <DialogTitle>Commentaires du cours</DialogTitle>
              </DialogHeader>
              {commentsLectureId && (
                <LectureComments lectureId={commentsLectureId} />
              )}
            </DialogContent>
          </Dialog>

           <EditSpecialtyDialog specialty={specialty} isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSpecialtyUpdated={handleSpecialtyUpdated} />
         </SidebarInset>
       </AppSidebarProvider>
     </ProtectedRoute>
   )
 }
