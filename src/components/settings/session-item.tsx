"use client";

import React from "react";
import {
  Monitor,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  LogOut,
  Loader2,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DeviceSession {
  id: string;
  deviceName: string;
  deviceType?: "desktop" | "mobile" | "tablet" | "Desktop" | "Mobile" | "Tablet";
  type?: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
  ipAddress: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface SessionItemProps {
  session: DeviceSession;
  onRevoke?: (sessionId: string) => void | Promise<void>;
  isRevoking?: boolean;
  className?: string;
}

export function SessionItem({
  session,
  onRevoke,
  isRevoking = false,
  className,
}: SessionItemProps) {
  const normalizedType = (session.deviceType || session.type || "desktop").toLowerCase();

  const getDeviceIcon = () => {
    switch (normalizedType) {
      case "mobile":
        return <Smartphone className="w-5 h-5 text-indigo-400" data-testid="device-icon-mobile" />;
      case "tablet":
        return <Tablet className="w-5 h-5 text-cyan-400" data-testid="device-icon-tablet" />;
      default:
        // If device name contains MacBook or Laptop, render Laptop icon, else Monitor
        if (/laptop|macbook|notebook/i.test(session.deviceName || session.os)) {
          return <Laptop className="w-5 h-5 text-emerald-400" data-testid="device-icon-laptop" />;
        }
        return <Monitor className="w-5 h-5 text-emerald-400" data-testid="device-icon-desktop" />;
    }
  };

  return (
    <div
      data-testid={`session-item-${session.id}`}
      className={cn(
        "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200",
        session.isCurrent
          ? "bg-emerald-950/20 border-emerald-500/30 shadow-sm shadow-emerald-950/30"
          : "bg-white/[0.02] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]",
        className
      )}
    >
      {/* Device & Client Info */}
      <div className="flex items-start gap-3.5">
        <div
          className={cn(
            "p-2.5 rounded-xl border shrink-0 mt-0.5",
            session.isCurrent
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-white/[0.04] border-white/10"
          )}
        >
          {getDeviceIcon()}
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-white">{session.deviceName}</span>

            {session.isCurrent ? (
              <span
                data-testid="current-device-badge"
                className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1 shadow-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                THIS DEVICE
              </span>
            ) : (
              <span
                data-testid="remote-device-badge"
                className="px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-[10px] font-mono text-slate-400"
              >
                Remote Device
              </span>
            )}
          </div>

          {/* Browser, OS, IP & Location */}
          <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-medium text-slate-200">
              {session.browser}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">
              {session.os}
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Globe className="w-3 h-3 text-slate-500" />
              <span>{session.location}</span>
              <span className="font-mono text-slate-500 text-[11px]">({session.ipAddress})</span>
            </span>
          </div>

          {/* Last Activity */}
          <div className="text-[11px] font-mono text-slate-400 mt-1 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>Last active: {session.lastActive}</span>
          </div>
        </div>
      </div>

      {/* Action Column */}
      <div className="shrink-0 flex items-center justify-end">
        {session.isCurrent ? (
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Now</span>
          </div>
        ) : (
          <button
            type="button"
            data-testid={`revoke-btn-${session.id}`}
            onClick={() => onRevoke?.(session.id)}
            disabled={isRevoking}
            className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 shadow-sm"
          >
            {isRevoking ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-rose-300" />
                <span>Revoking...</span>
              </>
            ) : (
              <>
                <LogOut className="w-3 h-3 text-rose-300" />
                <span>Revoke Session</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
