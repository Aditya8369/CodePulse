"use client";

import React, { useState } from "react";
import { DollarSign, Moon, ServerOff, ShieldCheck, Sparkles } from "lucide-react";

export interface ProviderSpendItem {
  provider: "AWS" | "GCP" | "Render";
  monthlySpendUsd: number;
  monthlyReapedSavingsUsd: number;
  idleResourcesReaped: number;
}

const INITIAL_PROVIDERS: ProviderSpendItem[] = [
  { provider: "AWS", monthlySpendUsd: 1420, monthlyReapedSavingsUsd: 540, idleResourcesReaped: 9 },
  { provider: "GCP", monthlySpendUsd: 860, monthlyReapedSavingsUsd: 310, idleResourcesReaped: 5 },
  { provider: "Render", monthlySpendUsd: 490, monthlyReapedSavingsUsd: 195, idleResourcesReaped: 6 },
];

export default function AdminFinOpsDashboardPage() {
  const [overnightSleepEnabled, setOvernightSleepEnabled] = useState(true);
  const [reaperRunCount, setReaperRunCount] = useState(14);

  const totalMonthlySavings = INITIAL_PROVIDERS.reduce(
    (acc, p) => acc + p.monthlyReapedSavingsUsd,
    0,
  );
  const totalDailySavings = Number((totalMonthlySavings / 30).toFixed(2));
  const totalAnnualSavings = Number((totalDailySavings * 365).toFixed(0));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Multi-Cloud FinOps & Idle Resource Reaper
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              environment=production Protected
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Automated AWS, GCP & Render runner pod, volume, and staging sleep enforcement
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="toggle-overnight-sleep"
            onClick={() => setOvernightSleepEnabled((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              overnightSleepEnabled
                ? "border-indigo-500/40 bg-indigo-600/20 text-indigo-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-400"
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            10 PM – 7 AM Sleep: {overnightSleepEnabled ? "ACTIVE" : "PAUSED"}
          </button>

          <button
            type="button"
            data-testid="run-reaper-audit"
            onClick={() => setReaperRunCount((c) => c + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            <ServerOff className="h-3.5 w-3.5" />
            Trigger Reaper Audit ({reaperRunCount})
          </button>
        </div>
      </header>

      {/* Daily / Monthly / Annual Savings Summary */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <span>Estimated Daily Savings</span>
          </div>
          <div data-testid="finops-daily-savings" className="mt-2 font-mono text-2xl font-bold text-emerald-300">
            ${totalDailySavings.toFixed(2)} / day
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>Estimated Monthly Savings</span>
          </div>
          <div data-testid="finops-monthly-savings" className="mt-2 font-mono text-2xl font-bold text-cyan-300">
            ${totalMonthlySavings.toLocaleString()} / mo
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <DollarSign className="h-4 w-4 text-indigo-400" />
            <span>Projected Annual Savings</span>
          </div>
          <div data-testid="finops-annual-savings" className="mt-2 font-mono text-2xl font-bold text-indigo-300">
            ${totalAnnualSavings.toLocaleString()} / yr
          </div>
        </div>
      </section>

      {/* Provider Spend Breakdown */}
      <section className="grid gap-4 md:grid-cols-3">
        {INITIAL_PROVIDERS.map((item) => (
          <div
            key={item.provider}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-white">{item.provider}</span>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                -{Math.round((item.monthlyReapedSavingsUsd / item.monthlySpendUsd) * 100)}% waste
              </span>
            </div>
            <div className="mt-3 text-xs text-zinc-400">
              Baseline Spend: <span className="font-mono text-zinc-200">${item.monthlySpendUsd}/mo</span>
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              Reaped Savings: <span className="font-mono text-emerald-300">${item.monthlyReapedSavingsUsd}/mo</span>
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              Idle Assets Reaped: <span className="font-mono text-cyan-300">{item.idleResourcesReaped}</span>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
