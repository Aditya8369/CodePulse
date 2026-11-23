"use client";

import React, { useMemo, useState } from "react";
import { Leaf, Cpu, Zap, AlertTriangle, Globe } from "lucide-react";

export interface CarbonRegionOption {
  region: string;
  label: string;
  gCo2PerKwh: number;
}

export const CARBON_REGION_OPTIONS: CarbonRegionOption[] = [
  { region: "aws:eu-north-1", label: "Stockholm (eu-north-1 • 13g)", gCo2PerKwh: 13 },
  { region: "aws:us-west-2", label: "Oregon (us-west-2 • 98g)", gCo2PerKwh: 98 },
  { region: "aws:us-east-1", label: "N. Virginia (us-east-1 • 368g)", gCo2PerKwh: 368 },
  { region: "aws:ap-south-1", label: "Mumbai (ap-south-1 • 632g)", gCo2PerKwh: 632 },
];

export interface CarbonBadgeProps {
  repositoryName: string;
  cpuEnergyMj: number;
  dramEnergyMj: number;
  durationMs: number;
  baselineCo2Grams?: number;
  hasQuadraticHotspot?: boolean;
  defaultRegion?: string;
}

const MJOULES_PER_KWH = 3_600_000_000;
const PUE = 1.15;

export const CarbonBadge: React.FC<CarbonBadgeProps> = ({
  repositoryName,
  cpuEnergyMj,
  dramEnergyMj,
  durationMs,
  baselineCo2Grams = 0.00045,
  hasQuadraticHotspot = false,
  defaultRegion = "aws:eu-north-1",
}) => {
  const [selectedRegion, setSelectedRegion] = useState<string>(defaultRegion);

  const metrics = useMemo(() => {
    const regionObj =
      CARBON_REGION_OPTIONS.find((r) => r.region === selectedRegion) ??
      CARBON_REGION_OPTIONS[0];
    const totalEnergyMj = cpuEnergyMj + dramEnergyMj;
    const totalKwh = (totalEnergyMj * PUE) / MJOULES_PER_KWH;
    const estimatedCo2Grams = totalKwh * regionObj.gCo2PerKwh;
    const savedGrams = Math.max(0, baselineCo2Grams - estimatedCo2Grams);
    const savingsPercent =
      baselineCo2Grams > 0
        ? Math.max(0, ((baselineCo2Grams - estimatedCo2Grams) / baselineCo2Grams) * 100)
        : 0;

    const isGreenCertified = !hasQuadraticHotspot && totalEnergyMj <= 2_500;
    const badgeTier = !isGreenCertified
      ? "Standard Profile"
      : totalEnergyMj <= 250
        ? "Platinum Leaf"
        : totalEnergyMj <= 900
          ? "Emerald Optimizer"
          : "Solar Efficient";

    return {
      regionObj,
      totalEnergyMj,
      estimatedCo2Grams,
      savedGrams,
      savingsPercent,
      isGreenCertified,
      badgeTier,
    };
  }, [baselineCo2Grams, cpuEnergyMj, dramEnergyMj, hasQuadraticHotspot, selectedRegion]);

  return (
    <div
      data-testid="green-carbon-badge-card"
      className="flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-zinc-950 p-5 text-zinc-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Green Software Telemetry</span>
              <span
                data-testid="green-code-tier-pill"
                className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                  metrics.isGreenCertified
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                }`}
              >
                {metrics.badgeTier}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {repositoryName} • {durationMs}ms RAPL execution window
            </p>
          </div>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Globe className="h-3.5 w-3.5 text-emerald-400" />
          <select
            aria-label="Cloud Carbon Region"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200"
          >
            {CARBON_REGION_OPTIONS.map((opt) => (
              <option key={opt.region} value={opt.region}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            <span>CPU + DRAM Energy</span>
          </div>
          <div
            data-testid="carbon-total-mj"
            className="mt-1 font-mono text-lg font-bold text-cyan-300"
          >
            {metrics.totalEnergyMj.toFixed(1)} mJ
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>Est. Carbon Footprint</span>
          </div>
          <div
            data-testid="carbon-co2-grams"
            className="mt-1 font-mono text-lg font-bold text-amber-300"
          >
            {(metrics.estimatedCo2Grams * 1000).toFixed(3)} mgCO₂e
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-1 text-[11px] text-emerald-300">
            <Leaf className="h-3.5 w-3.5" />
            <span>CO₂ Savings</span>
          </div>
          <div
            data-testid="carbon-savings-percent"
            className="mt-1 font-mono text-lg font-bold text-emerald-300"
          >
            -{metrics.savingsPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {hasQuadraticHotspot && (
        <div
          data-testid="carbon-quadratic-warning"
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            Nested O(N²) loop detected: refactoring to O(N) hash lookup reduces CPU Joules by ~85%.
          </span>
        </div>
      )}
    </div>
  );
};

export default CarbonBadge;
