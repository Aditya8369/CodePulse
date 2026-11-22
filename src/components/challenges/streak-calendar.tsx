"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Snowflake } from "lucide-react";
import { buildStreakMonth, getActivityDays, longestActivityStreak } from "@/lib/streak-calendar";
import { StreakFlameParticles } from "./streak-flame-particles";

interface StreakCalendarProps {
  activity: unknown;
  currentStreak: number;
  longestStreak?: number;
  protectedDates?: string[];
  freezeInventory?: number | null;
  today?: Date;
}

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function StreakCalendar({
  activity, currentStreak, longestStreak = 0, protectedDates = [],
  freezeInventory = null, today = new Date(),
}: StreakCalendarProps) {
  const [month, setMonth] = useState(() => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
  const days = useMemo(() => getActivityDays(activity), [activity]);
  const cells = buildStreakMonth(month.getUTCFullYear(), month.getUTCMonth(), days, protectedDates);
  const best = Math.max(longestStreak, longestActivityStreak(days));
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);

  function shiftMonth(offset: number) {
    setMonth((value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + offset, 1)));
  }

  return (
    <section className="glass-card rounded-[20px] border border-white/10 p-5 sm:p-6" aria-label="Contribution streak calendar">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Flame className="h-5 w-5 text-orange-400" aria-hidden="true" />
              Contribution streak
            </h2>
            {currentStreak >= 7 && (
              <StreakFlameParticles streak={currentStreak} showBadge={true} />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">A day-by-day view of your synced GitHub activity.</p>
        </div>
        <div className="flex items-center gap-2" aria-label="Change calendar month">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="rounded-lg border border-white/10 p-2 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-32 text-center text-sm font-semibold" aria-live="polite">{monthLabel}</span>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="rounded-lg border border-white/10 p-2 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl border border-orange-400/20 bg-orange-400/5 p-3">
          {currentStreak >= 7 && (
            <div className="absolute inset-0 pointer-events-none">
              <StreakFlameParticles streak={currentStreak} showBadge={false} className="h-full w-full" />
            </div>
          )}
          <p className="text-xs text-muted-foreground">Current streak</p>
          <p className="mt-1 text-xl font-bold text-orange-400 flex items-center gap-1.5">
            <span>{currentStreak} days</span>
            {currentStreak >= 7 && <Flame className="h-4 w-4 fill-orange-400/30 animate-pulse" />}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-xs text-muted-foreground">Best streak</p><p className="mt-1 text-xl font-bold">{best} days</p></div>
        <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-3"><p className="text-xs text-muted-foreground">Streak freezes</p><p className="mt-1 text-xl font-bold">{freezeInventory === null ? "Unavailable" : `${freezeInventory} available`}</p></div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-xs sm:gap-2">
        {weekdays.map((day) => <div key={day} className="py-1 font-semibold text-muted-foreground">{day}</div>)}
        {cells.map((cell, index) => cell ? (
          <div key={cell.date} role="img" title={`${cell.date}: ${cell.status === "active" ? `${cell.count} contribution${cell.count === 1 ? "" : "s"}` : cell.status === "protected" ? "streak protected" : "no activity"}`} aria-label={`${cell.date}: ${cell.status === "active" ? `${cell.count} contributions` : cell.status === "protected" ? "streak protected" : "no activity"}`} className={`flex aspect-square min-h-8 flex-col items-center justify-center rounded-lg border text-xs ${cell.status === "active" ? "border-orange-400/40 bg-orange-400/15 text-orange-300" : cell.status === "protected" ? "border-sky-400/40 bg-sky-400/15 text-sky-300" : "border-white/5 bg-white/[0.03] text-muted-foreground"}`}>
            <span>{cell.day}</span>{cell.status === "active" ? <Flame className="h-3 w-3" aria-hidden="true" /> : cell.status === "protected" ? <Snowflake className="h-3 w-3" aria-hidden="true" /> : <span aria-hidden="true" className="mt-1 h-1 w-1 rounded-full bg-current opacity-50" />}
          </div>
        ) : <div key={`empty-${index}`} aria-hidden="true" />)}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-xs text-muted-foreground">Flame: contributions · Snowflake: protected day · Dot: no activity{freezeInventory === null ? " · Freeze activation is awaiting server support" : ""}</p>
        <button type="button" disabled className="rounded-lg border border-sky-400/30 px-3 py-2 text-sm font-semibold text-sky-300 opacity-50">
          Equip Freeze
        </button>
      </div>
    </section>
  );
}
