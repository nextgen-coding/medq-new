'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, Trash2, Clock, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
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

  const TypeIcon = ({ type }: { type?: string }) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'error':
        return <X className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const typeColor = (() => {
      switch (notification.type) {
        case 'success':
          return 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-950/50 border border-green-200 dark:border-green-800';
        case 'warning':
          return 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800';
        case 'error':
          return 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/50 border border-red-200 dark:border-red-800';
        default:
          return 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800';
      }
    })();

    return (
      <div
        className={`group relative p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${
          notification.read
            ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
            : 'bg-gradient-to-br from-blue-50/80 to-indigo-50/60 dark:from-blue-950/30 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700'
        }`}
      >
        {/* Unread indicator */}
        {!notification.read && (
          <div className="absolute top-4 left-4 w-2.5 h-2.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm" />
        )}

        <div className="flex gap-4">
          {/* Type Icon */}
          <div className="flex-shrink-0 mt-1">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeColor}`}>
              <TypeIcon type={notification.type} />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📋</span>
                  <h4 className={`text-sm font-semibold ${
                    notification.read
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {notification.title}
                  </h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 leading-relaxed whitespace-pre-line">
                  {notification.message}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>{notification.time}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-950/50 border border-transparent hover:border-green-200 dark:hover:border-green-800"
                    onClick={() => markAsRead(notification.id)}
                    title="Marquer comme lu"
                    aria-label="Marquer comme lu"
                  >
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-950/50 border border-transparent hover:border-red-200 dark:hover:border-red-800"
                  onClick={() => deleteNotification(notification.id)}
                  title="Supprimer la notification"
                  aria-label="Supprimer la notification"
                >
                  <Trash2 className="h-3 w-3 text-red-600 dark:text-red-400" />
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Mes Notifications
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Notifications reçues et mises à jour système
            </p>
          </div>
          {hasUnreadNotifications && (
            <Button
              variant="outline"
              onClick={markAllAsRead}
              className="text-xs border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/50"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Tout marquer comme lu
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Notifications
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                  {notifications.length} notification{notifications.length > 1 ? 's' : ''} au total
                  {unreadCount > 0 && (
                    <Badge className="ml-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-2 py-0.5">
                      {unreadCount} nouveau{unreadCount > 1 ? 'x' : ''}
                    </Badge>
                  )}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto mb-4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <Bell className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Aucune notification
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Vous n'avez reçu aucune notification pour le moment.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}