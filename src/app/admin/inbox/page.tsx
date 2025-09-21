'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Inbox, Check, Trash2, Clock, CheckCircle2, AlertTriangle, Info, X, Shield, Users, Settings, Activity } from 'lucide-react';
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
  const { t } = useTranslation();

  const formatTime = (d: string | Date) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return `Il y a ${Math.floor(diff)} sec`;
    if (diff < 3600) return `Il y a ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff/3600)} h`;
    return date.toLocaleString();
  };

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      // Use admin API to get all admin notifications (all admins see all admin notifications)
      const res = await fetch('/api/admin/notifications', { credentials: 'include' });
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
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

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
        className={`group relative p-6 transition-all duration-200 hover:shadow-lg hover:scale-[1.01] ${
          notification.read
            ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
            : `bg-gradient-to-r from-white to-gray-50 dark:from-gray-900 dark:to-gray-800/50 border-l-4 ${typeColor} shadow-sm`
        }`}
      >
        {/* Unread indicator */}
        {!notification.read && (
          <div className="absolute top-4 right-4 w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg animate-pulse" />
        )}

        <div className="flex gap-4">
          {/* Type Icon */}
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${typeColor} shadow-md`}>
              <TypeIcon type={notification.type} className={`h-6 w-6 ${typeIconColor}`} />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h4 className={`text-lg font-semibold ${
                    notification.read
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {notification.title}
                  </h4>
                  {!notification.read && (
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-2 py-0.5">
                      Nouveau
                    </Badge>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-3 leading-relaxed text-sm">
                  {cleanMessage}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{notification.time}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Settings className="h-3 w-3" />
                    <span>Système</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                {userId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 transition-all duration-200"
                    onClick={() => window.open(`/admin/users/${userId}`, '_blank')}
                    title="Voir le profil utilisateur"
                    aria-label="Voir le profil utilisateur"
                  >
                    <Users className="h-4 w-4 mr-1" />
                    Profil
                  </Button>
                )}
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 transition-all duration-200"
                    onClick={() => markAsRead(notification.id)}
                    title="Marquer comme lu"
                    aria-label="Marquer comme lu"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Lu
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 transition-all duration-200"
                  onClick={() => deleteNotification(notification.id)}
                  title="Supprimer la notification"
                  aria-label="Supprimer la notification"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
              <Inbox className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Boîte de Réception Admin
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Centre de notifications système et alertes administratives
              </p>
            </div>
          </div>
          {hasUnreadNotifications && (
            <Button
              variant="outline"
              onClick={markAllAsRead}
              className="text-sm border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/50 shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Tout marquer comme lu
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                  <Inbox className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Total</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{notifications.length}</p>
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
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{notifications.length - unreadCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
    </AdminLayout>
  );
}