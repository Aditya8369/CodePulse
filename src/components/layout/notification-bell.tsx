'use client';

import React, { useState } from 'react';
import { Bell, CheckCheck, Trash2, Swords, UserPlus, Trophy, AlertTriangle } from 'lucide-react';
import { useNotifications, AppNotification } from '@/hooks/use-notifications';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'BATTLE_INVITE':
        return <Swords className="w-4 h-4 text-amber-400" />;
      case 'NEW_FOLLOWER':
        return <UserPlus className="w-4 h-4 text-primary" />;
      case 'ACHIEVEMENT_UNLOCKED':
        return <Trophy className="w-4 h-4 text-emerald-400" />;
      case 'STREAK_WARNING':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl border border-border bg-card/60 hover:bg-card text-muted-foreground hover:text-foreground transition"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={markAllAsRead}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
              <button
                onClick={clearAll}
                className="text-muted-foreground hover:text-rose-400 p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No notifications right now.
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition ${
                    notif.isRead ? 'bg-card opacity-70' : 'bg-primary/5 hover:bg-primary/10'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-background border border-border shrink-0 mt-0.5">
                    {getIcon(notif.type)}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground">{notif.title}</h4>
                      <span className="text-[10px] font-mono text-muted-foreground">{notif.createdAt}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
