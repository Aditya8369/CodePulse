"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, GitFork, GitPullRequest, Star } from "lucide-react";
import { RepoHealthScorecard } from "@/components/repositories/repo-health-scorecard";
import type { RepositoryHealth } from "@/lib/repository-health";
import { cn } from "@/lib/utils";

interface Inspection {
  fullName: string;
  url: string;
  isPrivate: boolean;
  license: string | null;
  stars: number;
  forks: number;
  openPullRequests: number | null;
  languages: Array<{ language: string; bytes: number; percentage: number; color: string }>;
  punchcard: Array<[number, number, number]> | null;
  health: RepositoryHealth;
  branches: string[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RepositoryInspectorModal({ fullName, open, onClose }: {
  fullName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "languages" | "activity">("overview");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/github/repository-inspector?repo=${encodeURIComponent(fullName)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Repository details are unavailable.");
        return data as Inspection;
      })
      .then(setInspection)
      .catch((reason) => {
        if (reason instanceof Error && reason.name !== "AbortError") {
          setError(reason.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fullName, open]);

  const matrix = Array.from({ length: 24 }, () => Array(7).fill(0) as number[]);
  for (const [day, hour, count] of inspection?.punchcard || []) {
    if (day >= 0 && day < 7 && hour >= 0 && hour < 24) matrix[hour][day] = count;
  }
  const maxCommits = Math.max(1, ...matrix.flat());
  const ratio = inspection?.health.openIssues != null && inspection.health.closedIssues != null
    ? `${inspection.health.openIssues}:${inspection.health.closedIssues}` : "Unavailable";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-white/10 bg-[#0B0F19] text-white sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="break-all text-xl sm:text-2xl text-white font-bold">{inspection?.fullName || fullName}</DialogTitle>
          <DialogDescription className="text-slate-300">Live details from GitHub, refreshed at most hourly.</DialogDescription>
        </DialogHeader>

        {loading && <p role="status" className="py-8 text-center text-slate-300">Loading repository details…</p>}
        {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/20 p-4 text-rose-200 font-medium">{error}</p>}
        {inspection && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                data-testid="visibility-badge"
                className={cn(
                  "rounded-full border px-3 py-1 font-semibold shadow-sm",
                  inspection.isPrivate
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                )}
              >
                {inspection.isPrivate ? "Private" : "Public"}
              </span>
              <span
                data-testid="license-badge"
                className="rounded-full border border-indigo-500/40 bg-indigo-500/20 text-indigo-200 px-3 py-1 font-medium shadow-sm"
              >
                {inspection.license || "No license detected"}
              </span>
              <a
                href={inspection.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors font-medium hover:underline"
              >
                View on GitHub <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>

            <div role="tablist" aria-label="Repository details" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-800/70 border border-white/10 p-1">
              {(["overview", "languages", "activity"] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={tab === name}
                  onClick={() => setTab(name)}
                  className={cn(
                    "min-w-24 rounded-lg px-3 py-2 text-sm font-semibold capitalize transition-all cursor-pointer",
                    tab === name ? "bg-blue-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-white/10"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div role="tabpanel" className="space-y-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Stars", value: inspection.stars, icon: Star },
                    { label: "Forks", value: inspection.forks, icon: GitFork },
                    { label: "Open PRs", value: inspection.openPullRequests ?? "Unavailable", icon: GitPullRequest },
                    { label: "Issues open:closed", value: ratio, icon: GitPullRequest },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-slate-800/50 p-3 shadow-sm">
                      <Icon className="mb-2 h-4 w-4 text-blue-400" aria-hidden="true" />
                      <div className="break-words text-lg font-bold text-white">{value}</div>
                      <div className="text-xs text-slate-300 font-medium">{label}</div>
                    </div>
                  ))}
                </div>
                <RepoHealthScorecard inspection={inspection} />
                <div>
                  <h3 className="mb-2 font-semibold text-slate-200">Branches</h3>
                  {inspection.branches.length ? (
                    <div className="flex flex-wrap gap-2">
                      {inspection.branches.map((branch) => (
                        <span
                          key={branch}
                          className="max-w-full truncate rounded-full border border-white/10 bg-slate-800/80 px-3 py-1 text-xs font-mono font-medium text-slate-200 shadow-sm"
                        >
                          {branch}
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-400">Branch details unavailable.</p>}
                </div>
              </div>
            )}

            {tab === "languages" && (
              <div role="tabpanel" className="space-y-4">
                {inspection.languages.length ? (
                  <>
                    <div className="flex h-5 overflow-hidden rounded-full" aria-label="Language distribution">
                      {inspection.languages.map((item) => <div key={item.language} style={{ width: `${item.percentage}%`, backgroundColor: item.color }} title={`${item.language}: ${item.percentage.toFixed(1)}%`} />)}
                    </div>
                    <ul className="space-y-2">{inspection.languages.map((item) => (
                      <li key={item.language} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />{item.language}</span>
                        <span className="text-right tabular-nums text-slate-300">{item.percentage.toFixed(1)}% · {item.bytes.toLocaleString()} bytes</span>
                      </li>
                    ))}</ul>
                  </>
                ) : <p className="text-sm text-slate-400">GitHub has no language byte breakdown for this repository.</p>}
              </div>
            )}

            {tab === "activity" && (
              <div role="tabpanel">
                {inspection.punchcard ? (
                  <div className="overflow-x-auto">
                    <p className="mb-3 text-xs text-slate-400">Commit counts by day and hour (GitHub repository history)</p>
                    <div className="grid min-w-[320px] grid-cols-[2.5rem_repeat(7,minmax(0,1fr))] gap-1 text-center text-[10px]">
                      <span />{DAYS.map((day) => <span key={day} className="text-slate-400">{day}</span>)}
                      {matrix.map((row, hour) => [
                        <span key={`hour-${hour}`} className="text-right text-slate-400">{String(hour).padStart(2, "0")}:00</span>,
                        ...row.map((count, day) => <span key={`${hour}-${day}`} title={`${DAYS[day]} ${hour}:00: ${count} commits`}
                          aria-label={`${DAYS[day]} ${hour}:00: ${count} commits`}
                          className="h-4 rounded-sm border border-white/5"
                          style={{ backgroundColor: `rgba(59, 130, 246, ${0.08 + (count / maxCommits) * 0.92})` }} />),
                      ])}
                    </div>
                  </div>
                ) : <p className="text-sm text-slate-400">GitHub is still preparing commit activity or the data is unavailable. Try again later.</p>}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
