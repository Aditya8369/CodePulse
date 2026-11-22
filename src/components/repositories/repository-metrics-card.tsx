"use client";

import React from "react";
import { motion } from "motion/react";
import { GitCommit, GitPullRequest, AlertCircle, FileCode, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";

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
  className?: string;
}

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
  className,
}: RepositoryMetricsCardProps) {
  const prToIssueRatio = openIssuesCount > 0 ? (openPrsCount / openIssuesCount).toFixed(2) : "1.00";

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md shadow-xl space-y-6",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-white/5 pb-4 gap-2">
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
        <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium shrink-0">
          Analytics Deep Dive
        </span>
      </div>

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
    </div>
  );
}
