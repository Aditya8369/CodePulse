"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  Activity,
  Brain,
  Share2,
  TrendingUp,
  Crown,
  Award,
  Sparkles,
  Volume2,
  VolumeX,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Timer,
  Cpu,
  FileCode,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { triggerDualCannonConfetti, playVictorySound } from "@/lib/celebration";
import { BattleTimeline } from "./battle-timeline";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

interface DevData {
  username: string;
  name: string;
  avatar: string;
  score: number;
  stats: any;
  topLanguages: any[];
}

export interface CodeSolutionData {
  language?: string;
  p1Code?: string;
  p2Code?: string;
  p1ExecutionTimeMs?: number;
  p2ExecutionTimeMs?: number;
  p1MemoryKb?: number;
  p2MemoryKb?: number;
}

interface BattleReportProps {
  player1: DevData;
  player2: DevData;
  battleType: string;
  onRematch: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  selectedBot?: { name: string; difficulty: string; color: string; xpMultiplier: number } | null;
  solutionDiff?: CodeSolutionData;
}

const DEFAULT_SOLUTION_DIFF: CodeSolutionData = {
  language: "TypeScript",
  p1Code: `export function solveTwoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
  p2Code: `export function solveTwoSum(nums: number[], target: number): number[] {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) {
        return [i, j];
      }
    }
  }
  return [];
}`,
  p1ExecutionTimeMs: 42,
  p2ExecutionTimeMs: 168,
  p1MemoryKb: 4020,
  p2MemoryKb: 4180,
};

function CodeDiffAccordion({
  player1,
  player2,
  solutionDiff = DEFAULT_SOLUTION_DIFF,
}: {
  player1: DevData;
  player2: DevData;
  solutionDiff?: CodeSolutionData;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"side-by-side" | "unified">("side-by-side");

  const p1CodeLines = (solutionDiff.p1Code || DEFAULT_SOLUTION_DIFF.p1Code!).split("\n");
  const p2CodeLines = (solutionDiff.p2Code || DEFAULT_SOLUTION_DIFF.p2Code!).split("\n");

  return (
    <div
      data-testid="code-diff-accordion"
      className="bg-card/50 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-lg transition-all"
    >
      {/* Accordion Toggle Header */}
      <button
        type="button"
        data-testid="code-diff-toggle-button"
        aria-expanded={isOpen}
        aria-controls="post-mortem-code-diff-content"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">
                Post-Mortem Code Diff & Solution Breakdown
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-muted-foreground">
                {solutionDiff.language || "TypeScript"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare final round implementations, algorithmic efficiency, and runtime metrics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <Timer className="w-3.5 h-3.5" />
              {solutionDiff.p1ExecutionTimeMs ?? 42}ms
            </span>
            <span>vs</span>
            <span className="flex items-center gap-1 text-rose-400 font-semibold">
              {solutionDiff.p2ExecutionTimeMs ?? 168}ms
            </span>
          </div>

          <div className="p-1 rounded-lg border border-border bg-background/50 text-muted-foreground">
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </button>

      {/* Accordion Expandable Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id="post-mortem-code-diff-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="border-t border-border"
          >
            <div className="p-6 space-y-4">
              {/* Header Controls: View mode toggle & Metrics */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/50 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium">View Mode:</span>
                  <div className="inline-flex rounded-lg border border-border bg-background/60 p-0.5">
                    <button
                      type="button"
                      data-testid="view-mode-side-by-side"
                      onClick={() => setViewMode("side-by-side")}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                        viewMode === "side-by-side"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Side-by-Side
                    </button>
                    <button
                      type="button"
                      data-testid="view-mode-unified"
                      onClick={() => setViewMode("unified")}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                        viewMode === "unified"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Unified
                    </button>
                  </div>
                </div>

                {/* Performance Delta Badges */}
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-xs">
                    <Timer className="w-3.5 h-3.5" />
                    <span>
                      {player1.name}: O(N) Hash Map (4x Faster)
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium text-xs">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>
                      {player2.name}: O(N²) Nested Loops
                    </span>
                  </div>
                </div>
              </div>

              {/* Diff Code View */}
              {viewMode === "side-by-side" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Player 1 Code Box */}
                  <div className="rounded-xl border border-emerald-500/30 bg-[#0B0F19] overflow-hidden">
                    <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5" /> {player1.name} (Winner)
                      </span>
                      <span className="font-mono text-[11px] text-emerald-300">
                        {solutionDiff.p1ExecutionTimeMs ?? 42}ms • {solutionDiff.p1MemoryKb ?? 4020} KB
                      </span>
                    </div>
                    <pre className="p-4 text-xs font-mono overflow-x-auto text-emerald-100/90 leading-relaxed">
                      <code>
                        {p1CodeLines.map((line, idx) => (
                          <div key={idx} className="flex">
                            <span className="w-8 select-none text-slate-600 text-right pr-3 font-mono">
                              {idx + 1}
                            </span>
                            <span className="flex-1">{line}</span>
                          </div>
                        ))}
                      </code>
                    </pre>
                  </div>

                  {/* Player 2 Code Box */}
                  <div className="rounded-xl border border-border bg-[#0B0F19] overflow-hidden">
                    <div className="px-4 py-2 bg-white/5 border-b border-border flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5" /> {player2.name}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {solutionDiff.p2ExecutionTimeMs ?? 168}ms • {solutionDiff.p2MemoryKb ?? 4180} KB
                      </span>
                    </div>
                    <pre className="p-4 text-xs font-mono overflow-x-auto text-slate-300 leading-relaxed">
                      <code>
                        {p2CodeLines.map((line, idx) => (
                          <div key={idx} className="flex">
                            <span className="w-8 select-none text-slate-600 text-right pr-3 font-mono">
                              {idx + 1}
                            </span>
                            <span className="flex-1">{line}</span>
                          </div>
                        ))}
                      </code>
                    </pre>
                  </div>
                </div>
              ) : (
                /* Unified Diff Mode */
                <div className="rounded-xl border border-border bg-[#0B0F19] overflow-hidden">
                  <div className="px-4 py-2 bg-white/5 border-b border-border flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <span>--- {player2.name} solution (O(N²))</span>
                    <span>+++ {player1.name} solution (O(N))</span>
                  </div>
                  <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                    <code>
                      {p1CodeLines.map((line, idx) => {
                        const isDiff = idx >= 1 && idx <= 8;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "flex px-2 py-0.5 rounded",
                              isDiff
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "text-slate-300"
                            )}
                          >
                            <span className="w-8 select-none text-slate-600 text-right pr-3 font-mono">
                              {idx + 1}
                            </span>
                            <span className="w-4 select-none font-bold">
                              {isDiff ? "+" : " "}
                            </span>
                            <span className="flex-1">{line}</span>
                          </div>
                        );
                      })}
                    </code>
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BattleReport({
  player1,
  player2,
  battleType,
  onRematch,
  isMuted: initialIsMuted = false,
  onToggleMute,
  selectedBot = null,
  solutionDiff,
}: BattleReportProps) {
  const [internalMuted, setInternalMuted] = useState(initialIsMuted);
  const [copied, setCopied] = useState(false);
  const reportHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    reportHeadingRef.current?.focus();
  }, []);

  // Sync mute state if parent passes it
  useEffect(() => {
    setInternalMuted(initialIsMuted);
  }, [initialIsMuted]);

  // Score calculation for final report
  const calculateScore = (stats: any) =>
    (stats.totalCommits || 0) * 1 +
    (stats.totalPRs || 0) * 5 +
    (stats.totalStars || 0) * 10 +
    (stats.followers || 0) * 2 +
    (stats.streak || 0) * 5;

  const p1Score = calculateScore(player1.stats);
  const p2Score = calculateScore(player2.stats);

  const p1Wins = p1Score >= p2Score;
  const winner = p1Wins ? player1 : player2;
  const loser = p1Wins ? player2 : player1;
  const winnerScore = Math.max(p1Score, p2Score);
  const loserScore = Math.min(p1Score, p2Score);
  const scoreDiff = winnerScore - loserScore;
  const totalPoints = winnerScore + loserScore;
  const winPercent = totalPoints > 0 ? ((winnerScore / totalPoints) * 100).toFixed(1) : "50.0";

  // Trigger celebration on mount
  useEffect(() => {
    // 1. Dual-cannon confetti
    triggerDualCannonConfetti();

    // 2. Victory sound effect
    playVictorySound(internalMuted);
  }, []);

  const handleToggleMute = () => {
    if (onToggleMute) {
      onToggleMute();
    } else {
      setInternalMuted((prev) => !prev);
    }
  };

  const handleCelebrateAgain = () => {
    triggerDualCannonConfetti();
    playVictorySound(internalMuted);
    toast.success("Celebration unleashed! 🎉", {
      description: `Victory to ${winner.name}!`,
    });
  };

  const handleShare = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const p1User = player1.username || player1.name;
    const p2User = player2.username || player2.name;
    const winnerUser = winner.username || winner.name;
    const shareUrl = `${origin}/battles?p1=${encodeURIComponent(p1User)}&p2=${encodeURIComponent(p2User)}&winner=${encodeURIComponent(winnerUser)}`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2500);

      toast.success("Battle result copied to clipboard!", {
        description: `${player1.name} vs ${player2.name} — Winner: ${winner.name} (+${scoreDiff} pts)`,
      });
    } catch {
      toast.error("Failed to copy URL to clipboard.");
    }
  };

  // Filter helpers
  const isOverall = battleType === "Overall Battle" || battleType === "AI Battle";
  const isRepo = battleType === "Repository Battle" || battleType === "Open Source Impact";
  const isActivity = battleType === "Activity Battle";
  const isLanguage = battleType === "Language Battle";

  // Dynamic Advantage & AI Analysis
  let biggestAdvantage = "Consistency";
  if (winner.stats.totalStars > loser.stats.totalStars && winner.stats.totalStars - loser.stats.totalStars > 100) {
    biggestAdvantage = "Open Source Impact";
  } else if (winner.stats.totalPRs > loser.stats.totalPRs && winner.stats.totalPRs - loser.stats.totalPRs > 20) {
    biggestAdvantage = "Collaboration";
  } else if (winner.stats.totalCommits > loser.stats.totalCommits) {
    biggestAdvantage = "Raw Output";
  }

  const aiAnalysis = `Developer ${winner.name} secured the victory primarily due to their superior ${biggestAdvantage.toLowerCase()}. While ${loser.name} put up a strong fight, ${winner.name}'s impressive metrics generated a solid ${scoreDiff} point advantage that was insurmountable.`;

  // Dynamic Tags
  const earnedTags = [];
  if (winner.stats.totalStars > 500) earnedTags.push("⭐ Open Source King");
  if (winner.stats.streak > 7) earnedTags.push("⚡ Consistency Champion");
  if (winner.stats.totalCommits > 1000) earnedTags.push("💻 Code Machine");
  if (earnedTags.length === 0) earnedTags.push("🚀 Rising Developer");

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-1000">
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="breakdown">View Round Breakdown</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="space-y-8 pt-4">
          {/* 4. Final Battle Result (Top Card) */}
          <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-amber-500 to-destructive" />

            {/* Header Controls: Status Badge + Sound Toggle + Replay */}
            <div className="flex items-center justify-between mb-8">
              <h2
                ref={reportHeadingRef}
                tabIndex={-1}
                aria-describedby="battle-result-announcement"
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Trophy className="w-4 h-4 text-amber-400" /> Battle Completed
              </h2>
              <div id="battle-result-announcement" role="status" aria-live="polite" className="sr-only">
                {winner.name} won against {loser.name}, {winnerScore} to {loserScore}.
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleMute}
                  aria-pressed={internalMuted}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background/60 hover:bg-accent text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={internalMuted ? "Unmute sound effects" : "Mute sound effects"}
                  aria-label={internalMuted ? "Unmute sound effects" : "Mute sound effects"}
                >
                  {internalMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Sound Muted</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-foreground">Sound On</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCelebrateAgain}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title="Trigger victory celebration again"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Celebrate</span>
                </button>
              </div>
            </div>

            {/* Player Comparison Card */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              {/* Player 1 */}
              <div className={cn("flex flex-col items-center flex-1 transition-all", !p1Wins && "opacity-60 grayscale")}>
                <div className="relative">
                  <img
                    src={player1.avatar}
                    alt={player1.name}
                    className={cn(
                      "w-32 h-32 rounded-2xl border-4 mb-4 object-cover transition-transform",
                      p1Wins ? "border-amber-400 shadow-xl shadow-amber-500/20 scale-105" : "border-border"
                    )}
                  />
                  {p1Wins && (
                    <div
                      className="absolute -top-4 -right-4 w-12 h-12 bg-amber-400 rounded-full flex items-center justify-center border-4 border-background shadow-xl text-black animate-bounce"
                      title="Winner Crown"
                    >
                      <Crown className="w-6 h-6 fill-current" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{player1.name}</h2>
                  {p1Wins && (
                    <span className="px-2.5 py-0.5 rounded-full bg-card text-[var(--status-success)] border border-[var(--status-success)] text-xs font-black">
                      WINNER
                    </span>
                  )}
                </div>

                <div className="text-4xl font-black text-primary mt-2">{p1Score}</div>
                <div className="text-xs text-muted-foreground mt-1">@{player1.username}</div>
              </div>

              {/* VS Divider */}
              <div className="flex flex-col items-center justify-center shrink-0">
                <div className="text-5xl font-black italic text-muted-foreground/30">VS</div>
                <div className="mt-4 text-center">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Score Difference</div>
                  <div className="text-xl font-bold text-foreground">+{scoreDiff} points</div>
                </div>
              </div>

              {/* Player 2 */}
              <div className={cn("flex flex-col items-center flex-1 transition-all", p1Wins && "opacity-60 grayscale")}>
                <div className="relative">
                  <img
                    src={player2.avatar}
                    alt={player2.name}
                    className={cn(
                      "w-32 h-32 rounded-2xl border-4 mb-4 object-cover transition-transform",
                      !p1Wins ? "border-amber-400 shadow-xl shadow-amber-500/20 scale-105" : "border-border"
                    )}
                  />
                  {!p1Wins && (
                    <div
                      className="absolute -top-4 -right-4 w-12 h-12 bg-amber-400 rounded-full flex items-center justify-center border-4 border-background shadow-xl text-black animate-bounce"
                      title="Winner Crown"
                    >
                      <Crown className="w-6 h-6 fill-current" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{player2.name}</h2>
                  {!p1Wins && (
                    <span className="px-2.5 py-0.5 rounded-full bg-card text-[var(--status-success)] border border-[var(--status-success)] text-xs font-black">
                      WINNER
                    </span>
                  )}
                </div>

                <div className="text-4xl font-black text-destructive mt-2">{p2Score}</div>
                <div className="text-xs text-muted-foreground mt-1">@{player2.username}</div>
              </div>
            </div>
          </div>

          {/* 5. Summary Cards */}
          {selectedBot && battleType === "AI Battle" && (
            <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-6 flex items-center gap-4 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-background flex items-center justify-center shadow-lg border border-border">
                <img src={player2.avatar} alt={selectedBot.name} className="w-full h-full object-cover rounded-2xl" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase tracking-wider ${selectedBot.color}`}>
                    {selectedBot.difficulty.charAt(0).toUpperCase() + selectedBot.difficulty.slice(1)} Bot
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-bold">
                    ×{selectedBot.xpMultiplier} XP
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground">AI Opponent Defeated</h3>
                <p className="text-sm text-muted-foreground">
                  You outsmarted {selectedBot.name}. Victory against a tougher opponent awards scaled XP.
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard icon={Trophy} label="Winner" value={winner.name} color="text-amber-400" />
            <SummaryCard icon={TrendingUp} label="Biggest Advantage" value={biggestAdvantage} color="text-[var(--status-success)]" />
            <SummaryCard
              icon={Activity}
              label="Most Active"
              value={p1Score > p2Score ? player1.name : player2.name}
              color="text-blue-400"
            />
            <SummaryCard icon={Brain} label="AI Confidence" value={`${winPercent}%`} color="text-purple-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 6. AI Battle Analysis */}
            <div className="md:col-span-2 bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold">AI Battle Analysis</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">{aiAnalysis}</p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-card border border-[var(--status-success)]">
                  <div className="text-xs font-semibold text-[var(--status-success)] uppercase tracking-wider mb-1">Key Strength</div>
                  <div className="font-medium text-foreground">{biggestAdvantage}</div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-[var(--status-danger)]">
                  <div className="text-xs font-semibold text-[var(--status-danger)] uppercase tracking-wider mb-1">Critical Weakness</div>
                  <div className="font-medium text-foreground">Community Engagement</div>
                </div>
              </div>
            </div>

            {/* 11. Achievement Tags */}
            <div className="bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold">Earned Titles</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {earnedTags.map((tag) => (
                  <span key={tag} className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 7. Head-to-Head Comparison */}
          <div className="bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-6 overflow-x-auto">
            <h3 className="text-lg font-bold mb-6">Head-to-Head Stats</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-sm">
                  <th className="pb-3 font-medium">Metric</th>
                  <th className="pb-3 font-medium text-right">{player1.name}</th>
                  <th className="pb-3 font-medium text-right">{player2.name}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isOverall && <CompareRow label="Followers" v1={player1.stats?.followers || 0} v2={player2.stats?.followers || 0} />}
                {(isOverall || isRepo) && (
                  <CompareRow label="Repositories" v1={player1.stats?.repos || 0} v2={player2.stats?.repos || 0} />
                )}
                {(isOverall || isActivity || isLanguage) && (
                  <CompareRow label="Commits" v1={player1.stats?.totalCommits || 0} v2={player2.stats?.totalCommits || 0} />
                )}
                {(isOverall || isActivity || isRepo) && (
                  <CompareRow label="Pull Requests" v1={player1.stats?.totalPRs || 0} v2={player2.stats?.totalPRs || 0} />
                )}
                {(isOverall || isActivity || isRepo) && (
                  <CompareRow label="Issues" v1={player1.stats?.totalIssues || 0} v2={player2.stats?.totalIssues || 0} />
                )}
                {(isOverall || isRepo) && (
                  <CompareRow label="Stars" v1={player1.stats?.totalStars || 0} v2={player2.stats?.totalStars || 0} />
                )}
                {(isOverall || isActivity) && (
                  <CompareRow label="Streak" v1={player1.stats?.streak || 0} v2={player2.stats?.streak || 0} />
                )}
                {(isOverall || isLanguage) && (
                  <CompareRow
                    label="Unique Languages"
                    v1={player1.topLanguages?.length || 0}
                    v2={player2.topLanguages?.length || 0}
                  />
                )}
              </tbody>
            </table>
          </div>

          {/* 8. Post-Mortem Code Diff Accordion */}
          <CodeDiffAccordion
            player1={player1}
            player2={player2}
            solutionDiff={solutionDiff}
          />

          {/* 13. Share & Rematch Action Controls */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 pb-8">
            <button
              onClick={handleShare}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Share Battle Result"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? "URL Copied!" : "Share Battle Result"}</span>
            </button>

            <button
              onClick={handleCelebrateAgain}
              className="px-5 py-3 rounded-xl bg-card border border-border hover:bg-accent font-medium flex items-center gap-2 transition-colors hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Re-run victory confetti and sound effects"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Celebrate Again</span>
            </button>

            <button
              onClick={onRematch}
              className="px-8 py-3 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Rematch
            </button>
          </div>
        </TabsContent>
        <TabsContent value="breakdown" className="pt-4">
          <BattleTimeline
            player1={player1}
            player2={player2}
            battleType={battleType}
            isMuted={internalMuted}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center">
      <Icon className={cn("w-6 h-6 mb-2", color)} />
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-1 text-foreground">{value}</div>
    </div>
  );
}

function CompareRow({ label, v1, v2 }: { label: string; v1: number; v2: number }) {
  const p1Wins = v1 >= v2;
  const p2Wins = v2 >= v1;
  return (
    <tr className="border-b border-border/50 hover:bg-white/5 transition-colors">
      <td className="py-3 text-muted-foreground">{label}</td>
      <td className={cn("py-3 text-right font-medium", p1Wins ? "text-primary" : "text-muted-foreground")}>{v1}</td>
      <td className={cn("py-3 text-right font-medium", p2Wins ? "text-destructive" : "text-muted-foreground")}>{v2}</td>
    </tr>
  );
}
