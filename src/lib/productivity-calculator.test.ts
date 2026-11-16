import { describe, expect, it } from "vitest";
import { calculateProductivity } from "./productivity-calculator";
import type { Activity, CommitActivity, ContributionDay, LanguageStat } from "@/types";

const now = new Date("2026-11-16T12:00:00Z");
const day = (offset: number) => new Date(now.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
const commit = (offset: number, commits = 2): CommitActivity => ({ date: day(offset), commits, additions: 0, deletions: 0 });
const contribution = (offset: number): ContributionDay => ({ date: day(offset), count: 2, level: 1 });
const pr = (offset: number): Activity => ({
  id: String(offset), type: "pull_request", title: "PR", description: "", createdAt: `${day(offset)}T10:00:00Z`,
});
const language = (name: string): LanguageStat => ({ name, color: "#fff", percentage: 25, linesOfCode: 100, repos: 1 });

describe("calculateProductivity", () => {
  it("uses the four weighted signals and awards the top tier for sustained activity", () => {
    const result = calculateProductivity({
      userId: "user-1", now,
      commitActivity: Array.from({ length: 10 }, (_, offset) => commit(offset)),
      contributionData: Array.from({ length: 10 }, (_, offset) => contribution(offset)),
      activities: [pr(0), pr(2), pr(4), pr(6)],
      battles: Array.from({ length: 5 }, (_, offset) => ({
        startedAt: `${day(offset)}T10:00:00Z`, status: "COMPLETED", winnerId: "user-1",
      })),
      xp: 1500,
      languages: ["TypeScript", "Python", "Go", "Rust"].map(language),
    });

    expect(result.score).toBe(100);
    expect(result.tier).toBe("Hyper-Focus");
    expect(result.delta).toBeGreaterThan(0);
    expect(result.tips).toHaveLength(3);
  });

  it("does not turn lifetime XP or language count into a score with no recent activity", () => {
    const result = calculateProductivity({
      userId: "user-1", now, xp: 10000,
      languages: ["TypeScript", "Python", "Go", "Rust"].map(language),
    });
    expect(result).toMatchObject({ score: 0, previousScore: 0, delta: 0, tier: "Warming Up", hasRecentData: false });
  });

  it("ignores malformed dates and does not count another user's battle win", () => {
    const result = calculateProductivity({
      userId: "user-1", now,
      commitActivity: [{ ...commit(0), date: "bad date" }, commit(0, 1)],
      battles: [{ startedAt: `${day(0)}T10:00:00Z`, status: "COMPLETED", winnerId: "user-2" }],
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(25);
    expect(result.tips).toContain("Win a Dev Battle to improve your battle score.");
  });

  it("shows a decline when recent activity falls below the preceding week", () => {
    const result = calculateProductivity({
      userId: "user-1", now,
      commitActivity: Array.from({ length: 7 }, (_, offset) => commit(offset + 8, 4)),
      contributionData: Array.from({ length: 7 }, (_, offset) => contribution(offset + 8)),
      activities: [pr(9), pr(10), pr(11), pr(12)],
    });
    expect(result.delta).toBeLessThan(0);
  });
});
