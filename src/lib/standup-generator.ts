import type { Activity } from "@/types";

export type StandupFormat = "markdown" | "slack" | "plain";

export type StandupGroup = { repository: string; commits: string[] };

function localDateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function yesterdayKey(now: Date): string {
  return localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
}

export function groupYesterdayCommits(activities: Activity[], now: Date): StandupGroup[] {
  const target = yesterdayKey(now);
  const groups = new Map<string, string[]>();

  for (const activity of activities) {
    if (activity.type.toLowerCase() !== "commit") continue;
    const date = new Date(activity.createdAt);
    if (!Number.isFinite(date.getTime()) || localDateKey(date) !== target) continue;

    const repository = activity.repository?.trim() || "Other repository";
    const messages = Array.isArray(activity.metadata?.commitMessages)
      ? activity.metadata.commitMessages.filter((message): message is string => typeof message === "string")
      : [];
    const summaries = messages.length > 0 ? messages : [activity.title];
    const lines = summaries
      .map((summary) => summary.split(/\r?\n/, 1)[0].trim().slice(0, 200))
      .filter(Boolean);
    if (lines.length > 0) groups.set(repository, [...(groups.get(repository) ?? []), ...lines]);
  }

  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([repository, commits]) => ({ repository, commits }));
}

export function formatStandup(groups: StandupGroup[], format: StandupFormat): string {
  const headline = format === "slack" ? "*Yesterday*" : "Yesterday:";
  const today = format === "slack" ? "*Today*" : "Today:";
  const blockers = format === "slack" ? "*Blockers*" : "Blockers:";
  const lines = groups.length === 0
    ? ["No synced commits found for yesterday."]
    : groups.flatMap(({ repository, commits }) => [
        format === "markdown" ? `- **${repository}**` : `- ${repository}`,
        ...commits.map((commit) => format === "plain" ? `  ${commit}` : `  - ${commit}`),
      ]);
  return [headline, ...lines, "", today, "[Add today's plan]", "", blockers, "[Add blockers or None]"].join("\n");
}
