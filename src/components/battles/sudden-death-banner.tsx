"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Skull,
  Swords,
  Timer,
  AlertTriangle,
  Zap,
  Flame,
  CheckCircle2,
  ChevronRight,
  Code2,
  Radio,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface SuddenDeathPlayerState {
  userId: string;
  username: string;
  avatarUrl?: string;
  isSolved: boolean;
  timeToSolveMs?: number;
  keystrokesCount: number;
}

export interface SuddenDeathBannerProps {
  battleId?: string;
  endsAt?: number; // timestamp in ms
  durationSeconds?: number;
  puzzleTitle?: string;
  puzzleDescription?: string;
  puzzleLanguage?: string;
  player1?: SuddenDeathPlayerState;
  player2?: SuddenDeathPlayerState;
  onTimeExpired?: () => void;
  onSolveSubmit?: (code: string) => void;
  onOpenEditor?: () => void;
  className?: string;
}

export function SuddenDeathBanner({
  battleId = "battle_arena_tiebreaker",
  endsAt,
  durationSeconds = 180,
  puzzleTitle = "Rapid-Fire Bugfix: Inverted Binary Tree Depth",
  puzzleDescription = "Fix the off-by-one leaf traversal and inverted ternary check before the countdown hits zero.",
  puzzleLanguage = "typescript",
  player1 = {
    userId: "p1",
    username: "cyber_pulse",
    isSolved: false,
    keystrokesCount: 148,
  },
  player2 = {
    userId: "p2",
    username: "glitch_phantom",
    isSolved: false,
    keystrokesCount: 162,
  },
  onTimeExpired,
  onSolveSubmit,
  onOpenEditor,
  className,
}: SuddenDeathBannerProps) {
  // Target expiration timestamp
  const targetTime = useMemo(() => {
    return endsAt || Date.now() + durationSeconds * 1000;
  }, [endsAt, durationSeconds]);

  const [remainingMs, setRemainingMs] = useState<number>(() =>
    Math.max(0, targetTime - Date.now())
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Countdown timer loop
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, targetTime - now);
      setRemainingMs(diff);

      if (diff === 0) {
        clearInterval(interval);
        onTimeExpired?.();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [targetTime, onTimeExpired]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isCritical = totalSeconds <= 30 && totalSeconds > 0;
  const isExpired = totalSeconds === 0;

  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (isDismissed) return null;

  return (
    <motion.div
      data-testid="sudden-death-banner-container"
      initial={{ opacity: 0, y: -20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={cn(
        "relative w-full rounded-2xl border overflow-hidden shadow-2xl transition-all duration-300",
        isExpired
          ? "border-slate-800 bg-slate-950/90 text-slate-400"
          : isCritical
          ? "border-rose-500/80 bg-gradient-to-r from-[#180509] via-[#2D0B12] to-[#180509] ring-2 ring-rose-500/50 shadow-rose-950/50"
          : "border-amber-500/60 bg-gradient-to-r from-[#170F03] via-[#241705] to-[#170F03] ring-1 ring-amber-500/30 shadow-amber-950/40",
        className
      )}
    >
      {/* Top Animated Siren Glow Line */}
      <div
        className={cn(
          "h-1 w-full relative overflow-hidden",
          isCritical
            ? "bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 animate-pulse"
            : "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500"
        )}
      />

      <div className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left Side: Alert Title & Puzzle Specs */}
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              "p-2.5 rounded-2xl border flex items-center justify-center shrink-0 mt-0.5",
              isCritical
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-bounce"
                : "bg-amber-500/20 border-amber-500/40 text-amber-400"
            )}
          >
            <Skull className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                data-testid="sudden-death-status-badge"
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider border flex items-center gap-1",
                  isCritical
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse"
                    : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                )}
              >
                <AlertTriangle className="w-3 h-3" />
                {isExpired ? "TIEBREAKER EXPIRED" : isCritical ? "CRITICAL SUDDEN DEATH" : "SUDDEN DEATH TIEBREAKER"}
              </span>

              <span className="text-[11px] font-mono text-slate-400">
                1st To Solve Wins Match (+150 Bonus ELO)
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-black text-white mt-1 flex items-center gap-2">
              <Swords className="w-4 h-4 text-amber-400" />
              {puzzleTitle}
            </h3>

            <p className="text-xs text-slate-300 line-clamp-1 max-w-xl mt-0.5">
              {puzzleDescription}
            </p>
          </div>
        </div>

        {/* Right Side: Countdown Timer HUD & Action Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white/10 pt-3 md:pt-0">
          {/* Digital Timer HUD */}
          <div
            data-testid="countdown-timer-hud"
            className={cn(
              "px-4 py-2 rounded-xl border flex items-center gap-2.5 font-mono shadow-inner",
              isCritical
                ? "bg-rose-950/40 border-rose-500/60 text-rose-400 animate-pulse"
                : "bg-amber-950/40 border-amber-500/40 text-amber-300"
            )}
          >
            <Timer className="w-4 h-4" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 -mb-0.5">Time Remaining</span>
              <span data-testid="countdown-digits" className="text-lg font-black tracking-tight">
                {formattedTime}
              </span>
            </div>
          </div>

          {/* Competitor Keystroke Race Tracker */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">@{player1.username}:</span>
              <span className="font-bold text-cyan-300">{player1.keystrokesCount} cpm</span>
            </div>
            <span className="text-slate-600">vs</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">@{player2.username}:</span>
              <span className="font-bold text-amber-300">{player2.keystrokesCount} cpm</span>
            </div>
          </div>

          {/* Action: Open Micro-Puzzle */}
          <button
            type="button"
            data-testid="open-micro-puzzle-btn"
            onClick={onOpenEditor}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Open Puzzle</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
