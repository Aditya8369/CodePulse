"use client";

import { motion } from "motion/react";
import {
  Swords,
  Eye,
  Award,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface HistoricalBattle {
  id: string;
  player1: any;
  player2: any;
  battleType: string;
  winner: "p1" | "p2" | "draw";
  p1Score: number;
  p2Score: number;
  xpChange: number;
  createdAt: string;
}

interface BattleHistoryListProps {
  battles: HistoricalBattle[];
  onReplay: (battle: HistoricalBattle) => void;
  onStartNew?: () => void;
  className?: string;
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays}d ago`;
}

function BattleEmptyIllustration() {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative mb-6 flex items-center justify-center"
      data-testid="battle-empty-illustration"
    >
      {/* Background ambient glow */}
      <div className="absolute h-36 w-36 rounded-full bg-gradient-to-tr from-purple-600/30 via-indigo-500/20 to-rose-500/20 blur-2xl pointer-events-none" />

      {/* SVG Arena Shield & Crossed Swords Illustration */}
      <svg
        className="relative h-32 w-32 drop-shadow-[0_10px_25px_rgba(139,92,246,0.3)]"
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="80" cy="80" r="70" fill="url(#arena-grad)" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
        <circle cx="80" cy="80" r="54" stroke="rgba(168,85,247,0.35)" strokeWidth="1.5" strokeDasharray="4 4" />

        {/* Shield outline in center */}
        <path
          d="M80 38L108 52V82C108 102 96 118 80 126C64 118 52 102 52 82V52L80 38Z"
          fill="url(#shield-fill)"
          stroke="#a855f7"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Crossed Swords Inside */}
        <path d="M66 64L94 92M94 64L66 92" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="66" cy="64" r="2.5" fill="#38bdf8" />
        <circle cx="94" cy="64" r="2.5" fill="#38bdf8" />
        <circle cx="66" cy="92" r="2.5" fill="#38bdf8" />
        <circle cx="94" cy="92" r="2.5" fill="#38bdf8" />

        {/* Sparkle stars */}
        <path d="M124 45L126 51L132 53L126 55L124 61L122 55L116 53L122 51L124 45Z" fill="#fbbf24" opacity="0.9" />
        <path d="M38 105L39.5 109.5L44 111L39.5 112.5L38 117L36.5 112.5L32 111L36.5 109.5L38 105Z" fill="#fbbf24" opacity="0.8" />

        <defs>
          <linearGradient id="arena-grad" x1="20" y1="20" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1e1b4b" stopOpacity="0.8" />
            <stop offset="1" stopColor="#0f172a" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="shield-fill" x1="52" y1="38" x2="108" y2="126" gradientUnits="userSpaceOnUse">
            <stop stopColor="#312e81" stopOpacity="0.9" />
            <stop offset="1" stopColor="#1e1b4b" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
}

export function BattleHistoryList({
  battles,
  onReplay,
  onStartNew,
  className,
}: BattleHistoryListProps) {
  if (!battles || battles.length === 0) {
    return (
      <div
        data-testid="battle-empty-state"
        className={cn(
          "glass-card rounded-[28px] p-8 sm:p-10 border border-white/10 text-center flex flex-col items-center justify-center my-8 shadow-2xl relative overflow-hidden",
          className,
        )}
      >
        <BattleEmptyIllustration />
        <h3 className="text-xl font-bold text-white mb-2">
          No Battle History Yet
        </h3>
        <p className="text-sm text-slate-300 max-w-sm mb-6 leading-relaxed">
          Step into the arena! Challenge any developer on GitHub to an epic comparison battle and
          record your first victory on the global leaderboard.
        </p>
        {onStartNew && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onStartNew}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-500/25 flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <Swords className="w-4 h-4" />
            <span>Start Your First Battle</span>
          </motion.button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 my-8", className)}>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/20 text-violet-400">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Recent Battles</h3>
            <p className="text-xs text-slate-400">
              Your match history and performance analytics
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/[0.04] border border-white/5 text-slate-400">
          {battles.length} {battles.length === 1 ? "match" : "matches"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {battles.map((battle, index) => {
          const isVictory = battle.winner === "p1";
          const isDraw = battle.winner === "draw";
          const opponent = battle.player2;

          return (
            <motion.div
              key={battle.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card rounded-2xl p-4 md:p-5 border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left: Outcome + Opponent Info */}
              <div className="flex items-center gap-4">
                {/* Outcome Badge */}
                <div
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider shrink-0 border flex items-center gap-1.5",
                    isVictory &&
                      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                    !isVictory &&
                      !isDraw &&
                      "bg-rose-500/15 text-rose-400 border-rose-500/30",
                    isDraw &&
                      "bg-slate-500/15 text-slate-400 border-slate-500/30",
                  )}
                >
                  {isVictory ? (
                    <>
                      <Award className="w-3.5 h-3.5" />
                      VICTORY
                    </>
                  ) : isDraw ? (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      DRAW
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-3.5 h-3.5" />
                      DEFEAT
                    </>
                  )}
                </div>

                {/* Opponent Profile */}
                <div className="flex items-center gap-3">
                  <img
                    src={opponent?.avatar || "https://github.com/ghost.png"}
                    alt={opponent?.username || "Opponent"}
                    className="w-10 h-10 rounded-full border border-white/10 object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        vs @{opponent?.username || "opponent"}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 border border-white/5">
                        {opponent?.tier || "Ranked"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">
                        {battle.battleType}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(battle.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Scores & Replay Action */}
              <div className="flex items-center justify-between md:justify-end gap-5 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                {/* Score & XP change */}
                <div className="text-left md:text-right">
                  <div className="text-base font-black text-white tracking-tight">
                    <span
                      className={cn(
                        isVictory ? "text-emerald-400" : "text-slate-400",
                      )}
                    >
                      {battle.p1Score}
                    </span>
                    <span className="text-slate-600 mx-1.5">-</span>
                    <span
                      className={cn(
                        !isVictory && !isDraw
                          ? "text-rose-400"
                          : "text-slate-400",
                      )}
                    >
                      {battle.p2Score}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "text-xs font-semibold flex items-center md:justify-end gap-1",
                      isVictory
                        ? "text-emerald-400"
                        : isDraw
                          ? "text-slate-400"
                          : "text-rose-400",
                    )}
                  >
                    {isVictory ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    <span>
                      {isVictory
                        ? `+${battle.xpChange || 25} XP`
                        : `-${battle.xpChange || 15} XP`}
                    </span>
                  </div>
                </div>

                {/* View Breakdown Button */}
                <button
                  onClick={() => onReplay(battle)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 text-white text-xs font-semibold flex items-center gap-2 transition-all group shrink-0"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
                  <span>View Breakdown</span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
