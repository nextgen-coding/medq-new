'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AdminRoute } from '@/components/auth/AdminRoute'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Search,
  Filter,
  MessageSquare,
  User,
  BookOpen,
  BarChart3
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'
import { useTranslation } from 'react-i18next'

interface Report {
  id: string
  message: string
  status: 'pending' | 'resolved' | 'dismissed'
  reportType: 'erreur_de_saisie' | 'question_hors_cours' | 'correction_erronee'
  createdAt: string
  user: {
    id: string
    email: string
    name?: string
  }
  question: {
    id: string
    text: string
    type: string
  }
  lecture: {
    id: string
    title: string
    specialty: {
      id: string
      name: string
    }
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-600" />
    case 'resolved':
      return <CheckCircle className="w-4 h-4 text-green-600" />
    case 'dismissed':
      return <XCircle className="w-4 h-4 text-gray-600" />
    default:
      return <AlertTriangle className="w-4 h-4 text-red-600" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    case 'resolved':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'dismissed':
      return 'bg-gray-50 text-gray-700 border-gray-200'
    default:
      return 'bg-red-50 text-red-700 border-red-200'
  }
}

export default function AdminReportsPage() {
  const { isAdmin } = useAuth()
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const lectureId = searchParams.get('lectureId')
  
  const [reports, setReports] = useState<Report[]>([])
  const [filteredReports, setFilteredReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  // Define callbacks before effects
  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true)
  const params = new URLSearchParams()
  if (lectureId) params.set('lectureId', lectureId)
  if (statusFilter !== 'all') params.set('status', statusFilter)
  if (typeFilter !== 'all') params.set('type', typeFilter)
  const qs = params.toString()
  const url = qs ? `/api/reports?${qs}` : '/api/reports'
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json()
        setReports(data)
      } else {
        throw new Error('Failed to fetch reports')
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [lectureId, statusFilter, typeFilter])

  const filterReports = useCallback(() => {
    let filtered = reports

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(report => 
        report.message.toLowerCase().includes(query) ||
        report.question.text.toLowerCase().includes(query) ||
        report.lecture.title.toLowerCase().includes(query) ||
        report.lecture.specialty.name.toLowerCase().includes(query) ||
        report.user.email.toLowerCase().includes(query) ||
        report.user.name?.toLowerCase().includes(query)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(report => report.status === statusFilter)
    }
    if (typeFilter !== 'all') {
      filtered = filtered.filter(report => report.reportType === typeFilter)
    }

    setFilteredReports(filtered)
  }, [reports, searchQuery, statusFilter, typeFilter])

  // Effects that use the callbacks
  useEffect(() => {
    if (!isAdmin) return
    fetchReports()
  }, [isAdmin, lectureId, fetchReports])

  useEffect(() => {
    filterReports()
  }, [reports, searchQuery, statusFilter, filterReports])

  const updateReportStatus = async (reportId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        setReports(prev => 
          prev.map(report => 
            report.id === reportId 
              ? { ...report, status: newStatus as Report['status'] }
              : report
          )
        )
        toast({
          title: "Success",
          description: `Report ${newStatus} successfully`,
        })
      } else {
        throw new Error('Failed to update report')
      }
    } catch (error) {
      console.error('Error updating report:', error)
      toast({
        title: "Error",
        description: "Failed to update report status",
        variant: "destructive",
      })
    }
  }

  // Maintainers can access; UI remains the same

  return (
    <ProtectedRoute requireAdmin>
      <AdminRoute>
        <AdminLayout>
          <div className="space-y-8">
            {/* Modern Page Header */}
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4">{t('admin.reports')}</h1>
              <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                View and manage user reports
              </p>
            </div>

            <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Reports Management
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {lectureId ? 'Lecture-specific reports' : 'All system reports'}
              {filteredReports.length > 0 && ` - ${filteredReports.length} reports`}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reports</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-60">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrer par type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="erreur_de_saisie">Erreur de saisie</SelectItem>
              <SelectItem value="question_hors_cours">Question hors cours</SelectItem>
              <SelectItem value="correction_erronee">Correction erronée</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 rounded-full p-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold">
                    {reports.filter(r => r.status === 'pending').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 rounded-full p-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Resolved</p>
                  <p className="text-2xl font-bold">
                    {reports.filter(r => r.status === 'resolved').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 rounded-full p-2">
                  <XCircle className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dismissed</p>
                  <p className="text-2xl font-bold">
                    {reports.filter(r => r.status === 'dismissed').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-full p-2">
                  <AlertTriangle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold">{reports.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Found</h3>
              <p className="text-gray-600">
                {searchQuery || statusFilter !== 'all' 
                  ? 'No reports match your current filters.'
                  : 'No reports have been submitted yet.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-3">
                        {getStatusIcon(report.status)}
                        <Badge className={getStatusColor(report.status)}>
                          {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="w-4 h-4" />
                          <span>{report.user.name || report.user.email}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <BookOpen className="w-4 h-4" />
                          <span>{report.lecture.specialty.name} - {report.lecture.title}</span>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5" />
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  Message du rapport
                                </p>
                                <Badge variant="secondary">
                                  {report.reportType === 'erreur_de_saisie' ? 'Erreur de saisie' : report.reportType === 'question_hors_cours' ? 'Question hors cours' : 'Correction erronée'}
                                </Badge>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300">
                                {report.message}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Question ({report.question.type}):
                          </p>
                          <p className="text-blue-800 dark:text-blue-200 text-sm">
                            {report.question.text}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {report.status === 'pending' && (
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateReportStatus(report.id, 'resolved')}
                          className="text-green-600 hover:bg-green-50"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateReportStatus(report.id, 'dismissed')}
                          className="text-gray-600 hover:bg-gray-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
            </div>
          </div>
        </AdminLayout>
      </AdminRoute>
    </ProtectedRoute>
  )
}
