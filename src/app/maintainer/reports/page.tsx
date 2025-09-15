'use client'

import { useEffect, useState, useCallback } from 'react';
import { MaintainerRoute } from '@/components/auth/MaintainerRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Clock, XCircle, Search, Filter, MessageSquare, User, BookOpen } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Report {
  id: string
  message: string
  status: 'pending' | 'resolved' | 'dismissed'
  reportType: 'erreur_de_saisie' | 'question_hors_cours' | 'correction_erronee'
  createdAt: string
  user: { id: string; email: string; name?: string }
  question: { id: string; text: string; type: string }
  lecture: { id: string; title: string; specialty: { id: string; name: string } }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />
    case 'resolved': return <CheckCircle className="w-4 h-4 text-green-600" />
    case 'dismissed': return <XCircle className="w-4 h-4 text-gray-600" />
    default: return <AlertTriangle className="w-4 h-4 text-red-600" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    case 'resolved': return 'bg-green-50 text-green-700 border-green-200'
    case 'dismissed': return 'bg-gray-50 text-gray-700 border-gray-200'
    default: return 'bg-red-50 text-red-700 border-red-200'
  }
}

export default function MaintainerReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [filteredReports, setFilteredReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      const url = params.size ? `/api/reports?${params.toString()}` : '/api/reports'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch reports')
      const data = await response.json()
      setReports(data)
    } catch (e) {
      console.error(e)
      toast({ title: 'Erreur', description: 'Impossible de charger les rapports', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, typeFilter])

  const filterReports = useCallback(() => {
    let filtered = reports
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(r =>
        r.message.toLowerCase().includes(q) ||
        r.question.text.toLowerCase().includes(q) ||
        r.lecture.title.toLowerCase().includes(q) ||
        r.lecture.specialty.name.toLowerCase().includes(q) ||
        r.user.email.toLowerCase().includes(q) ||
        r.user.name?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') filtered = filtered.filter(r => r.status === statusFilter)
    if (typeFilter !== 'all') filtered = filtered.filter(r => r.reportType === typeFilter)
    setFilteredReports(filtered)
  }, [reports, searchQuery, statusFilter, typeFilter])

  useEffect(() => { fetchReports() }, [fetchReports])
  useEffect(() => { filterReports() }, [reports, searchQuery, statusFilter, filterReports])

  return (
    <MaintainerRoute>
      <AppLayout>
        <div className="space-y-8">
          <div className="text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4">Rapports (Niveau)</h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Voir les rapports des spécialités de votre niveau
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="resolved">Résolus</SelectItem>
                <SelectItem value="dismissed">Ignorés</SelectItem>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun rapport</h3>
                <p className="text-gray-600">Aucun rapport ne correspond à vos filtres.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          {getStatusIcon(report.status)}
                          <Badge className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                          </span>
                        </div>
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
                                  <p className="font-medium text-gray-900 dark:text-gray-100">Message</p>
                                  <Badge variant="secondary">
                                    {report.reportType === 'erreur_de_saisie' ? 'Erreur de saisie' : report.reportType === 'question_hors_cours' ? 'Question hors cours' : 'Correction erronée'}
                                  </Badge>
                                </div>
                                <p className="text-gray-700 dark:text-gray-300">{report.message}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
  </AppLayout>
    </MaintainerRoute>
  );
}
