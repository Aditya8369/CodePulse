"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  GitCommit,
  GitPullRequest,
  AlertCircle,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Activity,
  Rocket,
  Clock,
  RotateCcw,
  Sparkles,
  Layers,
  Compass,
} from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";

export interface DoraMetrics {
  deploymentFrequency?: {
    value: string;
    rating: "Elite" | "High" | "Medium" | "Low";
    description: string;
  };
  leadTimeForChanges?: {
    value: string;
    rating: "Elite" | "High" | "Medium" | "Low";
    description: string;
  };
  changeFailureRate?: {
    value: string;
    rating: "Elite" | "High" | "Medium" | "Low";
    description: string;
  };
  timeToRestoreService?: {
    value: string;
    rating: "Elite" | "High" | "Medium" | "Low";
    description: string;
  };
  overallTier?: "Elite" | "High" | "Medium" | "Low";
}

export interface RadarHealthScores {
  architecture: number;
  testing: number;
  security: number;
  velocity: number;
  documentation: number;
}

export interface RepositoryMetricsCardProps {
  repoName?: string;
  commitsCount: number;
  openIssuesCount: number;
  openPrsCount: number;
  languages: { name: string; percentage: number; color?: string }[];
  hygieneChecklist?: {
    hasReadme: boolean;
    hasLicense: boolean;
    hasCiCd: boolean;
    hasContributing: boolean;
  };
  doraMetrics?: DoraMetrics;
  radarScores?: RadarHealthScores;
  className?: string;
}

type CardTab = "overview" | "dora" | "radar";

