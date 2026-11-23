"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  Swords,
  Radio,
  Clock,
  CheckCircle2,
  ChevronRight,
  Shield,
  Search,
  ExternalLink,
  Users,
  Flame,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type BracketType = "UPPER" | "LOWER" | "GRAND_FINALS";
export type MatchStatus = "UPCOMING" | "LIVE" | "COMPLETED";

export interface BracketParticipant {
  id: string;
  name: string;
  seed?: number;
  score?: number;
  isWinner?: boolean;
  avatarUrl?: string;
}

export interface BracketMatch {
  id: string;
  bracket: BracketType;
  round: number;
  roundName: string;
  matchNumber: number;
  status: MatchStatus;
  participant1: BracketParticipant | null;
  participant2: BracketParticipant | null;
  scheduledTime?: string;
  streamUrl?: string;
}

export interface TournamentBracketProps {
  tournamentId?: string;
  tournamentName?: string;
  matches?: BracketMatch[];
  onSelectMatch?: (match: BracketMatch) => void;
  className?: string;
}

const DEFAULT_MATCHES: BracketMatch[] = [
  // Upper Bracket - Round 1 (Quarterfinals)
  {
    id: "ub-m1",
    bracket: "UPPER",
    round: 1,
    roundName: "Upper Quarterfinals",
    matchNumber: 1,
    status: "COMPLETED",
    participant1: { id: "p1", name: "CyberPulse Core", seed: 1, score: 2, isWinner: true },
    participant2: { id: "p8", name: "GlitchHunters", seed: 8, score: 0, isWinner: false },
    scheduledTime: "14:00 UTC",
  },
  {
    id: "ub-m2",
    bracket: "UPPER",
    round: 1,
    roundName: "Upper Quarterfinals",
    matchNumber: 2,
    status: "COMPLETED",
    participant1: { id: "p4", name: "Rustaceans Apex", seed: 4, score: 2, isWinner: true },
    participant2: { id: "p5", name: "ByteStorm", seed: 5, score: 1, isWinner: false },
    scheduledTime: "15:00 UTC",
  },
  {
    id: "ub-m3",
    bracket: "UPPER",
    round: 1,
    roundName: "Upper Quarterfinals",
    matchNumber: 3,
    status: "COMPLETED",
    participant1: { id: "p2", name: "Algorithm Aces", seed: 2, score: 2, isWinner: true },
    participant2: { id: "p7", name: "ZeroDay Syndicate", seed: 7, score: 0, isWinner: false },
    scheduledTime: "16:00 UTC",
  },
  {
    id: "ub-m4",
    bracket: "UPPER",
    round: 1,
    roundName: "Upper Quarterfinals",
    matchNumber: 4,
    status: "COMPLETED",
    participant1: { id: "p3", name: "NullPointer Kings", seed: 3, score: 1, isWinner: false },
    participant2: { id: "p6", name: "Binary Phantom", seed: 6, score: 2, isWinner: true },
    scheduledTime: "17:00 UTC",
  },
  // Upper Bracket - Round 2 (Semifinals)
  {
    id: "ub-m5",
    bracket: "UPPER",
    round: 2,
    roundName: "Upper Semifinals",
    matchNumber: 5,
    status: "COMPLETED",
    participant1: { id: "p1", name: "CyberPulse Core", seed: 1, score: 3, isWinner: true },
    participant2: { id: "p4", name: "Rustaceans Apex", seed: 4, score: 1, isWinner: false },
    scheduledTime: "18:00 UTC",
  },
  {
    id: "ub-m6",
    bracket: "UPPER",
    round: 2,
    roundName: "Upper Semifinals",
    matchNumber: 6,
    status: "COMPLETED",
    participant1: { id: "p2", name: "Algorithm Aces", seed: 2, score: 3, isWinner: true },
    participant2: { id: "p6", name: "Binary Phantom", seed: 6, score: 2, isWinner: false },
    scheduledTime: "19:00 UTC",
  },
  // Upper Bracket - Round 3 (Upper Finals)
  {
    id: "ub-m7",
    bracket: "UPPER",
    round: 3,
    roundName: "Upper Finals",
    matchNumber: 7,
    status: "LIVE",
    participant1: { id: "p1", name: "CyberPulse Core", seed: 1, score: 2, isWinner: false },
    participant2: { id: "p2", name: "Algorithm Aces", seed: 2, score: 2, isWinner: false },
    scheduledTime: "LIVE NOW",
    streamUrl: "https://twitch.tv/codepulse_esports",
  },
  // Lower Bracket - Round 1
  {
    id: "lb-m1",
    bracket: "LOWER",
    round: 1,
    roundName: "Lower Round 1",
    matchNumber: 8,
    status: "COMPLETED",
    participant1: { id: "p8", name: "GlitchHunters", seed: 8, score: 0, isWinner: false },
    participant2: { id: "p5", name: "ByteStorm", seed: 5, score: 2, isWinner: true },
    scheduledTime: "15:30 UTC",
  },
  {
    id: "lb-m2",
    bracket: "LOWER",
    round: 1,
    roundName: "Lower Round 1",
    matchNumber: 9,
    status: "COMPLETED",
    participant1: { id: "p7", name: "ZeroDay Syndicate", seed: 7, score: 1, isWinner: false },
    participant2: { id: "p3", name: "NullPointer Kings", seed: 3, score: 2, isWinner: true },
    scheduledTime: "17:30 UTC",
  },
  // Lower Bracket - Round 2
  {
    id: "lb-m3",
    bracket: "LOWER",
    round: 2,
    roundName: "Lower Round 2",
    matchNumber: 10,
    status: "COMPLETED",
    participant1: { id: "p6", name: "Binary Phantom", seed: 6, score: 2, isWinner: true },
    participant2: { id: "p5", name: "ByteStorm", seed: 5, score: 1, isWinner: false },
    scheduledTime: "19:30 UTC",
  },
  {
    id: "lb-m4",
    bracket: "LOWER",
    round: 2,
    roundName: "Lower Round 2",
    matchNumber: 11,
    status: "COMPLETED",
    participant1: { id: "p4", name: "Rustaceans Apex", seed: 4, score: 2, isWinner: true },
    participant2: { id: "p3", name: "NullPointer Kings", seed: 3, score: 0, isWinner: false },
    scheduledTime: "20:00 UTC",
  },
  // Lower Bracket - Round 3 (Lower Semifinals)
  {
    id: "lb-m5",
    bracket: "LOWER",
    round: 3,
    roundName: "Lower Semifinals",
    matchNumber: 12,
    status: "UPCOMING",
    participant1: { id: "p6", name: "Binary Phantom", seed: 6, score: 0, isWinner: false },
    participant2: { id: "p4", name: "Rustaceans Apex", seed: 4, score: 0, isWinner: false },
    scheduledTime: "21:00 UTC",
  },
  // Lower Bracket - Round 4 (Lower Finals)
  {
    id: "lb-m6",
    bracket: "LOWER",
    round: 4,
    roundName: "Lower Finals",
    matchNumber: 13,
    status: "UPCOMING",
    participant1: null,
    participant2: null,
    scheduledTime: "22:00 UTC",
  },
  // Grand Finals
  {
    id: "gf-m1",
    bracket: "GRAND_FINALS",
    round: 1,
    roundName: "Grand Championship Finals",
    matchNumber: 14,
    status: "UPCOMING",
    participant1: null,
    participant2: null,
    scheduledTime: "Tomorrow 18:00 UTC",
  },
];

