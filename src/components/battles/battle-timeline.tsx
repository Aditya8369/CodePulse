"use client";

import type { ElementType } from "react";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Activity,
  Timer,
  Trophy,
  Zap,
  Target,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Gauge,
  FastForward,
} from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DevData {
  username: string;
  name: string;
  avatar: string;
  score: number;
  stats: any;
  topLanguages: any[];
}

interface RoundStat {
  label: string;
  v1: number;
  v2: number;
}

interface BattleRound {
  id: string;
  title: string;
  topic: string;
  icon: string;
  timeP1: number;
  timeP2: number;
  scoreP1: number;
  scoreP2: number;
  stats: RoundStat[];
  cumulativeP1: number;
  cumulativeP2: number;
}

export interface BattleTimelineProps {
  player1: DevData;
  player2: DevData;
  battleType: string;
  isMuted?: boolean;
  initialSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

const ROUND_CATEGORIES = [
  { id: "profile", title: "Profile Battle", topic: "Followers & Repos", icon: "Activity" },
  { id: "repository", title: "Repository Battle", topic: "Stars & Quality", icon: "Trophy" },
  { id: "activity", title: "Activity Battle", topic: "Commits & PRs", icon: "Zap" },
  { id: "language", title: "Language Battle", topic: "Top Languages", icon: "Target" },
  { id: "quality", title: "Repository Quality", topic: "Stars Per Repo", icon: "Trophy" },
];

const ROUND_FILTERS: Record<string, string[]> = {
  "Repository Battle": ["repository", "quality"],
  "Activity Battle": ["activity"],
  "Language Battle": ["language"],
  "Open Source Impact": ["repository", "activity"],
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity,
  Trophy,
  Zap,
  Target,
};

const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8] as const;

