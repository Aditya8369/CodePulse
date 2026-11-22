"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  type LucideIcon,
  Trophy,
  Swords,
  Target,
  TrendingUp,
  UserPlus,
  Bell,
  CheckCheck,
  Check,
  Clock,
  ExternalLink,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import type { Notification } from "@/types";
import { categoryForNotification, notificationCategories, type NotificationCategory } from "@/lib/notification-categories";

// ===========================
// Notification Category Helpers
// ===========================

interface CategoryConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
}

const CATEGORY_MAP: Record<string, CategoryConfig> = {
  achievement: {
    icon: Trophy,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  battle: {
    icon: Swords,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  challenge: {
    icon: Target,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  level_up: {
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  friend: {
    icon: UserPlus,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  system: {
    icon: Bell,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
};

// ===========================
// Props
// ===========================

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onMarkCategoryAsRead: (category: Exclude<NotificationCategory, "all">) => void;
}

function actionUrlFor(notification: Notification): string | null {
  const url = notification.actionUrl;
  if (url?.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return url;
  if (notification.type === "battle") return "/battles";
  if (notification.type === "achievement" || notification.type === "level_up") return "/achievements";
  if (notification.type === "challenge") return "/challenges";
  return null;
}

export function NotificationDropdown({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onMarkCategoryAsRead,
}: NotificationDropdownProps) {
  const [filter, setFilter] = useState<NotificationCategory>("all");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const filteredNotifications = notifications.filter((n) => {
    const matchesCategory = filter === "all" || categoryForNotification(n.type) === filter;
    const query = search.trim().toLowerCase();
    return matchesCategory && (!unreadOnly || !n.isRead) &&
      (!query || `${n.title} ${n.message}`.toLowerCase().includes(query));
  });
  const unreadInCategory = filter === "all" ? unreadCount : notifications.filter(
    (n) => !n.isRead && categoryForNotification(n.type) === filter,
  ).length;

  const handleItemClick = (notification: Notification) => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    const url = actionUrlFor(notification);
    if (url) {
      onClose();
      router.push(url);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={cn(
            "absolute right-0 top-full mt-2 z-50",
            "w-[calc(100vw-2rem)] sm:w-96 max-w-sm",
            "rounded-2xl bg-[#0B0F19]/95 backdrop-blur-2xl",
            "border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)]",
            "overflow-hidden flex flex-col text-white"
          )}
        >
          {/* Header */}
          <div className="p-4 pb-3 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-sm">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all as read
                </button>
              )}
            </div>

            <div aria-label="Notification categories" className="flex gap-1 overflow-x-auto rounded-xl bg-black/30 p-1 border border-white/5">
              {notificationCategories.map((category) => {
                const count = category === "all" ? unreadCount : notifications.filter(
                  (n) => !n.isRead && categoryForNotification(n.type) === category,
                ).length;
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={filter === category}
                    onClick={() => setFilter(category)}
                    className={cn(
                      "shrink-0 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer capitalize",
                      filter === category ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white",
                    )}
                  >
                    {category} <span aria-label={`${count} unread`}>({count})</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="flex flex-1 items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-muted-foreground">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <input
                  aria-label="Search notifications"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search notifications"
                  className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-muted-foreground"
                />
              </label>
              <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly((value) => !value)} className={cn("rounded-lg px-2 py-1 text-[11px]", unreadOnly ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white")}>Unread</button>
              {filter !== "all" && unreadInCategory > 0 && (
                <button type="button" onClick={() => onMarkCategoryAsRead(filter)} className="text-[11px] text-primary hover:text-primary/80">
                  Mark category read
                </button>
              )}
            </div>
          </div>

          {/* Notifications Scrollable List */}
          <motion.div key={filter} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.16 }} className="max-h-[380px] overflow-y-auto divide-y divide-white/5 scrollbar-thin">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((notification) => {
                const config =
                  CATEGORY_MAP[notification.type] || CATEGORY_MAP.system;
                const Icon = config.icon;

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleItemClick(notification)}
                    className={cn(
                      "group p-3.5 flex items-start gap-3 transition-colors cursor-pointer relative",
                      notification.isRead
                        ? "hover:bg-white/[0.03] opacity-80"
                        : "bg-white/[0.02] hover:bg-white/[0.05]"
                    )}
                  >
                    {/* Unread indicator dot */}
                    {!notification.isRead && (
                      <span className="absolute top-4 right-3.5 w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                    )}

                    {/* Category Icon */}
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 transition-transform group-hover:scale-105",
                        config.bg,
                        config.border,
                        config.color
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h4
                          className={cn(
                            "text-xs truncate font-semibold",
                            notification.isRead ? "text-slate-300" : "text-white"
                          )}
                        >
                          {notification.title}
                        </h4>
                        {actionUrlFor(notification) && (
                          <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>

                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(notification.createdAt)}</span>
                      </div>
                      {actionUrlFor(notification) && (
                        <button type="button" onClick={(event) => { event.stopPropagation(); handleItemClick(notification); }} className="mt-1 text-[11px] font-medium text-primary hover:text-primary/80">
                          {notification.type === "battle" ? "View battle" : notification.type === "achievement" || notification.type === "level_up" ? "View achievement" : notification.type === "challenge" ? "View challenge" : "Open notification"}
                        </button>
                      )}
                    </div>

                    {/* Quick mark as read button */}
                    {!notification.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkAsRead(notification.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-all self-center"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              /* Empty State */
              <div className="py-12 px-6 text-center flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground mb-3">
                  <Bell className="w-6 h-6" />
                </div>
                <h4 className="font-semibold text-sm text-white mb-1">
                  {search ? "No matching notifications" : filter === "all" ? "No notifications" : `No ${filter} notifications`}
                </h4>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  {search ? "Try another search term." : "No notifications to show at this moment."}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
