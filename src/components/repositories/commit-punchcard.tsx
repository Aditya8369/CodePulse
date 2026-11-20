"use client";

import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, extractData } from "@/lib/api-client";

export interface CommitPunchcardData {
  repositoryId: string;
  timezone: string;
  matrix: number[][];
  sampledCommits: number;
  truncated: boolean;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const LEFT = 78;
const TOP = 36;
const STEP_X = 26;
const STEP_Y = 30;

export function CommitPunchcard({ repositoryId, localTimezone: suppliedTimezone }: {
  repositoryId: string;
  localTimezone?: string;
}) {
  const detectedTimezone = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
  const localTimezone = suppliedTimezone ?? detectedTimezone;
  const [mode, setMode] = useState<"utc" | "local">("utc");
  const timezone = mode === "utc" ? "UTC" : localTimezone;
  const [hovered, setHovered] = useState<{ day: number; hour: number } | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["repository-commit-punchcard", repositoryId, timezone],
    queryFn: async () => extractData<CommitPunchcardData>(await apiClient.get(
      `/analytics/repository/${encodeURIComponent(repositoryId)}/commit-punchcard?timezone=${encodeURIComponent(timezone)}`,
    )),
    enabled: Boolean(repositoryId),
    staleTime: 5 * 60 * 1000,
  });

  const matrix = data?.matrix ?? Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const max = Math.max(1, ...matrix.flat());
  const weekendTotal = matrix.slice(5).flat().reduce((sum, count) => sum + count, 0);
  const weekdayTotal = matrix.slice(0, 5).flat().reduce((sum, count) => sum + count, 0);
  const slotLabel = (day: number, hour: number) => {
    const count = matrix[day]?.[hour] ?? 0;
    const weekend = day >= 5;
    const denominator = weekend ? weekendTotal : weekdayTotal;
    const percentage = denominator ? Math.round((count / denominator) * 100) : 0;
    return `${DAYS[day]}, ${String(hour).padStart(2, "0")}:00 — ${count} commit${count === 1 ? "" : "s"} (${percentage}% of ${weekend ? "weekend" : "weekday"} activity)`;
  };

  return (
    <section className="glass-card rounded-[28px] border border-white/5 p-6 sm:p-8" aria-label="Repository commit punchcard">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Commit Punchcard</h3>
          <p className="mt-1 text-sm text-slate-400">Actual commit timestamps from the past year, grouped by day and hour.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          Timezone
          <select
            aria-label="Punchcard timezone"
            value={mode}
            onChange={(event) => { setHovered(null); setMode(event.target.value === "utc" ? "utc" : "local"); }}
            className="rounded-lg border border-white/10 bg-[#101827] px-2 py-1.5 text-white"
          >
            <option value="utc">UTC</option>
            <option value="local">Local time ({localTimezone})</option>
          </select>
        </label>
      </div>

      {isLoading ? <p className="py-10 text-sm text-slate-400" role="status">Loading commit history…</p> :
        isError ? <p className="py-10 text-sm text-rose-300" role="alert">Commit history is unavailable for this repository.</p> :
        data?.sampledCommits === 0 ? <p className="py-10 text-sm text-slate-400">No commits found in the past year.</p> : (
          <>
            <div className="overflow-x-auto">
              <svg viewBox="0 0 720 260" className="min-w-[620px] w-full" role="img" aria-label={`Commit activity by weekday and hour in ${timezone}`}>
                {DAYS.map((day, index) => <text key={day} x={0} y={TOP + index * STEP_Y + 5} fill="#94a3b8" fontSize="12">{day.slice(0, 3)}</text>)}
                {Array.from({ length: 24 }, (_, hour) => hour % 3 === 0 ? (
                  <text key={hour} x={LEFT + hour * STEP_X - 8} y="18" fill="#94a3b8" fontSize="11">{String(hour).padStart(2, "0")}</text>
                ) : null)}
                {matrix.flatMap((row, day) => row.map((count, hour) => (
                  <g key={`${day}-${hour}`} role="img" tabIndex={count ? 0 : -1} aria-label={slotLabel(day, hour)}
                    onMouseEnter={() => setHovered({ day, hour })} onFocus={() => setHovered({ day, hour })}
                    onMouseLeave={() => setHovered(null)} onBlur={() => setHovered(null)}>
                    <circle cx={LEFT + hour * STEP_X} cy={TOP + day * STEP_Y} r={count ? 3 + 8 * Math.sqrt(count / max) : 2.5}
                      fill={count ? "#a78bfa" : "#334155"} fillOpacity={count ? 0.5 + 0.5 * count / max : 0.55} />
                    <title>{slotLabel(day, hour)}</title>
                  </g>
                )))}
              </svg>
            </div>
            <p className="mt-2 min-h-5 text-xs text-slate-300" role="status">
              {hovered ? slotLabel(hovered.day, hovered.hour) : `${data?.sampledCommits ?? 0} recent commits shown in ${timezone}.`}
            </p>
            {data?.truncated && <p className="mt-1 text-xs text-amber-300">Showing the latest 1,000 commits; older commits may be omitted.</p>}
          </>
        )}
    </section>
  );
}