export function RepositoryMetricsCard({
  repoName,
  commitsCount,
  openIssuesCount,
  openPrsCount,
  languages,
  hygieneChecklist = {
    hasReadme: true,
    hasLicense: true,
    hasCiCd: true,
    hasContributing: true,
  },
  doraMetrics = {
    deploymentFrequency: {
      value: "3.4 deploys/day",
      rating: "Elite",
      description: "Multiple production releases daily",
    },
    leadTimeForChanges: {
      value: "42 mins",
      rating: "Elite",
      description: "Commit to production delivery time",
    },
    changeFailureRate: {
      value: "2.1%",
      rating: "Elite",
      description: "< 5% change incident rate",
    },
    timeToRestoreService: {
      value: "18 mins",
      rating: "Elite",
      description: "Mean time to recover from production degradation",
    },
    overallTier: "Elite",
  },
  radarScores = {
    architecture: 88,
    testing: 92,
    security: 95,
    velocity: 85,
    documentation: 78,
  },
  className,
}: RepositoryMetricsCardProps) {
  const [activeTab, setActiveTab] = useState<CardTab>("overview");
  const prToIssueRatio = openIssuesCount > 0 ? (openPrsCount / openIssuesCount).toFixed(2) : "1.00";

  const getTierColor = (tier: "Elite" | "High" | "Medium" | "Low") => {
    switch (tier) {
      case "Elite":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      case "High":
        return "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";
      case "Medium":
        return "text-amber-400 bg-amber-500/10 border-amber-500/30";
      case "Low":
        return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    }
  };

  // Radar points computation
  const radarDimensions = useMemo(() => {
    return [
      { key: "architecture", label: "Architecture", score: radarScores.architecture },
      { key: "testing", label: "Test Coverage", score: radarScores.testing },
      { key: "security", label: "Security & Deps", score: radarScores.security },
      { key: "velocity", label: "PR Velocity", score: radarScores.velocity },
      { key: "documentation", label: "Docs & Hygiene", score: radarScores.documentation },
    ];
  }, [radarScores]);

  const radarPolygonPoints = useMemo(() => {
    const total = radarDimensions.length;
    const center = 100;
    const radius = 75;
    return radarDimensions
      .map((dim, i) => {
        const angle = (Math.PI * 2 / total) * i - Math.PI / 2;
        const normalized = (dim.score / 100) * radius;
        const x = center + normalized * Math.cos(angle);
        const y = center + normalized * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [radarDimensions]);

  const radarAxes = useMemo(() => {
    const total = radarDimensions.length;
    const center = 100;
    const radius = 75;
    return radarDimensions.map((dim, i) => {
      const angle = (Math.PI * 2 / total) * i - Math.PI / 2;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      const labelX = center + (radius + 18) * Math.cos(angle);
      const labelY = center + (radius + 18) * Math.sin(angle);
      return { ...dim, x, y, labelX, labelY };
    });
  }, [radarDimensions]);

  return (
    <div
      data-testid="repository-metrics-card"
      className={cn(
        "rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md shadow-xl space-y-6 transition-all",
        className
      )}
    >
      {/* Header with Title and Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 gap-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 min-w-0 max-w-[calc(100%-130px)]">
          <GitCommit className="h-5 w-5 text-indigo-400 shrink-0" />
          <span
            className="truncate inline-block"
            title={repoName || "Repository Metrics & Hygiene"}
            data-testid="repo-title"
          >
            {repoName ? `${repoName} - Metrics & Hygiene` : "Repository Metrics & Hygiene"}
          </span>
        </h3>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            data-testid="tab-overview-btn"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "overview"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Layers className="h-3 w-3" /> Overview
          </button>
          <button
            type="button"
            data-testid="tab-dora-btn"
            onClick={() => setActiveTab("dora")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "dora"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Activity className="h-3 w-3" /> DORA Metrics
          </button>
          <button
            type="button"
            data-testid="tab-radar-btn"
            onClick={() => setActiveTab("radar")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "radar"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Compass className="h-3 w-3" /> Tech Radar
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-6"
          >
            {/* Grid of Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Commits</div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {formatNumber(commitsCount)}
                </div>
                <div className="text-[11px] text-emerald-400 mt-1 flex items-center justify-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Active Velocity
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Issues vs PRs</div>
                <div className="text-2xl font-bold text-white tracking-tight flex items-center justify-center gap-1">
                  <span>{openIssuesCount}</span>
                  <span className="text-slate-500 text-sm font-normal">/</span>
                  <span className="text-indigo-400">{openPrsCount}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Ratio: {prToIssueRatio}</div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">PR Activity</div>
                <div className="text-2xl font-bold text-violet-400 tracking-tight">
                  {openPrsCount} Open
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-center gap-1">
                  <GitPullRequest className="h-3 w-3 text-violet-400" /> Open Requests
                </div>
              </div>
            </div>

            {/* Language Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <FileCode className="h-4 w-4 text-amber-400" />
                  Language Distribution
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white/5 overflow-hidden flex">
                {languages.map((lang, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: `${lang.percentage}%`,
                      backgroundColor: lang.color || "#6366f1",
                    }}
                    title={`${lang.name}: ${lang.percentage}%`}
                    className="h-full transition-all duration-300 hover:opacity-80"
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                {languages.map((lang, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-300">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: lang.color || "#6366f1" }}
                    />
                    <span>{lang.name}</span>
                    <span className="text-slate-500">({lang.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Repository Hygiene Checklist */}
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-3">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Repository Health & Hygiene
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  {hygieneChecklist.hasReadme ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  )}
                  <span className="text-slate-300">README.md</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  {hygieneChecklist.hasLicense ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  )}
                  <span className="text-slate-300">License</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  {hygieneChecklist.hasCiCd ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  )}
                  <span className="text-slate-300">CI/CD Pipeline</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  {hygieneChecklist.hasContributing ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  )}
                  <span className="text-slate-300">Contributing</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "dora" && (
          <motion.div
            key="dora"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-4"
            data-testid="dora-metrics-section"
          >
            {/* DORA Tier Overview Header */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-semibold text-white">DevOps Research & Assessment (DORA) Tier</span>
              </div>
              <span
                data-testid="dora-overall-tier"
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider",
                  getTierColor(doraMetrics.overallTier || "Elite")
                )}
              >
                {doraMetrics.overallTier || "Elite"} Performer
              </span>
            </div>

            {/* Four Core DORA Metrics Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Deployment Frequency */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <Rocket className="h-3.5 w-3.5 text-cyan-400" /> Deployment Frequency
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      getTierColor(doraMetrics.deploymentFrequency?.rating || "Elite")
                    )}
                  >
                    {doraMetrics.deploymentFrequency?.rating || "Elite"}
                  </span>
                </div>
                <div className="text-xl font-bold text-white">
                  {doraMetrics.deploymentFrequency?.value || "Daily"}
                </div>
                <p className="text-[11px] text-slate-400">
                  {doraMetrics.deploymentFrequency?.description}
                </p>
              </div>

              {/* Lead Time for Changes */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-400" /> Lead Time for Changes
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      getTierColor(doraMetrics.leadTimeForChanges?.rating || "Elite")
                    )}
                  >
                    {doraMetrics.leadTimeForChanges?.rating || "Elite"}
                  </span>
                </div>
                <div className="text-xl font-bold text-white">
                  {doraMetrics.leadTimeForChanges?.value || "< 1 hour"}
                </div>
                <p className="text-[11px] text-slate-400">
                  {doraMetrics.leadTimeForChanges?.description}
                </p>
              </div>

              {/* Change Failure Rate */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-emerald-400" /> Change Failure Rate
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      getTierColor(doraMetrics.changeFailureRate?.rating || "Elite")
                    )}
                  >
                    {doraMetrics.changeFailureRate?.rating || "Elite"}
                  </span>
                </div>
                <div className="text-xl font-bold text-emerald-400">
                  {doraMetrics.changeFailureRate?.value || "< 5%"}
                </div>
                <p className="text-[11px] text-slate-400">
                  {doraMetrics.changeFailureRate?.description}
                </p>
              </div>

              {/* Time to Restore Service */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5 text-violet-400" /> Time to Restore Service
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      getTierColor(doraMetrics.timeToRestoreService?.rating || "Elite")
                    )}
                  >
                    {doraMetrics.timeToRestoreService?.rating || "Elite"}
                  </span>
                </div>
                <div className="text-xl font-bold text-white">
                  {doraMetrics.timeToRestoreService?.value || "< 1 hour"}
                </div>
                <p className="text-[11px] text-slate-400">
                  {doraMetrics.timeToRestoreService?.description}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "radar" && (
          <motion.div
            key="radar"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-4"
            data-testid="tech-radar-section"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* SVG Spider / Radar Chart */}
              <div className="relative flex items-center justify-center p-3">
                <svg
                  viewBox="0 0 200 200"
                  className="w-56 h-56 max-w-full overflow-visible drop-shadow-md"
                  role="img"
                  aria-label="Repository Health & Tech Stack Radar Chart"
                >
                  {/* Concentric rings */}
                  {[0.25, 0.5, 0.75, 1.0].map((level) => (
                    <polygon
                      key={level}
                      points={radarDimensions
                        .map((_, i) => {
                          const angle = (Math.PI * 2 / radarDimensions.length) * i - Math.PI / 2;
                          const r = 75 * level;
                          const x = 100 + r * Math.cos(angle);
                          const y = 100 + r * Math.sin(angle);
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.08)"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Radiating axes */}
                  {radarAxes.map((axis, i) => (
                    <line
                      key={i}
                      x1="100"
                      y1="100"
                      x2={axis.x}
                      y2={axis.y}
                      stroke="rgba(255, 255, 255, 0.12)"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Filled score polygon */}
                  <polygon
                    points={radarPolygonPoints}
                    fill="rgba(99, 102, 241, 0.25)"
                    stroke="#818cf8"
                    strokeWidth="2"
                    className="transition-all duration-500"
                  />

                  {/* Data Points */}
                  {radarAxes.map((axis, i) => {
                    const angle = (Math.PI * 2 / radarDimensions.length) * i - Math.PI / 2;
                    const r = (axis.score / 100) * 75;
                    const px = 100 + r * Math.cos(angle);
                    const py = 100 + r * Math.sin(angle);
                    return (
                      <circle
                        key={i}
                        cx={px}
                        cy={py}
                        r="4"
                        fill="#38bdf8"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                      />
                    );
                  })}

                  {/* Axis Labels */}
                  {radarAxes.map((axis, i) => (
                    <text
                      key={i}
                      x={axis.labelX}
                      y={axis.labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-slate-400 text-[8px] font-medium"
                    >
                      {axis.label}
                    </text>
                  ))}
                </svg>
              </div>

              {/* Score Breakdown List */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-300 mb-2">
                  Health & Stack Dimension Scores
                </div>
                {radarDimensions.map((dim) => (
                  <div key={dim.key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">{dim.label}</span>
                      <span className="font-mono font-bold text-white">{dim.score} / 100</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          dim.score >= 85
                            ? "bg-emerald-400"
                            : dim.score >= 70
                            ? "bg-amber-400"
                            : "bg-rose-400"
                        )}
                        style={{ width: `${dim.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
