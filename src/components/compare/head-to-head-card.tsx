"use client";

import { CalendarDays, Code2, Swords, Trophy } from "lucide-react";

export interface HeadToHeadData {
  user1Wins: number;
  user2Wins: number;
  draws: number;
  totalMatches: number;
  latest: {
    date: string;
    category: string;
    user1Score: number | null;
    user2Score: number | null;
    winner: string | null;
  } | null;
}

interface Developer {
  username: string;
  topLanguages: { name: string; count: number }[];
}

export function calculateLanguageOverlap(first: Developer["topLanguages"], second: Developer["topLanguages"]) {
  const firstNames = new Map(first.map((language) => [language.name.trim().toLowerCase(), language.name] as const).filter(([key]) => key));
  const secondNames = new Set(second.map((language) => language.name.trim().toLowerCase()).filter(Boolean));
  const allNames = new Set([...firstNames.keys(), ...secondNames]);
  const shared = [...firstNames].filter(([key]) => key && secondNames.has(key)).map(([, label]) => label);
  return {
    shared,
    percentage: allNames.size ? Math.round((shared.length / allNames.size) * 100) : null,
  };
}

interface HeadToHeadCardProps {
  first: Developer;
  second: Developer;
  history?: HeadToHeadData;
  isLoading: boolean;
  hasError: boolean;
}

export function HeadToHeadCard({ first, second, history, isLoading, hasError }: HeadToHeadCardProps) {
  const overlap = calculateLanguageOverlap(first.topLanguages, second.topLanguages);
  const latest = history?.latest;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-emerald-500/20 bg-white p-6 dark:bg-[#0a0a0a]" aria-label="Head-to-head match record">
        <h2 className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          <Swords className="h-4 w-4" aria-hidden="true" /> Head-to-Head Match Record
        </h2>
        {isLoading ? (
          <p className="text-sm text-zinc-500" role="status">Loading battle history…</p>
        ) : hasError ? (
          <p className="text-sm text-zinc-500" role="status">Battle history is temporarily unavailable.</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
              <div className="min-w-0">
                <p className="truncate text-xs text-zinc-500">@{first.username}</p>
                <p className="text-4xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{history?.user1Wins ?? 0}</p>
                <p className="text-xs text-zinc-500">wins</p>
              </div>
              <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-bold text-zinc-500 dark:border-zinc-700">VS</span>
              <div className="min-w-0">
                <p className="truncate text-xs text-zinc-500">@{second.username}</p>
                <p className="text-4xl font-bold tabular-nums text-cyan-600 dark:text-cyan-400">{history?.user2Wins ?? 0}</p>
                <p className="text-xs text-zinc-500">wins</p>
              </div>
            </div>
            {history?.totalMatches ? (
              <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-white/[0.03] dark:text-zinc-400">
                <p>{history.totalMatches} completed {history.totalMatches === 1 ? "match" : "matches"}{history.draws ? ` · ${history.draws} draws` : ""}</p>
                {latest && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{new Date(latest.date).toLocaleDateString()}</span>
                    <span>{latest.category}</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">Latest: {latest.user1Score ?? "—"}–{latest.user2Score ?? "—"}</span>
                    {latest.winner && <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><Trophy className="h-3.5 w-3.5" aria-hidden="true" />@{latest.winner}</span>}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-5 text-center text-sm text-zinc-500">No direct matches recorded yet.</p>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-cyan-500/20 bg-white p-6 dark:bg-[#0a0a0a]" aria-label="Shared tech stack">
        <h2 className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
          <Code2 className="h-4 w-4" aria-hidden="true" /> Shared Tech Stack
        </h2>
        {overlap.percentage === null ? (
          <p className="text-sm text-zinc-500">No language data available for this comparison.</p>
        ) : (
          <>
            <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-white">{overlap.percentage}%</p>
            <p className="mt-1 text-xs text-zinc-500">overlap across their top languages</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="meter" aria-label="Language overlap" aria-valuenow={overlap.percentage} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-700" style={{ width: `${overlap.percentage}%` }} />
            </div>
            <p className="mt-4 text-xs font-medium text-zinc-500">Shared languages</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {overlap.shared.length ? overlap.shared.map((name) => (
                <span key={name.toLowerCase()} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-700 dark:text-cyan-300">{name}</span>
              )) : <span className="text-sm text-zinc-500">No shared top languages.</span>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
