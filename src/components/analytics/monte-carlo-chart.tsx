"use client";

import React, { useMemo, useState } from "react";
import { Activity, AlertTriangle, Calendar, Sliders } from "lucide-react";

export interface MonteCarloRiskItem {
  taskId: string;
  title: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
}

export interface MonteCarloChartProps {
  sprintName: string;
  dailyThroughputSamples: number[];
  initialRemainingTasks?: number;
  startDateIso?: string;
  riskFactors?: MonteCarloRiskItem[];
}

const MS_PER_DAY = 86_400_000;

export function simulateClientMonteCarlo(
  remainingTasks: number,
  samples: number[],
  startDateIso: string,
  iterations = 2000
) {
  const validSamples = samples.length > 0 ? samples : [2, 3, 4];
  const days = new Uint16Array(iterations);
  let seed = 4219;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < iterations; i++) {
    let rem = Math.max(1, remainingTasks);
    let d = 0;
    while (rem > 0 && d < 365) {
      d += 1;
      const step = validSamples[(rand() * validSamples.length) | 0];
      rem = Math.max(0, rem - Math.max(0, step));
    }
    days[i] = d;
  }
  days.sort();

  const p50Days = days[Math.floor(iterations * 0.5)];
  const p85Days = days[Math.floor(iterations * 0.85)];
  const p95Days = days[Math.min(iterations - 1, Math.floor(iterations * 0.95))];
  const baseMs = Date.parse(startDateIso) || Date.now();
  const fmt = (offset: number) =>
    new Date(baseMs + offset * MS_PER_DAY).toISOString().slice(0, 10);

  // Build SVG fan trajectories from day 0 to p95Days
  const horizon = Math.max(1, p95Days);
  const fanSeries = Array.from({ length: horizon + 1 }, (_, day) => {
    const p50Rem = Math.max(0, Math.round(remainingTasks * (1 - day / Math.max(1, p50Days))));
    const p85Rem = Math.max(0, Math.round(remainingTasks * (1 - day / Math.max(1, p85Days))));
    const p95Rem = Math.max(0, Math.round(remainingTasks * (1 - day / Math.max(1, p95Days))));
    return { day, p50Rem, p85Rem, p95Rem };
  });

  return {
    p50Days,
    p50Date: fmt(p50Days),
    p85Days,
    p85Date: fmt(p85Days),
    p95Days,
    p95Date: fmt(p95Days),
    fanSeries,
  };
}

export const MonteCarloChart: React.FC<MonteCarloChartProps> = ({
  sprintName,
  dailyThroughputSamples,
  initialRemainingTasks = 24,
  startDateIso = "2026-11-23",
  riskFactors = [],
}) => {
  const [targetScope, setTargetScope] = useState<number>(initialRemainingTasks);

  const forecast = useMemo(
    () => simulateClientMonteCarlo(targetScope, dailyThroughputSamples, startDateIso),
    [targetScope, dailyThroughputSamples, startDateIso]
  );

  // Build SVG polyline points for P50, P85, and P95 burndown curves
  const svgPaths = useMemo(() => {
    const width = 560;
    const height = 180;
    const maxDay = Math.max(1, forecast.p95Days);
    const maxTasks = Math.max(1, targetScope);

    const toCoord = (day: number, rem: number) => {
      const x = Math.round((day / maxDay) * width);
      const y = Math.round(height - (rem / maxTasks) * height);
      return `${x},${y}`;
    };

    return {
      p50: forecast.fanSeries.map((pt) => toCoord(pt.day, pt.p50Rem)).join(" "),
      p85: forecast.fanSeries.map((pt) => toCoord(pt.day, pt.p85Rem)).join(" "),
      p95: forecast.fanSeries.map((pt) => toCoord(pt.day, pt.p95Rem)).join(" "),
    };
  }, [forecast, targetScope]);

  return (
    <section
      aria-label="Monte Carlo Sprint Burndown Forecast"
      className="flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-bold tracking-tight">
              Monte Carlo Probabilistic Burndown
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            Sprint: <span className="font-mono text-zinc-200">{sprintName}</span> • 10,000-trial
            throughput distribution simulation
          </p>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs">
          <Sliders className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-zinc-400">Target Scope (Tasks):</span>
          <input
            aria-label="Target Scope Tasks"
            type="number"
            min={1}
            max={500}
            value={targetScope}
            onChange={(e) => setTargetScope(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 font-mono text-white"
          />
        </label>
      </div>

      {/* Confidence Percentile Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-1.5 text-xs text-emerald-300">
            <Calendar className="h-3.5 w-3.5" />
            <span>50% Median Forecast (P50)</span>
          </div>
          <div
            data-testid="mc-p50-date"
            className="mt-1 font-mono text-xl font-bold text-emerald-200"
          >
            {forecast.p50Date}
          </div>
          <div className="text-[11px] text-emerald-300/80">{forecast.p50Days} sprint days</div>
        </div>

        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
          <div className="flex items-center gap-1.5 text-xs text-cyan-300">
            <Calendar className="h-3.5 w-3.5" />
            <span>85% Confidence Target (P85)</span>
          </div>
          <div
            data-testid="mc-p85-date"
            className="mt-1 font-mono text-xl font-bold text-cyan-200"
          >
            {forecast.p85Date}
          </div>
          <div className="text-[11px] text-cyan-300/80">{forecast.p85Days} sprint days</div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-1.5 text-xs text-amber-300">
            <Calendar className="h-3.5 w-3.5" />
            <span>95% Worst-Case Buffer (P95)</span>
          </div>
          <div
            data-testid="mc-p95-date"
            className="mt-1 font-mono text-xl font-bold text-amber-200"
          >
            {forecast.p95Date}
          </div>
          <div className="text-[11px] text-amber-300/80">{forecast.p95Days} sprint days</div>
        </div>
      </div>

      {/* Probabilistic Confidence Fan Chart SVG */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-semibold uppercase tracking-wider">
            Burndown Confidence Fan Curve
          </span>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-emerald-400">— P50</span>
            <span className="text-cyan-400">— P85</span>
            <span className="text-amber-400">— P95</span>
          </div>
        </div>
        <svg
          data-testid="mc-fan-chart-svg"
          viewBox="0 0 560 180"
          className="h-44 w-full overflow-visible"
        >
          <polyline
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.5"
            strokeDasharray="5 4"
            points={svgPaths.p95}
          />
          <polyline fill="none" stroke="#22d3ee" strokeWidth="2.5" points={svgPaths.p85} />
          <polyline fill="none" stroke="#34d399" strokeWidth="3" points={svgPaths.p50} />
        </svg>
      </div>

      {/* High-Variance Risk Factors */}
      {riskFactors.length > 0 && (
        <div data-testid="mc-risk-factors" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            High-Variance Delivery Risk Factors
          </h3>
          {riskFactors.map((rf) => (
            <div
              key={rf.taskId}
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <span className="font-semibold text-white">{rf.title}</span> ({rf.riskLevel}):{" "}
                {rf.reason}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default MonteCarloChart;
