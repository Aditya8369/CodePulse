"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { scoreRepositoryHealth, type RepositoryHealth } from "@/lib/repository-health";

type InspectionHealth = { health: RepositoryHealth; license: string | null };

export function RepoHealthScorecard({ fullName, inspection }: {
  fullName?: string;
  inspection?: InspectionHealth;
}) {
  const [fetched, setFetched] = useState<InspectionHealth | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (inspection || !fullName) return;
    const controller = new AbortController();
    fetch(`/api/github/repository-inspector?repo=${encodeURIComponent(fullName)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Repository inspection unavailable");
        return response.json() as Promise<InspectionHealth>;
      })
      .then(setFetched)
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [fullName, inspection]);

  const data = inspection || fetched;
  if (!data) return <p role="status" className="text-sm text-slate-400">{error ? "Repository health is unavailable right now." : "Loading repository health…"}</p>;

  const result = scoreRepositoryHealth(data.health, data.license);
  const color = result.score === null ? "#64748b" : result.score >= 80 ? "#34d399" : result.score >= 60 ? "#fbbf24" : "#fb7185";
  const checks = [
    { label: `License${data.license ? ` (${data.license})` : ""}`, value: data.health.hasLicense },
    { label: "README.md", value: data.health.hasReadme },
    { label: "GitHub Actions CI", value: data.health.hasCi },
    { label: "CONTRIBUTING.md", value: data.health.hasContributing },
  ];
  const recommendations = result.categories.filter((category) => category.points !== null && category.points < category.max);

  return (
    <section aria-label="Repository health scorecard" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-slate-100">
      <div className="flex flex-wrap items-center gap-5">
        <div role="progressbar" aria-label="Repository health score" aria-valuenow={result.score ?? undefined} aria-valuemin={0} aria-valuemax={100}
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full p-2"
          style={{ background: `conic-gradient(${color} ${(result.score ?? 0) * 3.6}deg, #334155 0)` }}>
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#0B0F19]">
            <span className="text-2xl font-bold">{result.score ?? "—"}</span>
            <span className="text-[10px] text-slate-400">/ 100</span>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold">Repository health</h3>
          <p className="text-sm" style={{ color }}>Grade: {result.grade} {result.score === null ? "" : `(${result.score}/100)`}</p>
          {result.provisional && <p className="mt-1 text-xs text-slate-400">Provisional: {result.available}/100 points of data available from GitHub.</p>}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-5" aria-label="Health categories">
        {result.categories.map((category) => (
          <div key={category.label} className="rounded-xl border border-white/10 p-3">
            <p className="text-xs font-medium">{category.label}</p>
            <p className="mt-1 text-lg font-semibold">{category.points === null ? "—" : `${category.points}/${category.max}`}</p>
            <p className="mt-1 text-xs text-slate-400">{category.detail}</p>
          </div>
        ))}
      </div>

      <h4 className="mt-5 text-sm font-semibold">Project checklist</h4>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {checks.map(({ label, value }) => (
          <li key={label} className="flex items-center gap-2 text-sm">
            {value === null ? <CircleHelp className="h-4 w-4 text-slate-400" aria-hidden="true" />
              : value ? <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                : <XCircle className="h-4 w-4 text-rose-400" aria-hidden="true" />}
            <span>{label}: {value === null ? "Unavailable" : value ? "Present" : "Missing"}</span>
          </li>
        ))}
      </ul>

      <h4 className="mt-5 text-sm font-semibold">How to improve this score</h4>
      {recommendations.length ? (
        <ul className="mt-2 space-y-2 text-sm text-slate-300">
          {recommendations.map((category) => <li key={category.label} className="rounded-lg bg-white/5 p-2"><strong>{category.label}:</strong> {category.recommendation}</li>)}
        </ul>
      ) : <p className="mt-2 text-sm text-slate-400">No improvements identified from the available data.</p>}
    </section>
  );
}
