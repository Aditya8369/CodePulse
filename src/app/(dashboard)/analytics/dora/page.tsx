"use client";

import React, { useState } from "react";
import {
  Rocket,
  Clock,
  RotateCcw,
  AlertOctagon,
  Award,
  CheckCircle2,
} from "lucide-react";

export type DoraWindowOption = "30d" | "90d" | "1y";

export interface DoraWindowSnapshot {
  windowLabel: string;
  tier: "Elite" | "High" | "Medium" | "Low";
  deploymentFrequencyPerDay: number;
  leadTimeHours: number;
  mttrHours: number;
  changeFailureRatePercent: number;
  tips: string[];
  trendBars: Array<{ period: string; df: number; leadHours: number }>;
}

const DORA_SNAPSHOTS: Record<DoraWindowOption, DoraWindowSnapshot> = {
  "30d": {
    windowLabel: "Last 30 Days",
    tier: "Elite",
    deploymentFrequencyPerDay: 2.4,
    leadTimeHours: 6.2,
    mttrHours: 0.45,
    changeFailureRatePercent: 4.2,
    tips: [
      "Maintain automated canary rollouts and progressive feature flags to sustain Elite DORA velocity.",
    ],
    trendBars: [
      { period: "W1", df: 1.9, leadHours: 8.1 },
      { period: "W2", df: 2.2, leadHours: 7.0 },
      { period: "W3", df: 2.6, leadHours: 5.5 },
      { period: "W4", df: 2.9, leadHours: 4.2 },
    ],
  },
  "90d": {
    windowLabel: "Last 90 Days",
    tier: "High",
    deploymentFrequencyPerDay: 1.5,
    leadTimeHours: 14.8,
    mttrHours: 1.35,
    changeFailureRatePercent: 8.9,
    tips: [
      "Enable automated canary rollbacks on health-check regressions to push MTTR below 1 hour.",
    ],
    trendBars: [
      { period: "M1", df: 1.1, leadHours: 19.2 },
      { period: "M2", df: 1.5, leadHours: 14.1 },
      { period: "M3", df: 1.9, leadHours: 11.0 },
    ],
  },
  "1y": {
    windowLabel: "Last 1 Year",
    tier: "High",
    deploymentFrequencyPerDay: 0.95,
    leadTimeHours: 22.4,
    mttrHours: 2.1,
    changeFailureRatePercent: 11.4,
    tips: [
      "Break PRs into smaller trunk-based increments (< 200 LOC) to ship daily across all squads.",
      "Enable automated canary rollbacks on health-check regressions to push MTTR below 1 hour.",
    ],
    trendBars: [
      { period: "Q1", df: 0.5, leadHours: 34.0 },
      { period: "Q2", df: 0.8, leadHours: 24.5 },
      { period: "Q3", df: 1.1, leadHours: 18.2 },
      { period: "Q4", df: 1.4, leadHours: 12.9 },
    ],
  },
};

export default function DoraMetricsDashboardPage() {
  const [selectedWindow, setSelectedWindow] = useState<DoraWindowOption>("30d");
  const current = DORA_SNAPSHOTS[selectedWindow];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">
              Executive DORA Metrics Pipeline
            </h1>
            <span
              data-testid="dora-tier-badge"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-0.5 font-mono text-xs font-bold text-emerald-300"
            >
              <Award className="h-3.5 w-3.5" />
              {current.tier} Performer
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Automated GitHub webhook telemetry • {current.windowLabel}
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          {(["30d", "90d", "1y"] as DoraWindowOption[]).map((win) => (
            <button
              key={win}
              type="button"
              onClick={() => setSelectedWindow(win)}
              className={`rounded-lg px-3 py-1.5 font-mono text-xs font-semibold uppercase transition ${
                selectedWindow === win
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {win}
            </button>
          ))}
        </div>
      </header>

      {/* 4 Core DORA Metric Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Rocket className="h-4 w-4 text-cyan-400" />
            <span>Deployment Frequency</span>
          </div>
          <div
            data-testid="dora-df-value"
            className="mt-2 font-mono text-2xl font-bold text-cyan-300"
          >
            {current.deploymentFrequencyPerDay.toFixed(2)} / day
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Production releases & deploys</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Clock className="h-4 w-4 text-indigo-400" />
            <span>Lead Time for Changes</span>
          </div>
          <div
            data-testid="dora-ltfc-value"
            className="mt-2 font-mono text-2xl font-bold text-indigo-300"
          >
            {current.leadTimeHours.toFixed(1)} hrs
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Commit creation to prod deploy</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <RotateCcw className="h-4 w-4 text-emerald-400" />
            <span>Mean Time to Recovery</span>
          </div>
          <div
            data-testid="dora-mttr-value"
            className="mt-2 font-mono text-2xl font-bold text-emerald-300"
          >
            {current.mttrHours.toFixed(2)} hrs
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Incident/rollback to green deploy</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <AlertOctagon className="h-4 w-4 text-amber-400" />
            <span>Change Failure Rate</span>
          </div>
          <div
            data-testid="dora-cfr-value"
            className="mt-2 font-mono text-2xl font-bold text-amber-300"
          >
            {current.changeFailureRatePercent.toFixed(1)}%
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Correlated rollback & incident ratio</p>
        </div>
      </section>

      {/* Historical Trend Comparison */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Historical Velocity & Lead Time Trend ({current.windowLabel})
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {current.trendBars.map((bar) => (
            <div
              key={bar.period}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5"
            >
              <div className="font-mono text-xs font-bold text-zinc-300">{bar.period}</div>
              <div className="mt-1 font-mono text-sm text-cyan-300">{bar.df} deploys/day</div>
              <div className="font-mono text-xs text-zinc-400">{bar.leadHours}h lead time</div>
            </div>
          ))}
        </div>
      </section>

      {/* Actionable Recommendations */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Actionable Engineering Recommendations
        </h2>
        <ul className="flex flex-col gap-2 text-xs text-zinc-200">
          {current.tips.map((tip) => (
            <li key={tip} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
