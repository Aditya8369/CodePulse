export interface ActivityDay {
  date: string;
  count: number;
}

export interface StreakCalendarDay {
  date: string;
  day: number;
  count: number;
  status: "active" | "protected" | "inactive";
}

function isActivityDay(value: unknown): value is ActivityDay {
  if (!value || typeof value !== "object" || !("date" in value) || !("count" in value)) return false;
  const { date, count } = value;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof count !== "number"
    || !Number.isSafeInteger(count) || count < 0) return false;
  const timestamp = Date.parse(date + "T00:00:00Z");
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().startsWith(date + "T");
}

export function getActivityDays(value: unknown): ActivityDay[] {
  return Array.isArray(value) ? value.filter(isActivityDay) : [];
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function buildStreakMonth(
  year: number,
  month: number,
  activity: ActivityDay[],
  protectedDates: string[] = [],
): Array<StreakCalendarDay | null> {
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const mondayOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const counts = new Map(activity.map(({ date, count }) => [date, count]));
  const freezes = new Set(protectedDates);
  const cells: Array<StreakCalendarDay | null> = Array(mondayOffset).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = dateKey(year, month, day);
    const count = Math.max(0, counts.get(date) ?? 0);
    cells.push({ date, day, count, status: count > 0 ? "active" : freezes.has(date) ? "protected" : "inactive" });
  }
  return cells;
}

export function longestActivityStreak(activity: ActivityDay[]) {
  const activeDates = new Set(activity.filter((day) => day.count > 0).map((day) => day.date));
  if (activeDates.size === 0) return 0;
  const sorted = [...activeDates].sort();
  let best = 0;
  let current = 0;
  let previous = "";
  for (const date of sorted) {
    const priorDay = new Date(`${date}T00:00:00Z`);
    priorDay.setUTCDate(priorDay.getUTCDate() - 1);
    current = previous === priorDay.toISOString().slice(0, 10) ? current + 1 : 1;
    best = Math.max(best, current);
    previous = date;
  }
  return best;
}
