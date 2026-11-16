"use client";

import { motion, useReducedMotion } from "motion/react";
import { Activity, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ProductivityResult } from "@/lib/productivity-calculator";

interface ProductivityGaugeProps {
  result: ProductivityResult;
}

const radius = 72;
const circumference = 2 * Math.PI * radius;

export function ProductivityGauge({ result }: ProductivityGaugeProps) {
  const reducedMotion = useReducedMotion();
  const change = result.delta > 0 ? "up" : result.delta < 0 ? "down" : "flat";
  const DeltaIcon = change === "up" ? ArrowUpRight : change === "down" ? ArrowDownRight : Minus;
  const deltaColor = change === "up" ? "text-emerald-300" : change === "down" ? "text-amber-300" : "text-slate-300";

  return (
    <section className="glass-card h-full rounded-[32px] border border-white/5 p-6 sm:p-8" aria-label="Productivity score">
      <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-300">
        <Activity className="h-4 w-4 text-violet-400" aria-hidden="true" />
        Productivity Score
      </div>

      <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-center lg:gap-10">
        <div className="relative aspect-square w-48 shrink-0" role="img" aria-label={`Productivity score ${result.score} out of 100, ${result.tier}`}>
          <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90" aria-hidden="true">
            <defs>
              <linearGradient id="productivity-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
            <motion.circle
              cx="90" cy="90" r={radius} fill="none" stroke="url(#productivity-gradient)" strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={reducedMotion ? false : { strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * (1 - result.score / 100) }}
              transition={{ duration: reducedMotion ? 0 : 1.2, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black tabular-nums text-white">{result.score}</span>
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">out of 100</span>
          </div>
        </div>

        <div className="w-full min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-sm font-semibold text-violet-200">
              {result.tier}
            </span>
            <span className={`inline-flex items-center gap-1 text-sm font-semibold ${deltaColor}`}>
              <DeltaIcon className="h-4 w-4" aria-hidden="true" />
              {result.delta > 0 ? "+" : ""}{result.delta} points vs last week
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-400">
            {result.hasRecentData
              ? "Based on your recent commits, pull requests, streak, battles, and languages."
              : "No recent activity yet. Your score will grow as your activity is recorded."}
          </p>

          <h4 className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Ways to improve</h4>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            {result.tips.map((tip) => <li key={tip} className="flex gap-2"><span className="text-cyan-400" aria-hidden="true">•</span>{tip}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