export function TournamentBracket({
  tournamentId = "nsoc-s1-championship",
  tournamentName = "NSoC'26 CodePulse Global Masters",
  matches = DEFAULT_MATCHES,
  onSelectMatch,
  className,
}: TournamentBracketProps) {
  const [activeTab, setActiveTab] = useState<"ALL" | BracketType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null);

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const matchesTab = activeTab === "ALL" || m.bracket === activeTab;
      if (!matchesTab) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const p1Match = m.participant1?.name.toLowerCase().includes(q);
      const p2Match = m.participant2?.name.toLowerCase().includes(q);
      const roundMatch = m.roundName.toLowerCase().includes(q);
      return p1Match || p2Match || roundMatch;
    });
  }, [matches, activeTab, searchQuery]);

  // Group by bracket and round
  const upperRounds = useMemo(() => {
    const subset = filteredMatches.filter((m) => m.bracket === "UPPER");
    const rounds: Record<number, BracketMatch[]> = {};
    subset.forEach((m) => {
      rounds[m.round] = rounds[m.round] || [];
      rounds[m.round].push(m);
    });
    return rounds;
  }, [filteredMatches]);

  const lowerRounds = useMemo(() => {
    const subset = filteredMatches.filter((m) => m.bracket === "LOWER");
    const rounds: Record<number, BracketMatch[]> = {};
    subset.forEach((m) => {
      rounds[m.round] = rounds[m.round] || [];
      rounds[m.round].push(m);
    });
    return rounds;
  }, [filteredMatches]);

  const grandFinalMatches = useMemo(() => {
    return filteredMatches.filter((m) => m.bracket === "GRAND_FINALS");
  }, [filteredMatches]);

  const handleCardClick = (match: BracketMatch) => {
    setSelectedMatch(match);
    onSelectMatch?.(match);
  };

  const renderMatchCard = (match: BracketMatch) => {
    const isLive = match.status === "LIVE";
    const isCompleted = match.status === "COMPLETED";

    return (
      <motion.div
        key={match.id}
        data-testid={`match-card-${match.id}`}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.15 }}
        onClick={() => handleCardClick(match)}
        className={cn(
          "w-64 rounded-2xl border p-3 cursor-pointer transition-all duration-200 relative bg-[#0D121F]/90 backdrop-blur-md shadow-lg",
          isLive
            ? "border-rose-500/80 shadow-rose-500/20 ring-1 ring-rose-500/50"
            : isCompleted
            ? "border-slate-800 hover:border-slate-600"
            : "border-indigo-900/40 hover:border-indigo-700/60"
        )}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2 border-b border-white/5 pb-1.5">
          <span className="font-semibold text-slate-300">Match #{match.matchNumber}</span>
          {isLive ? (
            <span
              data-testid={`match-live-badge-${match.id}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 font-bold uppercase tracking-wider text-[10px] animate-pulse"
            >
              <Radio className="w-2.5 h-2.5" /> LIVE
            </span>
          ) : isCompleted ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px]">
              <CheckCircle2 className="w-3 h-3" /> Finished
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-400 text-[10px]">
              <Clock className="w-3 h-3" /> {match.scheduledTime || "Upcoming"}
            </span>
          )}
        </div>

        {/* Participant 1 */}
        <div
          className={cn(
            "flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors mb-1.5",
            match.participant1?.isWinner
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold"
              : "bg-white/[0.03] text-slate-200"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {match.participant1?.seed && (
              <span className="text-[10px] font-mono text-slate-500 font-bold">
                #{match.participant1.seed}
              </span>
            )}
            <span className="text-xs truncate">
              {match.participant1?.name || "TBD"}
            </span>
          </div>
          <span
            data-testid={`score-${match.id}-p1`}
            className={cn(
              "font-mono text-xs font-bold px-1.5 py-0.5 rounded",
              match.participant1?.isWinner
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-slate-400"
            )}
          >
            {match.participant1?.score !== undefined ? match.participant1.score : "-"}
          </span>
        </div>

        {/* Participant 2 */}
        <div
          className={cn(
            "flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors",
            match.participant2?.isWinner
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold"
              : "bg-white/[0.03] text-slate-200"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {match.participant2?.seed && (
              <span className="text-[10px] font-mono text-slate-500 font-bold">
                #{match.participant2.seed}
              </span>
            )}
            <span className="text-xs truncate">
              {match.participant2?.name || "TBD"}
            </span>
          </div>
          <span
            data-testid={`score-${match.id}-p2`}
            className={cn(
              "font-mono text-xs font-bold px-1.5 py-0.5 rounded",
              match.participant2?.isWinner
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-slate-400"
            )}
          >
            {match.participant2?.score !== undefined ? match.participant2.score : "-"}
          </span>
        </div>
      </motion.div>
    );
  };

  return (
    <div
      data-testid="tournament-bracket-view"
      className={cn("w-full flex flex-col gap-6 text-slate-100", className)}
    >
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl border border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold font-mono">
              DOUBLE ELIMINATION
            </span>
            <span className="text-xs text-slate-400 font-mono">16 Teams</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            {tournamentName}
          </h2>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search box */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search team or round..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white/[0.05] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Bracket Filter Tabs */}
          <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer",
                activeTab === "ALL"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("UPPER")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer",
                activeTab === "UPPER"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Winners (Upper)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("LOWER")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer",
                activeTab === "LOWER"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Losers (Lower)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("GRAND_FINALS")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer",
                activeTab === "GRAND_FINALS"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Grand Finals
            </button>
          </div>
        </div>
      </div>

      {/* Bracket Tree Canvas */}
      <div className="w-full overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="min-w-max flex flex-col gap-10 p-2">
          {/* Upper Bracket Section */}
          {(activeTab === "ALL" || activeTab === "UPPER") && Object.keys(upperRounds).length > 0 && (
            <div data-testid="upper-bracket-section" className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-indigo-500/20 pb-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold tracking-wider uppercase text-indigo-300 font-mono">
                  Winners Bracket (Upper)
                </h3>
              </div>
              <div className="flex gap-8 items-start pt-2">
                {Object.entries(upperRounds).map(([roundNum, roundMatches]) => (
                  <div key={`ub-round-${roundNum}`} className="flex flex-col gap-4">
                    <div className="text-xs font-mono font-bold text-slate-400 px-1">
                      {roundMatches[0]?.roundName || `Round ${roundNum}`}
                    </div>
                    <div className="flex flex-col gap-4">
                      {roundMatches.map(renderMatchCard)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lower Bracket Section */}
          {(activeTab === "ALL" || activeTab === "LOWER") && Object.keys(lowerRounds).length > 0 && (
            <div data-testid="lower-bracket-section" className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-amber-500/20 pb-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold tracking-wider uppercase text-amber-300 font-mono">
                  Losers Bracket (Lower)
                </h3>
              </div>
              <div className="flex gap-8 items-start pt-2">
                {Object.entries(lowerRounds).map(([roundNum, roundMatches]) => (
                  <div key={`lb-round-${roundNum}`} className="flex flex-col gap-4">
                    <div className="text-xs font-mono font-bold text-slate-400 px-1">
                      {roundMatches[0]?.roundName || `Round ${roundNum}`}
                    </div>
                    <div className="flex flex-col gap-4">
                      {roundMatches.map(renderMatchCard)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grand Finals Section */}
          {(activeTab === "ALL" || activeTab === "GRAND_FINALS") && grandFinalMatches.length > 0 && (
            <div data-testid="grand-finals-section" className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-amber-500/40 pb-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold tracking-wider uppercase text-amber-300 font-mono">
                  Grand Championship Finals
                </h3>
              </div>
              <div className="flex gap-8 items-start pt-2">
                <div className="flex flex-col gap-4">
                  <div className="text-xs font-mono font-bold text-amber-400 px-1">
                    Championship Decider
                  </div>
                  <div className="flex flex-col gap-4">
                    {grandFinalMatches.map(renderMatchCard)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Match Details Dialog */}
      {selectedMatch && (
        <Dialog open={!!selectedMatch} onOpenChange={(open) => !open && setSelectedMatch(null)}>
          <DialogContent
            data-testid="match-detail-dialog"
            className="max-w-lg bg-[#0B0F19]/95 backdrop-blur-2xl border border-white/10 text-white rounded-[28px] p-6 shadow-2xl"
          >
            <DialogHeader>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-400">
                <span>{selectedMatch.bracket} BRACKET</span>
                <span>•</span>
                <span>MATCH #{selectedMatch.matchNumber}</span>
              </div>
              <DialogTitle className="text-xl font-black text-white mt-1">
                {selectedMatch.roundName}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Scheduled for {selectedMatch.scheduledTime || "TBD"}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-4">
              {/* Head-to-Head Card */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="flex flex-col items-center text-center p-2">
                  <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">
                    Participant 1
                  </span>
                  <span className="text-base font-black text-white mt-1">
                    {selectedMatch.participant1?.name || "TBD"}
                  </span>
                  <span className="text-2xl font-black font-mono text-indigo-400 mt-2">
                    {selectedMatch.participant1?.score !== undefined ? selectedMatch.participant1.score : "-"}
                  </span>
                </div>

                <div className="flex flex-col items-center text-center p-2 border-l border-white/10">
                  <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">
                    Participant 2
                  </span>
                  <span className="text-base font-black text-white mt-1">
                    {selectedMatch.participant2?.name || "TBD"}
                  </span>
                  <span className="text-2xl font-black font-mono text-indigo-400 mt-2">
                    {selectedMatch.participant2?.score !== undefined ? selectedMatch.participant2.score : "-"}
                  </span>
                </div>
              </div>

              {/* Live Stream link if available */}
              {selectedMatch.streamUrl && (
                <a
                  href={selectedMatch.streamUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-rose-600/30"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>Watch Live Broadcast</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setSelectedMatch(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toast.success(`Subscribed to Match #${selectedMatch.matchNumber} alerts!`);
                    setSelectedMatch(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
                >
                  Set Reminder
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
