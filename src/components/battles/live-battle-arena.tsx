"use client";

import { useState, useEffect } from "react";
import { Swords, Clock, Zap, CheckCircle2, Shield, Flame, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LiveBattleArenaProps {
  roomId: string;
  currentUser: any;
  opponent: any;
  onMatchComplete?: (result: any) => void;
}

export function LiveBattleArena({ roomId, currentUser, opponent, onMatchComplete }: LiveBattleArenaProps) {
  const [phase, setPhase] = useState<"COUNTDOWN" | "ACTIVE" | "SCORING" | "RESULT">("COUNTDOWN");
  const [countdown, setCountdown] = useState(3);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [round, setRound] = useState(1);
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const trivia = [
    {
      q: "Which GitHub event trigger fires when a pull request branch receives a new commit push?",
      options: ["pull_request_target", "pull_request.synchronize", "push.branch", "workflow_dispatch"],
      answer: 1,
    },
    {
      q: "What is the Big-O worst-case time complexity of standard quicksort with naive pivoting?",
      options: ["O(n log n)", "O(n)", "O(n²)", "O(log n)"],
      answer: 2,
    },
    {
      q: "In PostgreSQL, which index type is ideal for full-text search tsvector queries?",
      options: ["B-Tree", "GIN", "BRIN", "Hash"],
      answer: 1,
    },
  ];

  useEffect(() => {
    if (phase === "COUNTDOWN") {
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            setPhase("ACTIVE");
            setTimeRemaining(15);
            return 3;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }

    if (phase === "ACTIVE") {
      const timer = setInterval(() => {
        setTimeRemaining((t) => {
          if (t <= 1) {
            clearInterval(timer);
            // Auto finish round
            setP2Score((s) => s + 75);
            if (round < 3) {
              setRound((r) => r + 1);
              setSelectedOption(null);
              setPhase("COUNTDOWN");
            } else {
              setPhase("RESULT");
            }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase, round]);

  const handleSelect = (idx: number) => {
    if (selectedOption !== null || phase !== "ACTIVE") return;
    setSelectedOption(idx);
    const correct = idx === trivia[round - 1].answer;
    if (correct) {
      setP1Score((s) => s + Math.max(100, timeRemaining * 10));
    }
  };

  const currentTrivia = trivia[round - 1] || trivia[0];

  return (
    <div className="relative rounded-3xl border border-white/10 bg-slate-950/90 backdrop-blur-2xl p-6 sm:p-10 shadow-2xl max-w-4xl mx-auto overflow-hidden">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center font-bold text-cyan-400">
            {currentUser?.username?.[0]?.toUpperCase() || "Y"}
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">@{currentUser?.username || "You"}</h4>
            <div className="font-mono text-cyan-400 font-bold text-base">{p1Score} PTS</div>
          </div>
        </div>

        {/* Center Round / Timer */}
        <div className="flex flex-col items-center">
          <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">Round {round} of 3</span>
          <div className="flex items-center gap-1.5 text-2xl font-mono font-black text-amber-400 mt-1">
            <Clock className="w-5 h-5 animate-pulse" />
            <span>00:{Math.max(0, timeRemaining).toString().padStart(2, "0")}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-row-reverse text-right">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center font-bold text-rose-400">
            {opponent?.username?.[0]?.toUpperCase() || "O"}
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">@{opponent?.username || "Opponent"}</h4>
            <div className="font-mono text-rose-400 font-bold text-base">{p2Score} PTS</div>
          </div>
        </div>
      </div>

      {phase === "COUNTDOWN" && (
        <div className="py-16 flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-300">
          <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Round {round} Starting in</span>
          <div className="text-7xl font-black font-mono text-cyan-400 animate-pulse">{countdown}</div>
        </div>
      )}

      {phase === "ACTIVE" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed">{currentTrivia.q}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {currentTrivia.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  className={cn(
                    "p-4 rounded-xl border text-left text-sm font-semibold transition-all duration-200",
                    isSelected
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                      : "bg-white/[0.02] border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/[0.05]"
                  )}
                >
                  <span className="font-mono text-xs text-slate-500 mr-2">[{idx + 1}]</span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === "RESULT" && (
        <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
          <Trophy className="w-16 h-16 text-amber-400 animate-bounce" />
          <h2 className="text-3xl font-black text-white">
            {p1Score >= p2Score ? "Victory Achieved!" : "Defeated in Battle!"}
          </h2>
          <p className="text-slate-400 text-sm">
            Final Score: <span className="text-cyan-400 font-bold">{p1Score}</span> vs{" "}
            <span className="text-rose-400 font-bold">{p2Score}</span> (+45 ELO)
          </p>
        </div>
      )}
    </div>
  );
}
