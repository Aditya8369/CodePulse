import { describe, expect, it } from "vitest";
import type { Activity } from "@/types";
import { formatStandup, groupYesterdayCommits } from "./standup-generator";

const now = new Date(2026, 10, 17, 10, 0, 0);
const event = (repository: string, date: Date, metadata?: Record<string, unknown>): Activity => ({
  id: `${repository}-${date.getTime()}`,
  type: "commit",
  title: "Pushed 2 commits",
  description: "Synced from GitHub",
  repository,
  createdAt: date.toISOString(),
  metadata,
});

describe("standup generation", () => {
  it("uses the previous local calendar day and groups real messages by repository", () => {
    const groups = groupYesterdayCommits([
      event("zeta/api", new Date(2026, 10, 16, 23, 59), { commitMessages: ["Fix login\n\nDetails", "Add test"] }),
      event("alpha/web", new Date(2026, 10, 16, 0, 1), { commitMessages: ["Improve layout"] }),
      event("alpha/web", new Date(2026, 10, 17, 0, 0), { commitMessages: ["Today's work"] }),
      event("alpha/web", new Date(2026, 10, 15, 23, 59)),
      { ...event("alpha/web", new Date(2026, 10, 16, 8)), type: "issue" },
    ], now);
    expect(groups).toEqual([
      { repository: "alpha/web", commits: ["Improve layout"] },
      { repository: "zeta/api", commits: ["Fix login", "Add test"] },
    ]);
  });

  it("keeps a truthful count when an older synced push has no messages", () => {
    const groups = groupYesterdayCommits([event("alpha/web", new Date(2026, 10, 16, 8))], now);
    expect(groups[0].commits).toEqual(["Pushed 2 commits"]);
    expect(formatStandup(groups, "markdown")).toContain("- **alpha/web**");
    expect(formatStandup(groups, "slack")).toContain("*Yesterday*");
    expect(formatStandup(groups, "plain")).toContain("[Add today's plan]");
    expect(formatStandup(groups, "plain")).not.toContain("Today: None");
  });
});
