"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface DeviceSession {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ipAddress: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  type: "desktop" | "mobile" | "tablet";
}

const DEFAULT_SESSIONS: DeviceSession[] = [
  {
    id: "sess_curr",
    deviceName: "Windows Workstation",
    browser: "Chrome 125.0",
    os: "Windows 11",
    ipAddress: "103.212.43.12",
    location: "Bengaluru, India",
    lastActive: "Active Now",
    isCurrent: true,
    type: "desktop",
  },
  {
    id: "sess_mbp",
    deviceName: "MacBook Pro 16\"",
    browser: "Safari 17.4",
    os: "macOS Sonoma",
    ipAddress: "142.250.190.46",
    location: "San Francisco, United States",
    lastActive: "2 hours ago",
    isCurrent: false,
    type: "desktop",
  },
  {
    id: "sess_iphone",
    deviceName: "iPhone 15 Pro",
    browser: "CodePulse PWA Mobile",
    os: "iOS 17.5",
    ipAddress: "103.212.43.19",
    location: "Bengaluru, India",
    lastActive: "Yesterday at 18:42",
    isCurrent: false,
    type: "mobile",
  },
  {
    id: "sess_ipad",
    deviceName: "iPad Air 5th Gen",
    browser: "Chrome iOS",
    os: "iPadOS 17.4",
    ipAddress: "49.207.210.88",
    location: "Mumbai, India",
    lastActive: "3 days ago",
    isCurrent: false,
    type: "tablet",
  },
];

export interface ActiveSessionsTableProps {
  initialSessions?: DeviceSession[];
  onRevokeSession?: (sessionId: string) => void;
  onRevokeAllOthers?: () => void;
  className?: string;
}

export function ActiveSessionsTable({
  initialSessions = DEFAULT_SESSIONS,
  onRevokeSession,
  onRevokeAllOthers,
  className,
}: ActiveSessionsTableProps) {
  const [sessions, setSessions] = useState<DeviceSession[]>(initialSessions);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = (session: DeviceSession) => {
    if (session.isCurrent) return;
    setRevokingId(session.id);

    setTimeout(() => {
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      setRevokingId(null);
      onRevokeSession?.(session.id);
      toast.success(`Session for ${session.deviceName} was revoked!`, {
        description: `IP ${session.ipAddress} has been signed out.`,
      });
    }, 400);
  };

  const handleRevokeAllOtherSessions = () => {
    const remoteCount = sessions.filter((s) => !s.isCurrent).length;
    if (remoteCount === 0) {
      toast.info("No other active remote sessions to revoke.");
      return;
    }

    setSessions((prev) => prev.filter((s) => s.isCurrent));
    onRevokeAllOthers?.();
    toast.success(`Revoked ${remoteCount} remote session${remoteCount > 1 ? "s" : ""}!`, {
      description: "All other devices have been disconnected from your account.",
    });
  };

  const getDeviceIcon = (type: DeviceSession["type"]) => {
    switch (type) {
      case "mobile":
        return <Smartphone className="w-5 h-5 text-indigo-400" />;
      case "tablet":
        return <Tablet className="w-5 h-5 text-cyan-400" />;
      default:
        return <Monitor className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div
      data-testid="active-sessions-table-container"
      className={cn("glass-card rounded-[20px] p-6 space-y-5 text-slate-100", className)}
    >
      {/* Table Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Active Device Sessions
            </h3>
            <span
              data-testid="sessions-count-badge"
              className="px-2 py-0.5 rounded-full bg-white/[0.06] text-xs font-mono text-slate-300 border border-white/10"
            >
              {sessions.length} Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage all active browser sessions logged into your CodePulse account with remote sign-out.
          </p>
        </div>

        <button
          type="button"
          data-testid="revoke-all-others-btn"
          onClick={handleRevokeAllOtherSessions}
          className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Revoke All Other Sessions</span>
        </button>
      </div>

      {/* Sessions List */}
      <div data-testid="sessions-list" className="space-y-3">
        <AnimatePresence mode="popLayout">
          {sessions.map((session) => (
            <motion.div
              key={session.id}
              data-testid={`session-row-${session.id}`}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors",
                session.isCurrent
                  ? "bg-emerald-950/20 border-emerald-500/30"
                  : "bg-white/[0.02] border-white/[0.08] hover:border-white/20"
              )}
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 shrink-0 mt-0.5">
                  {getDeviceIcon(session.type)}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-white">{session.deviceName}</span>

                    {session.isCurrent ? (
                      <span
                        data-testid="current-device-badge"
                        className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        THIS DEVICE
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-400">
                        Remote Session
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      {session.browser} • {session.os}
                    </span>
                    <span className="text-slate-500 hidden sm:inline">•</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Globe className="w-3 h-3 text-slate-500" />
                      {session.location} ({session.ipAddress})
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Last active: {session.lastActive}</span>
                  </div>
                </div>
              </div>

              {/* Action Column */}
              <div className="shrink-0">
                {session.isCurrent ? (
                  <span className="text-xs font-mono font-bold text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 inline-block">
                    Current Active
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid={`revoke-btn-${session.id}`}
                    onClick={() => handleRevoke(session)}
                    disabled={revokingId === session.id}
                    className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>{revokingId === session.id ? "Revoking..." : "Revoke Session"}</span>
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
