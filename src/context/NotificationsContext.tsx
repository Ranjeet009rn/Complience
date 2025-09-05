import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: number; // epoch ms
  read: boolean;
};

type NotificationsContextType = {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (n: Omit<NotificationItem, 'id' | 'createdAt' | 'read'> & { read?: boolean }) => void;
  markAllRead: () => void;
  clearAll: () => void;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const STORAGE_KEY = 'app_notifications_v1';

function loadFromStorage(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(list: NotificationItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    void 0; // noop
  }
}

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    setNotifications(loadFromStorage());
  }, []);

  useEffect(() => {
    saveToStorage(notifications);
  }, [notifications]);

  const addNotification = useCallback((n: Omit<NotificationItem, 'id' | 'createdAt' | 'read'> & { read?: boolean }) => {
    setNotifications((prev) => [
      {
        id: crypto.randomUUID(),
        title: n.title,
        message: n.message,
        createdAt: Date.now(),
        read: n.read ?? false,
      },
      ...prev,
    ]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value: NotificationsContextType = useMemo(() => ({
    notifications,
    unreadCount,
    addNotification,
    markAllRead,
    clearAll,
  }), [notifications, unreadCount, addNotification, markAllRead, clearAll]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
