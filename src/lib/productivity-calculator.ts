import type { Activity, CommitActivity, ContributionDay, LanguageStat } from "@/types";

export interface ProductivityBattle {
  startedAt: string;
  status: string;
  winnerId?: string | null;
}

export interface ProductivityInput {
  userId: string;
  commitActivity?: CommitActivity[];
  contributionData?: ContributionDay[];
  activities?: Activity[];
  battles?: ProductivityBattle[];
  xp?: number;
  languages?: LanguageStat[];
  now?: Date;
}

export type ProductivityTier = "Hyper-Focus" | "Flow State" | "Steady Progress" | "Warming Up";

export interface ProductivityResult {
  score: number;
  previousScore: number;
  delta: number;
  tier: ProductivityTier;
  tips: string[];
  hasRecentData: boolean;
}

const clamp = (value: number, max = 100) => Math.max(0, Math.min(max, value));
const DAY = 86_400_000;

function dayTime(value: string): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function inWindow(date: string, end: number, days: number) {
  const time = dayTime(date);
  return time !== null && time > end - days * DAY && time <= end;
}

function tierFor(score: number): ProductivityTier {
  if (score >= 90) return "Hyper-Focus";
  if (score >= 75) return "Flow State";
  if (score >= 50) return "Steady Progress";
  return "Warming Up";
}

function scoreWindow(input: ProductivityInput, end: number) {
  const commits = (input.commitActivity ?? [])
    .filter((day) => inWindow(day.date, end, 14))
    .reduce((sum, day) => sum + Math.max(0, day.commits || 0), 0);
  const prs = (input.activities ?? []).filter(
    (activity) => activity.type?.toLowerCase() === "pull_request" && inWindow(activity.createdAt, end, 14),
  ).length;

  // Frequency reaches full credit at 20 commits and four PRs per fortnight.
  const frequency = clamp(commits / 20, 1) * 65 + clamp(prs / 4, 1) * 35;

  const dayMap = new Map<string, number>();
  for (const day of input.contributionData ?? []) {
    const time = dayTime(day.date);
    if (time !== null) dayMap.set(new Date(time).toISOString().slice(0, 10), day.count || 0);
  }
  // Some profiles only have a commit chart. Use it to recover active days.
  for (const day of input.commitActivity ?? []) {
    const time = dayTime(day.date);
    if (time !== null && day.commits > 0) {
      const key = new Date(time).toISOString().slice(0, 10);
      dayMap.set(key, Math.max(dayMap.get(key) ?? 0, day.commits));
    }
  }
  const endDay = Math.floor(end / DAY) * DAY;
  let activeDays = 0;
  let streak = 0;
  let streakBroken = false;
  for (let offset = 0; offset < 14; offset++) {
    const date = new Date(endDay - offset * DAY).toISOString().slice(0, 10);
    const active = (dayMap.get(date) ?? 0) > 0;
    if (active) activeDays++;
    if (!streakBroken) {
      if (active) streak++;
      else if (offset > 0) streakBroken = true; // A quiet current day does not break yesterday's streak.
    }
  }
  const consistency = clamp(activeDays / 10, 1) * 65 + clamp(streak / 7, 1) * 35;

  const completed = (input.battles ?? []).filter(
    (battle) => battle.status.toUpperCase() === "COMPLETED" && inWindow(battle.startedAt, end, 14),
  );
  const wins = completed.filter((battle) => battle.winnerId === input.userId).length;
  const winRate = completed.length > 0 ? wins / completed.length : 0;
  const participation = clamp(completed.length / 5, 1);
  // XP is a lifetime signal; it is held constant across both comparison windows.
  const xp = clamp(Math.max(0, input.xp ?? 0) / 1500, 1);
  const battle = winRate * 60 + participation * 20 + xp * 20;

  const languageCount = new Set(
    (input.languages ?? []).map((language) => language.name?.toLowerCase()).filter(Boolean),
  ).size;
  const diversity = clamp(languageCount / 4, 1);

  const hasRecentData = commits > 0 || prs > 0 || activeDays > 0 || completed.length > 0;
  const score = hasRecentData
    ? Math.round(frequency * 0.4 + consistency * 0.25 + battle * 0.2 + diversity * 15)
    : 0;
  return { score, commits, prs, activeDays, completed: completed.length, wins, languageCount, hasRecentData };
}

export function calculateProductivity(input: ProductivityInput): ProductivityResult {
  const now = input.now ?? new Date();
  const end = Number.isFinite(now.getTime()) ? now.getTime() : Date.now();
  const current = scoreWindow(input, end);
  const previous = scoreWindow(input, end - 7 * DAY);
  const tips: string[] = [];

  if (current.activeDays < 5) tips.push("Code on five days this fortnight to build consistency.");
  if (current.prs < 2) tips.push("Open a meaningful pull request this fortnight.");
  if (current.completed === 0) tips.push("Complete a Dev Battle to add a competitive signal.");
  else if (current.wins === 0) tips.push("Win a Dev Battle to improve your battle score.");
  if (current.languageCount < 3) tips.push("Explore another language to widen your toolkit.");
  if (current.commits < 10) tips.push("Make steady commits toward a small project goal.");
  if (tips.length < 3) tips.push("Keep your coding streak going through the next week.");
  if (tips.length < 3) tips.push("Continue opening focused pull requests as you build.");
  if (tips.length < 3) tips.push("Challenge another developer and track your progress.");

  return {
    score: current.score,
    previousScore: previous.score,
    delta: current.score - previous.score,
    tier: tierFor(current.score),
    tips: tips.slice(0, 3),
    hasRecentData: current.hasRecentData,
  };
}
