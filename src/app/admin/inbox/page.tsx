'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Inbox, Check, Trash2, Clock, CheckCircle2, AlertTriangle, Info, X, Shield, Users, Settings, Activity, Bell, GraduationCap, ChevronLeft, ChevronRight, Calendar, Filter, X as XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  category?: 'question' | 'progress' | 'lecture' | 'reminder' | 'achievement' | 'system';
}

export default function AdminInboxPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelChangeRequests, setLevelChangeRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [showLevelRequestsDialog, setShowLevelRequestsDialog] = useState(false);
  const { t } = useTranslation();

  // Pagination and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);

  const formatTime = (d: string | Date) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return `Il y a ${Math.floor(diff)} sec`;
    if (diff < 3600) return `Il y a ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff/3600)} h`;
    return date.toLocaleString();
  };

  const loadLevelChangeRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const res = await fetch('/api/level-change-requests', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setLevelChangeRequests(data);
    } catch (error) {
      console.error('Error loading level change requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const loadNotifications = useCallback(async (page = 1, startDateFilter = '', endDateFilter = '') => {
    try {
      setLoading(true);
      // Use admin API to get all admin notifications (all admins see all admin notifications)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });

      if (startDateFilter) params.append('startDate', startDateFilter);
      if (endDateFilter) params.append('endDate', endDateFilter);

      const res = await fetch(`/api/admin/notifications?${params}`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      const stripAdmin = (s: string) => s?.replace(/^\[ADMIN\]\s*/i, '') ?? s;
      const list = (json.notifications || []).map((n: any) => ({
        id: n.id,
        title: stripAdmin(n.title),
        message: stripAdmin(n.message),
        read: !!n.isRead,
        type: n.type,
        time: n.createdAt ? formatTime(n.createdAt) : undefined,
      } as Notification));
      setNotifications(list);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalCount(json.pagination?.totalCount || 0);
      setCurrentPage(page);
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications(currentPage, startDate, endDate);
    loadLevelChangeRequests();
  }, [loadNotifications, loadLevelChangeRequests, currentPage, startDate, endDate]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleDateFilter = () => {
    setIsFiltering(true);
    setCurrentPage(1); // Reset to first page when filtering
    loadNotifications(1, startDate, endDate);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    setIsFiltering(true);
    loadNotifications(1, '', '');
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/notifications?id=${id}`, { method: 'PATCH', credentials: 'include' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      }
    } catch (e) {
      console.error('Error marking notification as read:', e);
    }
  };

  const handleLevelChangeRequest = async (requestId: string, status: 'approved' | 'rejected', adminNote?: string) => {
    try {
      const res = await fetch('/api/level-change-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId, status, adminNote }),
      });

      if (res.ok) {
        // Refresh the requests list
        await loadLevelChangeRequests();
      } else {
        console.error('Error updating level change request');
      }
    } catch (error) {
      console.error('Error updating level change request:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      await Promise.all(unread.map(n => fetch(`/api/admin/notifications?id=${n.id}`, { method: 'PATCH', credentials: 'include' })));
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/notifications?id=${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (e) {
      console.error('Error deleting notification:', e);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const hasUnreadNotifications = unreadCount > 0;

  const TypeIcon = ({ type, className }: { type?: string; className?: string }) => {
    const baseClass = className || "h-4 w-4";
    switch (type) {
      case 'success':
        return <CheckCircle2 className={`${baseClass} text-green-600`} />;
      case 'warning':
        return <AlertTriangle className={`${baseClass} text-orange-600`} />;
      case 'error':
        return <X className={`${baseClass} text-red-600`} />;
      default:
        return <Info className={`${baseClass} text-blue-600`} />;
    }
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const typeColor = (() => {
      switch (notification.type) {
        case 'success':
          return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
        case 'warning':
          return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
        case 'error':
          return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
        default:
          return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
      }
    })();

    const typeIconColor = (() => {
      switch (notification.type) {
        case 'success':
          return 'text-green-600 dark:text-green-400';
        case 'warning':
          return 'text-orange-600 dark:text-orange-400';
        case 'error':
          return 'text-red-600 dark:text-red-400';
        default:
          return 'text-blue-600 dark:text-blue-400';
      }
    })();

    // Extract user ID from niveau change notifications
    const userIdMatch = notification.title === 'Changement de niveau utilisateur'
      ? notification.message.match(/\[USER_ID:([^\]]+)\]/)
      : null;
    const userId = userIdMatch ? userIdMatch[1] : null;

    // Clean message by removing the user ID tag
    const cleanMessage = notification.message.replace(/\n\[USER_ID:[^\]]+\]$/, '');

    return (
      <div
        className={`group relative p-4 sm:p-6 transition-all duration-200 hover:shadow-lg sm:hover:scale-[1.01] ${
          notification.read
            ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
            : `bg-gradient-to-r from-white to-gray-50 dark:from-gray-900 dark:to-gray-800/50 border-l-4 ${typeColor} shadow-sm`
        }`}
      >
        {/* Unread indicator */}
        {!notification.read && (
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg animate-pulse" />
        )}

        <div className="flex gap-3 sm:gap-4">
          {/* Type Icon */}
          <div className="flex-shrink-0">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center bg-gradient-to-br ${typeColor} shadow-md`}>
              <TypeIcon type={notification.type} className={`h-5 w-5 sm:h-6 sm:w-6 ${typeIconColor}`} />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <h4 className={`text-base sm:text-lg font-semibold ${
                    notification.read
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'text-gray-900 dark:text-gray-100'
                  } line-clamp-2`}>
                    {notification.title}
                  </h4>
                  {!notification.read && (
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-1.5 sm:px-2 py-0.5 flex-shrink-0">
                      <span className="sm:hidden">•</span>
                      <span className="hidden sm:inline">Nouveau</span>
                    </Badge>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-3 leading-relaxed text-sm line-clamp-3 sm:line-clamp-none">
                  {cleanMessage}
                </p>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-gray-500 dark:text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    <span>{notification.time}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Settings className="h-3 w-3 flex-shrink-0" />
                    <span>Système</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 sm:gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200">
                {/* Level Change Requests Action Button */}
                {(notification.title.toLowerCase().includes('changement de niveau') || 
                  notification.title.toLowerCase().includes('demande de niveau')) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 sm:h-9 sm:px-3 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200 transition-all duration-200 text-xs"
                    onClick={() => setShowLevelRequestsDialog(true)}
                    title="Gérer les demandes de niveau"
                    aria-label="Gérer les demandes de niveau"
                  >
                    <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden xs:inline">Gérer</span>
                  </Button>
                )}
                {userId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 sm:h-9 sm:px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 transition-all duration-200 text-xs"
                    onClick={() => window.open(`/admin/users/${userId}`, '_blank')}
                    title="Voir le profil utilisateur"
                    aria-label="Voir le profil utilisateur"
                  >
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden xs:inline">Profil</span>
                  </Button>
                )}
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 sm:h-9 sm:px-3 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 transition-all duration-200 text-xs"
                    onClick={() => markAsRead(notification.id)}
                    title="Marquer comme lu"
                    aria-label="Marquer comme lu"
                  >
                    <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden xs:inline">Lu</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 sm:h-9 sm:px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 transition-all duration-200 text-xs"
                  onClick={() => deleteNotification(notification.id)}
                  title="Supprimer la notification"
                  aria-label="Supprimer la notification"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden xs:inline">Supprimer</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const LevelChangeRequestItem = ({ request }: { request: any }) => {
    const [adminNote, setAdminNote] = useState('');
    const [processing, setProcessing] = useState(false);

    const handleAction = async (status: 'approved' | 'rejected') => {
      setProcessing(true);
      await handleLevelChangeRequest(request.id, status, adminNote);
      setProcessing(false);
      setAdminNote('');
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pending':
          return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
        case 'approved':
          return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        case 'rejected':
          return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        default:
          return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      }
    };

    return (
      <div className="p-4 sm:p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {request.user.name || 'Utilisateur'}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {request.user.email}
                </p>
              </div>
            </div>
            <Badge className={getStatusColor(request.status)}>
              {request.status === 'pending' ? 'En attente' : 
               request.status === 'approved' ? 'Approuvé' : 'Rejeté'}
            </Badge>
          </div>

          {/* Level Change Details */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Niveau actuel</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {request.currentLevel.name}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Niveau demandé</p>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {request.requestedLevel.name}
                </p>
              </div>
            </div>
            
            {request.reason && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Raison</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {request.reason}
                </p>
              </div>
            )}
          </div>

          {/* Admin Actions (only for pending requests) */}
          {request.status === 'pending' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Note administrative (optionnel)
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Ajouter une note..."
                  className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  rows={2}
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => handleAction('approved')}
                  disabled={processing}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approuver
                </Button>
                <Button
                  onClick={() => handleAction('rejected')}
                  disabled={processing}
                  variant="destructive"
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Rejeter
                </Button>
              </div>
            </div>
          )}

          {/* Admin Note Display (for processed requests) */}
          {request.status !== 'pending' && request.adminNote && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Note administrative</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {request.adminNote}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Demandé le: {new Date(request.createdAt).toLocaleDateString('fr-FR')}</span>
            {request.reviewedAt && (
              <span>Traité le: {new Date(request.reviewedAt).toLocaleDateString('fr-FR')}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const LevelChangeRequestsDialog = () => {
    return (
      <Dialog open={showLevelRequestsDialog} onOpenChange={setShowLevelRequestsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Demandes de Changement de Niveau
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {loadingRequests ? (
                <div className="text-center py-8">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
                  </div>
                </div>
              ) : levelChangeRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Aucune demande
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Aucune demande de changement de niveau pour le moment.
                  </p>
                </div>
              ) : (
                levelChangeRequests.map((request) => (
                  <LevelChangeRequestItem key={request.id} request={request} />
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
              <Inbox className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                Boîte de Réception Admin
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                Centre de notifications système et alertes administratives
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => window.location.href = '/admin/notifications'}
              className="text-sm border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/50 shadow-sm transition-all duration-200 justify-center"
            >
              <Bell className="h-4 w-4 mr-2" />
              <span className="sm:hidden">Nouvelle notification</span>
              <span className="hidden sm:inline">Créer une notification</span>
            </Button>
            {hasUnreadNotifications && (
              <Button
                variant="outline"
                onClick={markAllAsRead}
                className="text-sm border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/50 shadow-sm justify-center"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                <span className="sm:hidden">Tout marquer lu</span>
                <span className="hidden sm:inline">Tout marquer comme lu</span>
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                  <Inbox className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Total</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20 border-red-200 dark:border-red-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">Non lues</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{unreadCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">Lues</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{notifications.filter(n => n.read).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-900 dark:text-purple-100">Demandes niveau</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {levelChangeRequests.filter(req => req.status === 'pending').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>



        {/* Filters and Pagination */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
          <CardContent className="p-6">
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
              {/* Date Filters */}
              <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center w-full xl:w-auto">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full sm:w-auto">
                  <div className="flex items-center gap-2 min-w-fit">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Filtrer par date:</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-1.5 font-medium">Date début</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 min-w-[140px]"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-xs text-gray-500 mb-1.5 font-medium">Date fin</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 min-w-[140px]"
                      />
                    </div>

                    <div className="flex gap-2 sm:mt-6">
                      <Button
                        onClick={handleDateFilter}
                        disabled={isFiltering}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all duration-200"
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Filtrer
                      </Button>
                      {(startDate || endDate) && (
                        <Button
                          onClick={clearFilters}
                          variant="outline"
                          size="sm"
                          className="border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 shadow-sm transition-all duration-200"
                        >
                          <XIcon className="h-4 w-4 mr-2" />
                          Effacer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pagination Info and Controls */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between w-full xl:w-auto xl:justify-end">
                {/* Pagination Info */}
                <div className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left xl:text-right">
                  {totalCount > 0 ? (
                    <>
                      <span className="font-medium">{totalCount} notification{totalCount > 1 ? 's' : ''}</span>
                      <span className="mx-2 text-gray-400">•</span>
                      <span>Page {currentPage} sur {totalPages}</span>
                    </>
                  ) : (
                    <span className="font-medium">Aucune notification</span>
                  )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || isFiltering}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 px-3 py-2 h-9 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-all duration-200"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1">Précédent</span>
                    </Button>

                    <div className="flex items-center gap-1 mx-2">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                        if (pageNum > totalPages) return null;
                        return (
                          <Button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            disabled={isFiltering}
                            variant={pageNum === currentPage ? "default" : "outline"}
                            size="sm"
                            className={`w-9 h-9 p-0 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-all duration-200 ${
                              pageNum === currentPage
                                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm'
                                : ''
                            }`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages || isFiltering}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 px-3 py-2 h-9 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-all duration-200"
                    >
                      <span className="hidden sm:inline mr-1">Suivant</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Notifications List */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Notifications Système
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                  Alertes et mises à jour importantes du système
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto"></div>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Inbox className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Boîte de réception vide
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Aucune notification administrative pour le moment. Les alertes système apparaîtront ici.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Level Change Requests Dialog */}
      <LevelChangeRequestsDialog />
    </AdminLayout>
  );
}