"use client";

import React from "react";
import { motion } from "motion/react";
import { Crown, Medal, Star, Trophy, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PodiumUser {
  id?: string;
  githubId?: string;
  username: string;
  name?: string;
  avatarUrl?: string;
  country?: string;
  stars?: number;
  forks?: number;
  points?: number;
  followers?: number;
  commits?: number;
}

interface LeaderboardPodiumProps {
  topUsers: PodiumUser[];
  categoryTitle?: string;
  onSelectUser?: (user: PodiumUser) => void;
}

export function LeaderboardPodium({
  topUsers,
  categoryTitle = "Top Contenders",
  onSelectUser,
}: LeaderboardPodiumProps) {
  if (!topUsers || topUsers.length < 3) return null;

  const first = topUsers[0];
  const second = topUsers[1];
  const third = topUsers[2];

  const podiumSlots = [
    {
      user: second,
      rank: 2,
      label: "2nd Place",
      medalColor: "text-slate-300 bg-slate-400/20 border-slate-300/40",
      pillarHeight: "h-36 sm:h-44",
      pillarGradient:
        "from-slate-400/20 via-slate-300/10 to-slate-500/5 border-t-4 border-slate-300 shadow-[0_0_20px_rgba(203,213,225,0.15)]",
      avatarBorder: "border-slate-300 shadow-slate-300/20",
      delay: 0.1,
    },
    {
      user: first,
      rank: 1,
      label: "1st Place",
      medalColor: "text-yellow-400 bg-yellow-400/20 border-yellow-400/40",
      pillarHeight: "h-48 sm:h-56",
      pillarGradient:
        "from-amber-500/25 via-yellow-500/15 to-amber-500/5 border-t-4 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.25)]",
      avatarBorder: "border-amber-400 shadow-amber-400/30 scale-105",
      delay: 0,
      isWinner: true,
    },
    {
      user: third,
      rank: 3,
      label: "3rd Place",
      medalColor: "text-amber-600 bg-amber-600/20 border-amber-600/40",
      pillarHeight: "h-28 sm:h-34",
      pillarGradient:
        "from-amber-700/20 via-amber-600/10 to-amber-800/5 border-t-4 border-amber-600 shadow-[0_0_20px_rgba(180,83,9,0.15)]",
      avatarBorder: "border-amber-600 shadow-amber-600/20",
      delay: 0.2,
    },
  ];

  return (
    <section
      role="region"
      aria-label="Olympic Podium for Top 3 Developers"
      className="w-full my-6 p-6 sm:p-8 rounded-3xl border border-white/10 bg-gradient-to-b from-[#0B0F19]/90 via-[#0B0F19]/60 to-transparent backdrop-blur-xl relative overflow-hidden shadow-2xl"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-36 bg-amber-500/10 blur-3xl pointer-events-none rounded-full" />

      {/* Header Banner */}
      <div className="flex flex-col items-center justify-center text-center mb-8 relative z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Trophy className="w-3.5 h-3.5" />
          <span>Olympic Podium</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <span>{categoryTitle}</span>
          <Sparkles className="w-4 h-4 text-amber-400" />
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Top 3 developers dominating the global contributor charts
        </p>
      </div>

      {/* Podium Grid */}
      <div className="flex items-end justify-center gap-3 sm:gap-6 max-w-3xl mx-auto pt-6 pb-2">
        {podiumSlots.map(
          ({
            user,
            rank,
            label,
            medalColor,
            pillarHeight,
            pillarGradient,
            avatarBorder,
            delay,
            isWinner,
          }) => (
            <motion.div
              key={user.id || user.githubId || user.username}
              data-testid={`podium-slot-${rank}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay, ease: "easeOut" }}
              onClick={() => onSelectUser?.(user)}
              className={cn(
                "flex-1 flex flex-col items-center cursor-pointer group transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl",
                isWinner ? "z-20" : "z-10"
              )}
              tabIndex={0}
              role="button"
              aria-label={`${label}: ${user.name || user.username}`}
            >
              {/* User Avatar & Rank Badge */}
              <div className="relative mb-3 flex flex-col items-center">
                {isWinner && (
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="absolute -top-7 text-amber-400 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                    title="Olympic Champion Crown"
                  >
                    <Crown className="w-7 h-7 fill-amber-400" />
                  </motion.div>
                )}

                <div
                  className={cn(
                    "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-0.5 border-2 shadow-xl bg-card overflow-hidden transition-all duration-300 group-hover:scale-105",
                    avatarBorder
                  )}
                >
                  <img
                    src={
                      user.avatarUrl || `https://github.com/${user.username}.png`
                    }
                    alt={user.username}
                    className="w-full h-full rounded-[14px] object-cover"
                  />
                </div>

                {/* Rank Number Badge */}
                <div
                  className={cn(
                    "absolute -bottom-2 px-2 py-0.5 rounded-full text-xs font-black border shadow-lg flex items-center gap-1",
                    medalColor
                  )}
                >
                  <Medal className="w-3 h-3" />
                  <span>#{rank}</span>
                </div>
              </div>

              {/* Developer Info */}
              <div className="text-center w-full px-1 mb-2">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-primary transition-colors">
                  {user.name || user.username}
                </h3>
                <p className="text-[11px] text-muted-foreground truncate">
                  @{user.username}
                </p>
                {user.country && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {user.country}
                  </span>
                )}
              </div>

              {/* Podium Pillar Pedestal */}
              <div
                className={cn(
                  "w-full rounded-2xl flex flex-col items-center justify-between p-3 sm:p-4 backdrop-blur-md transition-all duration-300",
                  pillarHeight,
                  pillarGradient
                )}
              >
                <div className="text-2xl sm:text-3xl font-black opacity-30 select-none">
                  {rank}
                </div>

                {/* Contributor Stats in Pillar */}
                <div className="w-full flex flex-col items-center gap-1 text-[11px] sm:text-xs">
                  {user.stars !== undefined && (
                    <div className="flex items-center gap-1 font-semibold text-amber-300">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{user.stars.toLocaleString()}</span>
                    </div>
                  )}
                  {user.points !== undefined && (
                    <div className="flex items-center gap-1 font-bold text-slate-200">
                      <Zap className="w-3 h-3 text-primary fill-primary/20" />
                      <span>{user.points.toLocaleString()} pts</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )
        )}
      </div>
    </section>
  );
}
