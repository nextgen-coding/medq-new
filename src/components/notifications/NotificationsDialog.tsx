'use client';
import React, { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Trash2, Clock, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Notification {
  id: string;
  title: string;
  message: string;
  time?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  category?: 'question' | 'progress' | 'lecture' | 'reminder' | 'achievement' | 'system';
}

interface NotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotificationsUpdated?: () => void;
  focusNotificationId?: string;
}

// No mock data; notifications are fetched from the API

// Memoized notification item component for better performance
const NotificationItem = memo(({ 
  notification, 
  onMarkAsRead, 
  onDelete 
}: { 
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const TypeIcon = useMemo(() => {
    switch (notification.type) {
      case 'success':
        return CheckCircle2;
      case 'warning':
        return AlertTriangle;
      case 'error':
        return X;
      default:
        return Info;
    }
  }, [notification.type]);

  const typeColor = useMemo(() => {
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
  }, [notification.type]);

  const categoryIcon = useMemo(() => {
    switch (notification.category) {
      case 'question':
        return '❓';
      case 'progress':
        return '📈';
      case 'lecture':
        return '📚';
      case 'reminder':
        return '⏰';
      case 'achievement':
        return '🏆';
      case 'system':
        return '⚙️';
      default:
        return '📋';
    }
  }, [notification.category]);

  const handleMarkAsRead = useCallback(() => {
    onMarkAsRead(notification.id);
  }, [onMarkAsRead, notification.id]);

  const handleDelete = useCallback(() => {
    onDelete(notification.id);
  }, [onDelete, notification.id]);

  return (
    <div
      data-notification-id={notification.id}
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
            <TypeIcon className="h-5 w-5" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{categoryIcon}</span>
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
                  onClick={handleMarkAsRead}
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
                onClick={handleDelete}
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
});

NotificationItem.displayName = 'NotificationItem';

// Main component with performance optimizations
export function NotificationsDialog({ open, onOpenChange, onNotificationsUpdated, focusNotificationId }: NotificationsDialogProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const formatTime = (d: string | Date) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return `Il y a ${Math.floor(diff)} sec`;
    if (diff < 3600) return `Il y a ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff/3600)} h`;
    return date.toLocaleString();
  };

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/notifications?limit=50', { credentials: 'include' });
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
        // ignore errors
      }
    };
    if (open) load();
  }, [open]);

  // Scroll to focused notification when dialog opens
  useEffect(() => {
    if (open && focusNotificationId && scrollAreaRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const notificationElement = scrollAreaRef.current?.querySelector(`[data-notification-id="${focusNotificationId}"]`);
        if (notificationElement) {
          notificationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a temporary highlight effect
          notificationElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
          setTimeout(() => {
            notificationElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
          }, 2000);
        }
      }, 100);
    }
  }, [open, focusNotificationId, notifications]);

  // Memoized calculations for better performance
  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length, 
    [notifications]
  );

  const hasUnreadNotifications = useMemo(() => 
    unreadCount > 0, 
    [unreadCount]
  );

  const notificationStats = useMemo(() => ({
    total: notifications.length,
    unread: unreadCount,
    pluralTotal: notifications.length > 1 ? 's' : '',
    pluralUnread: unreadCount > 1 ? 'x' : ''
  }), [notifications.length, unreadCount]);

  // Optimized callback functions using useCallback
  const markAsRead = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications?id=${id}`, { method: 'PATCH', credentials: 'include' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        // Call the callback to update parent component
        onNotificationsUpdated?.();
      }
    } catch {}
  }, [onNotificationsUpdated]);

  const markAllAsRead = useCallback(async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      // Optimistically update UI
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      // Best-effort: call PATCH individually (no bulk endpoint yet)
      await Promise.all(unread.map(n => fetch(`/api/notifications?id=${n.id}`, { method: 'PATCH', credentials: 'include' })));
      // Call the callback to update parent component
      onNotificationsUpdated?.();
    } catch {}
  }, [notifications, onNotificationsUpdated]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications?id=${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Memoized empty state component
  const EmptyState = useMemo(() => (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
        <Bell className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        Aucune notification pour le moment
      </h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        Quand vous aurez de nouvelles mises à jour concernant vos études, elles apparaîtront ici.
      </p>
    </div>
  ), []);

  // Render optimized notification list
  const NotificationsList = useMemo(() => (
    notifications.map((notification) => (
      <NotificationItem
        key={notification.id}
        notification={notification}
        onMarkAsRead={markAsRead}
        onDelete={deleteNotification}
      />
    ))
  ), [notifications, markAsRead, deleteNotification]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Notifications
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                  Restez informé de vos progrès d'apprentissage
                </p>
              </div>
            </div>
            {hasUnreadNotifications && (
              <Badge className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-3 py-1 shadow-sm">
                {notificationStats.unread} nouveau{notificationStats.pluralUnread}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Quick Actions */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/80 dark:to-gray-800/50 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{notificationStats.total}</span> notification{notificationStats.pluralTotal} au total
            </div>
            <div className="flex items-center gap-2">
              {hasUnreadNotifications && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={markAllAsRead} 
                  className="text-xs border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/50"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Tout marquer comme lu
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClose} 
                className="text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-6">
          <div className="py-4 space-y-3">
            {notifications.length === 0 ? EmptyState : NotificationsList}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/80 dark:to-gray-800/50">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Les notifications sont automatiquement supprimées après 30 jours</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-green-500 rounded-full shadow-sm animate-pulse"></div>
              <span>Mises à jour en temps réel</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
