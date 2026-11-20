"use client";

import { Sparkles, CheckCircle2, AlertCircle, ShieldCheck, HeartHandshake, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiPrInsightsCard() {
  const analysis = {
    qualityScore: 94,
    sentiment: "Encouraging",
    conventionalScore: 100,
    strengths: [
      "Clean Conventional Commit structure",
      "Explicit TypeScript error boundary handling",
      "High modular separation between controller and service",
    ],
    tips: [
      "Consider extracting shared DTO interfaces into common schemas",
      "Include latency benchmarks in PR descriptions",
    ],
  };

  return (
    <div className="relative rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">AI Pull Request Review Assistant</h3>
            <p className="text-xs text-slate-400">Automated sentiment, test coverage, and code hygiene evaluation</p>
          </div>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Grade A+
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-xs text-slate-400 uppercase font-semibold">Quality Index</span>
          <div className="text-2xl font-black text-cyan-400">{analysis.qualityScore} / 100</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-xs text-slate-400 uppercase font-semibold">Review Sentiment</span>
          <div className="text-2xl font-black text-purple-400">{analysis.sentiment}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-xs text-slate-400 uppercase font-semibold">Commit Clarity</span>
          <div className="text-2xl font-black text-emerald-400">{analysis.conventionalScore}%</div>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Observed Strengths</span>
        <div className="space-y-1.5">
          {analysis.strengths.map((str, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{str}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
