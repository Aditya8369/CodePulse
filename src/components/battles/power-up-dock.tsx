"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, EyeOff, Shuffle, Clock, Zap, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type PowerUp =
  | "SYNTAX_SCRAMBLE"
  | "SCREEN_FOG"
  | "VARIABLE_INVERT"
  | "KEY_DELAY";

export interface PowerUpItem {
  id: PowerUp;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  glowColor: string;
  desc: string;
  cooldownSec: number;
  hotkey: string;
}

export const POWER_UPS: PowerUpItem[] = [
  {
    id: "SYNTAX_SCRAMBLE",
    name: "Syntax Scramble",
    icon: Shuffle,
    color: "from-amber-500 to-orange-500",
    glowColor: "rgba(245, 158, 11, 0.4)",
    desc: "Temporarily swaps bracket pairs in enemy editor",
    cooldownSec: 25,
    hotkey: "1",
  },
  {
    id: "SCREEN_FOG",
    name: "Screen Fog",
    icon: EyeOff,
    color: "from-purple-500 to-indigo-500",
    glowColor: "rgba(168, 85, 247, 0.4)",
    desc: "Blur opponent editor code for 5 seconds",
    cooldownSec: 30,
    hotkey: "2",
  },
  {
    id: "VARIABLE_INVERT",
    name: "Variable Invert",
    icon: Sparkles,
    color: "from-pink-500 to-rose-500",
    glowColor: "rgba(244, 63, 94, 0.4)",
    desc: "Alters variable identifier syntax highlighting",
    cooldownSec: 20,
    hotkey: "3",
  },
  {
    id: "KEY_DELAY",
    name: "Key Delay",
    icon: Clock,
    color: "from-cyan-500 to-blue-500",
    glowColor: "rgba(6, 182, 212, 0.4)",
    desc: "Injects 150ms synthetic input latency into opponent buffer",
    cooldownSec: 35,
    hotkey: "4",
  },
];

export interface PowerUpDockProps {
  onCastPowerUp?: (powerUp: PowerUp) => void;
  className?: string;
  disabled?: boolean;
}

interface CooldownState {
  remaining: number;
  total: number;
}

export const PowerUpDock: React.FC<PowerUpDockProps> = ({
  onCastPowerUp,
  className = "",
  disabled = false,
}) => {
  const [cooldowns, setCooldowns] = useState<Record<string, CooldownState>>({});
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(intervalsRef.current).forEach((intervalId) => {
        clearInterval(intervalId);
      });
      intervalsRef.current = {};
    };
  }, []);

  const handleCast = useCallback(
    (powerUp: PowerUpItem) => {
      if (disabled) {
        toast.error("Power-up dock is temporarily disabled.");
        return;
      }

      const active = cooldowns[powerUp.id];
      if (active && active.remaining > 0) {
        toast.error(
          `${powerUp.name} is recharging (${active.remaining}s remaining)`,
        );
        return;
      }

      // Trigger Cast Callback
      onCastPowerUp?.(powerUp.id);
      toast.success(`Cast ${powerUp.name}! Sabotaging opponent...`);

      // Initialize Cooldown State
      const totalSec = powerUp.cooldownSec;
      setCooldowns((prev) => ({
        ...prev,
        [powerUp.id]: { remaining: totalSec, total: totalSec },
      }));

      // Clear existing interval if present
      if (intervalsRef.current[powerUp.id]) {
        clearInterval(intervalsRef.current[powerUp.id]);
      }

      // Interval countdown timer
      intervalsRef.current[powerUp.id] = setInterval(() => {
        setCooldowns((prev) => {
          const current = prev[powerUp.id];
          if (!current || current.remaining <= 1) {
            clearInterval(intervalsRef.current[powerUp.id]);
            delete intervalsRef.current[powerUp.id];
            const next = { ...prev };
            delete next[powerUp.id];
            return next;
          }
          return {
            ...prev,
            [powerUp.id]: {
              ...current,
              remaining: current.remaining - 1,
            },
          };
        });
      }, 1000);
    },
    [cooldowns, disabled, onCastPowerUp],
  );

  // Keyboard Hotkey Listener (1, 2, 3, 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement as HTMLElement)?.isContentEditable;

      if (isInput) return;

      const matchedPowerUp = POWER_UPS.find((p) => p.hotkey === e.key);
      if (matchedPowerUp) {
        e.preventDefault();
        handleCast(matchedPowerUp);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCast]);

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Battle Power-Ups Sabotage Dock"
      className={cn(
        "rounded-2xl border border-white/10 bg-slate-900/90 dark:bg-slate-900/90 backdrop-blur-xl p-3 md:p-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4",
        className,
      )}
    >
      {/* Header Dock Label */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
          <Zap className="w-4 h-4 fill-current animate-pulse" />
        </div>
        <div>
          <span className="text-xs font-black text-white uppercase tracking-wider block">
            Sabotage Dock
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:block">
            Cast live editor power-ups
          </span>
        </div>
      </div>

      {/* Power-Up Slots */}
      <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
        {POWER_UPS.map((p) => {
          const Icon = p.icon;
          const cooldownState = cooldowns[p.id];
          const isOnCooldown = Boolean(
            cooldownState && cooldownState.remaining > 0,
          );
          const remaining = cooldownState?.remaining || 0;
          const total = cooldownState?.total || p.cooldownSec;

          // Radial SVG geometry
          const radius = 17;
          const circumference = 2 * Math.PI * radius;
          const strokeDashoffset = isOnCooldown
            ? circumference * (1 - remaining / total)
            : 0;

          return (
            <motion.button
              key={p.id}
              type="button"
              data-testid={`power-up-${p.id}`}
              onClick={() => handleCast(p)}
              disabled={disabled || isOnCooldown}
              whileHover={disabled || isOnCooldown ? undefined : { scale: 1.04 }}
              whileTap={disabled || isOnCooldown ? undefined : { scale: 0.96 }}
              title={`${p.name} [Hotkey: ${p.hotkey}]: ${p.desc}`}
              className={cn(
                "relative group px-2.5 py-2 md:px-3 md:py-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-semibold select-none shrink-0",
                isOnCooldown
                  ? "border-amber-500/30 bg-slate-950/70 text-slate-400 cursor-not-allowed"
                  : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white hover:border-white/20 cursor-pointer shadow-sm",
              )}
            >
              {/* Icon Container with Animated Cooldown Radial */}
              <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
                {isOnCooldown ? (
                  <>
                    {/* SVG Radial Cooldown Ring */}
                    <svg
                      data-testid={`cooldown-radial-${p.id}`}
                      className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                      viewBox="0 0 42 42"
                    >
                      {/* Background track circle */}
                      <circle
                        cx="21"
                        cy="21"
                        r={radius}
                        fill="transparent"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="3"
                      />
                      {/* Animated radial progress circle */}
                      <circle
                        cx="21"
                        cy="21"
                        r={radius}
                        fill="transparent"
                        stroke="#f59e0b"
                        strokeWidth="3"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                      />
                    </svg>
                    {/* Remaining seconds counter in center */}
                    <span
                      data-testid={`cooldown-counter-${p.id}`}
                      className="font-mono text-[11px] font-black text-amber-400"
                    >
                      {remaining}s
                    </span>
                  </>
                ) : (
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105",
                      p.color,
                    )}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* Power-up Info */}
              <div className="text-left flex flex-col pr-1">
                <span className="text-xs font-bold leading-tight block">
                  {p.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {isOnCooldown ? "Recharging" : "Ready"}
                </span>
              </div>

              {/* Hotkey Badge */}
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10 shrink-0">
                {p.hotkey}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default PowerUpDock;
