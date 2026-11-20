import { useState } from 'react';

export interface AppNotification {
  id: string;
  type: 'BATTLE_INVITE' | 'NEW_FOLLOWER' | 'ACHIEVEMENT_UNLOCKED' | 'STREAK_WARNING';
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif_1',
      type: 'BATTLE_INVITE',
      title: 'DevBattle Challenge!',
      message: '@alexmercer has challenged you in TypeScript Arena with 100 XP wager.',
      createdAt: '3m ago',
      isRead: false,
    },
    {
      id: 'notif_2',
      type: 'NEW_FOLLOWER',
      title: 'New Follower',
      message: '@elena_rust started following your developer journey.',
      createdAt: '24m ago',
      isRead: false,
    },
    {
      id: 'notif_3',
      type: 'ACHIEVEMENT_UNLOCKED',
      title: 'Achievement Unlocked',
      message: 'You earned "PR Prodigy" for merging 25 pull requests.',
      createdAt: '2h ago',
      isRead: true,
    },
  ]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