function seedRandom(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return () => {
    hash = (hash * 1664525 + 1013904223) | 0;
    return (hash >>> 0) / 0xffffffff;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundStats(battleType: string, p1: DevData, p2: DevData, id: string): RoundStat[] {
  const s1 = p1.stats || {};
  const s2 = p2.stats || {};
  const get = (obj: Record<string, unknown>, key: string, def = 0) =>
    obj == null ? def : Number(obj[key] ?? def) || def;

  switch (id) {
    case "profile":
      return [
        { label: "Followers", v1: get(s1, "followers"), v2: get(s2, "followers") },
        { label: "Public Repos", v1: get(s1, "repos"), v2: get(s2, "repos") },
      ];
    case "repository":
      return [
        { label: "Total Stars", v1: get(s1, "totalStars"), v2: get(s2, "totalStars") },
        {
          label: "Avg Stars/Repo",
          v1: get(s1, "repos") ? get(s1, "totalStars") / get(s1, "repos") : 0,
          v2: get(s2, "repos") ? get(s2, "totalStars") / get(s2, "repos") : 0,
        },
      ];
    case "activity":
      return [
        { label: "Total Commits", v1: get(s1, "totalCommits"), v2: get(s2, "totalCommits") },
        { label: "Pull Requests", v1: get(s1, "totalPRs"), v2: get(s2, "totalPRs") },
        { label: "Current Streak", v1: get(s1, "streak"), v2: get(s2, "streak") },
      ];
    case "language":
      return [
        { label: "Unique Languages", v1: p1.topLanguages?.length || 0, v2: p2.topLanguages?.length || 0 },
        { label: "Top Language Repos", v1: p1.topLanguages?.[0]?.count || 0, v2: p2.topLanguages?.[0]?.count || 0 },
      ];
    case "quality":
      return [
        {
          label: "Stars Per Repo",
          v1: get(s1, "repos") ? get(s1, "totalStars") / get(s1, "repos") : 0,
          v2: get(s2, "repos") ? get(s2, "totalStars") / get(s2, "repos") : 0,
        },
        {
          label: "Commits Per PR",
          v1: get(s1, "totalPRs") ? get(s1, "totalCommits") / get(s1, "totalPRs") : 0,
          v2: get(s2, "totalPRs") ? get(s2, "totalCommits") / get(s2, "totalPRs") : 0,
        },
      ];
    default:
      return [];
  }
}

export function BattleTimeline({
  player1,
  player2,
  battleType,
  initialSpeed = 1,
  onSpeedChange,
  onPlayStateChange,
}: BattleTimelineProps) {
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(initialSpeed);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentRoundIdx, setCurrentRoundIdx] = useState<number>(0);

  const rounds = useMemo(() => {
    const filterIds = ROUND_FILTERS[battleType] || ROUND_CATEGORIES.map((c) => c.id);
    const categories = ROUND_CATEGORIES.filter((c) => filterIds.includes(c.id));
    const rand = seedRandom(`${player1.username}|${player2.username}|${battleType}`);

    return categories.reduce<BattleRound[]>((acc, cat) => {
      const prev = acc[acc.length - 1];
      const prevCumP1 = prev?.cumulativeP1 ?? 0;
      const prevCumP2 = prev?.cumulativeP2 ?? 0;
      const stats = roundStats(battleType, player1, player2, cat.id);

      let p1Wins = 0;
      let p2Wins = 0;
      stats.forEach((s) => {
        if (s.v1 > s.v2) p1Wins++;
        else if (s.v2 > s.v1) p2Wins++;
      });

      const baseP1 = p1Wins > p2Wins ? 12 : p2Wins > p1Wins ? 6 : 9;
      const baseP2 = p2Wins > p1Wins ? 12 : p1Wins > p2Wins ? 6 : 9;

      const timeP1 = clamp(1.2 + rand() * 3.8, 1.2, 5.0);
      const timeP2 = clamp(1.2 + rand() * 3.8, 1.2, 5.0);

      const scoreP1 = Math.round(baseP1 + (timeP1 < 2.0 ? 3 : 0) + (timeP1 > 4.0 ? -2 : 0));
      const scoreP2 = Math.round(baseP2 + (timeP2 < 2.0 ? 3 : 0) + (timeP2 > 4.0 ? -2 : 0));

      return [
        ...acc,
        {
          id: cat.id,
          title: cat.title,
          topic: cat.topic,
          icon: cat.icon,
          timeP1,
          timeP2,
          scoreP1,
          scoreP2,
          stats,
          cumulativeP1: prevCumP1 + scoreP1,
          cumulativeP2: prevCumP2 + scoreP2,
        },
      ];
    }, []);
  }, [player1, player2, battleType]);

  // Replay playback timer effect
  useEffect(() => {
    if (!isPlaying) return;

    const intervalTime = Math.max(100, 1500 / playbackSpeed);
    const timer = setInterval(() => {
      setCurrentRoundIdx((prev) => {
        if (prev >= rounds.length - 1) {
          setIsPlaying(false);
          onPlayStateChange?.(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, rounds.length, onPlayStateChange]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next && currentRoundIdx >= rounds.length - 1) {
        setCurrentRoundIdx(0);
      }
      onPlayStateChange?.(next);
      return next;
    });
  }, [currentRoundIdx, rounds.length, onPlayStateChange]);

  const handleSpeedSelect = (speed: number) => {
    setPlaybackSpeed(speed);
    onSpeedChange?.(speed);
    toast.success(`Replay speed set to ${speed}x`);
  };

  const handleRewind = () => {
    setCurrentRoundIdx(0);
    setIsPlaying(false);
    onPlayStateChange?.(false);
  };

  const handleStepBack = () => {
    setCurrentRoundIdx((prev) => Math.max(0, prev - 1));
  };

  const handleStepForward = () => {
    setCurrentRoundIdx((prev) => Math.min(rounds.length - 1, prev + 1));
  };

  const p1Faster = rounds.some((r) => r.timeP1 < r.timeP2);
  const p2Faster = rounds.some((r) => r.timeP2 < r.timeP1);
  const speedWinner = p1Faster && !p2Faster ? player1.name : p2Faster && !p1Faster ? player2.name : "Tie";

  const totalP1 = rounds[rounds.length - 1]?.cumulativeP1 ?? 0;
  const totalP2 = rounds[rounds.length - 1]?.cumulativeP2 ?? 0;

  const badgeFor = (time: number) => {
    if (time < 2.0) return { label: "⚡ Lightning Fast", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
    if (time > 4.0) return { label: "🐢 Too Slow", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" };
    return { label: "", color: "" };
  };

  const chartData = rounds.map((r, i) => ({
    round: `R${i + 1}`,
    p1: r.cumulativeP1,
    p2: r.cumulativeP2,
  }));

  return (
    <section className="space-y-6" data-testid="battle-timeline-section">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">Round-by-Round Breakdown</h3>
        </div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1 rounded bg-primary/10 text-primary">
          {rounds.length} Rounds
        </div>
      </div>

      {/* Battle Replay Playback Speed Controller Dock (0.5x, 1x, 2x, 4x, 8x) */}
      <div
        data-testid="playback-speed-controller-dock"
        className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 backdrop-blur-xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4"
      >
        {/* Play / Pause / Navigation Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="replay-play-pause-btn"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause replay" : "Play replay"}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all cursor-pointer"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          <button
            type="button"
            data-testid="replay-rewind-btn"
            onClick={handleRewind}
            aria-label="Rewind replay"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            data-testid="replay-step-back-btn"
            onClick={handleStepBack}
            disabled={currentRoundIdx === 0}
            aria-label="Previous round"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            type="button"
            data-testid="replay-step-forward-btn"
            onClick={handleStepForward}
            disabled={currentRoundIdx >= rounds.length - 1}
            aria-label="Next round"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <div className="ml-2 flex flex-col">
            <span className="text-xs font-semibold text-white">
              {isPlaying ? "Replay Streaming" : "Replay Paused"}
            </span>
            <span className="text-[11px] text-slate-400">
              Round {currentRoundIdx + 1} of {rounds.length}
            </span>
          </div>
        </div>

        {/* Speed Selector Pill Dock */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10">
          <div className="px-2 text-slate-400 flex items-center gap-1 text-xs">
            <Gauge className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Speed:</span>
          </div>
          {PLAYBACK_SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              data-testid={`speed-btn-${speed}x`}
              onClick={() => handleSpeedSelect(speed)}
              aria-pressed={playbackSpeed === speed}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                playbackSpeed === speed
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 scale-105"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card/50 backdrop-blur-xl border border-border rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Timer className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Speed Delta</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${speedWinner === player1.name ? "bg-primary/10 text-primary" : "bg-border text-muted-foreground"}`}>
            {player1.name}
          </span>
          <span className="text-xs text-muted-foreground">vs</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${speedWinner === player2.name ? "bg-primary/10 text-primary" : "bg-border text-muted-foreground"}`}>
            {player2.name}
          </span>
        </div>
        <span className={`text-sm font-bold ${speedWinner === "Tie" ? "text-muted-foreground" : "text-primary"}`}>
          {speedWinner === "Tie" ? "Even pace" : `${speedWinner} answered faster`}
        </span>
      </div>

      <div className="bg-card/50 backdrop-blur-xl border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-semibold">Cumulative Score Progression</h4>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="text-border/50" vertical={false} />
              <XAxis dataKey="round" className="text-[10px] text-muted-foreground" tickLine={false} axisLine={false} />
              <YAxis className="text-[10px] text-muted-foreground" tickLine={false} axisLine={false} width={40} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const entry = payload[0] as unknown as {
                    data: { round: string; p1: number; p2: number };
                  };
                  return (
                    <div className="bg-card border border-border p-2 rounded-lg text-sm shadow-lg">
                      <div className="font-bold">{entry.data.round}</div>
                      <div className="flex gap-2">
                        <span className="text-primary font-medium">P1: {entry.data.p1}</span>
                        <span className="text-destructive font-medium">P2: {entry.data.p2}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="p1" stroke="var(--primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="p2" stroke="var(--destructive)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Accordion className="w-full">
        {rounds.map((round, idx) => {
          const IconComp = ICON_MAP[round.icon] ?? Activity;
          const p1Badge = badgeFor(round.timeP1);
          const p2Badge = badgeFor(round.timeP2);
          const faster = round.timeP1 < round.timeP2 ? player1.name : round.timeP2 < round.timeP1 ? player2.name : "Tie";
          const isCurrentActive = idx === currentRoundIdx;

          return (
            <AccordionItem
              key={round.id}
              value={round.id}
              className={cn(
                "border-border rounded-xl transition-all",
                isCurrentActive && "ring-1 ring-indigo-500/50 bg-indigo-500/[0.03]"
              )}
            >
              <AccordionTrigger className="flex items-center justify-between gap-3 bg-background/40 border-none p-3 text-left hover:bg-accent/50 transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconComp className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">{round.title}</span>
                    <span className="text-xs text-muted-foreground">{round.topic}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-bold rounded px-1.5 py-0.5 ${faster === player1.name ? "bg-emerald-500/10 text-emerald-400" : faster === player2.name ? "bg-orange-500/10 text-orange-400" : "bg-border text-muted-foreground"}`}>
                      ⚡ {faster}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {round.timeP1.toFixed(1)}s vs {round.timeP2.toFixed(1)}s
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="text-xs font-bold text-primary">{round.scoreP1}</span>
                  <span className="text-xs font-bold text-destructive">{round.scoreP2}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
              </AccordionTrigger>
              <AccordionContent className="border-none p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-card/50 border border-border/50">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{player1.name}</div>
                    <div className="text-xl font-bold text-foreground">{round.scoreP1}</div>
                    <div className="mt-2 flex items-center gap-1">
                      {p1Badge.label && (
                        <span className={`text-xs px-2 py-0.5 rounded ${p1Badge.color}`}>{p1Badge.label}</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-card/50 border border-border/50">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{player2.name}</div>
                    <div className="text-xl font-bold text-foreground">{round.scoreP2}</div>
                    <div className="mt-2 flex items-center gap-1">
                      {p2Badge.label && (
                        <span className={`text-xs px-2 py-0.5 rounded ${p2Badge.color}`}>{p2Badge.label}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {round.stats.map((stat) => {
                    const p1Wins = stat.v1 > stat.v2;
                    const p2Wins = stat.v2 > stat.v1;
                    return (
                      <div key={stat.label} className="flex items-center justify-between bg-background/50 rounded-lg p-3">
                        <span className="text-sm text-muted-foreground">{stat.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-mono font-bold w-16 text-right", p1Wins ? "text-primary" : p2Wins ? "text-destructive" : "text-muted-foreground")}>
                            {Number(stat.v1).toLocaleString()}
                          </span>
                          <span className={cn("text-sm font-mono font-bold w-16 text-left", p2Wins ? "text-primary" : p1Wins ? "text-destructive" : "text-muted-foreground")}>
                            {Number(stat.v2).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="bg-card/50 backdrop-blur-xl border border-border rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium">Timeline Total</span>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="text-xs text-muted-foreground block">{player1.name}</span>
            <span className="text-lg font-bold text-primary">{totalP1}</span>
          </div>
          <div className="w-px h-4 bg-border"></div>
          <div>
            <span className="text-xs text-muted-foreground block">{player2.name}</span>
            <span className="text-lg font-bold text-destructive">{totalP2}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
