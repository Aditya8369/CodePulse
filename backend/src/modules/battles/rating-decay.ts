const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const GRACE_MS = 14 * DAY_MS;

/** The floor is fixed at the last completed battle, so crossing tiers cannot lower it. */
export function decayFloorForElo(elo: number): number | null {
  if (elo >= 2100) return 1800;
  if (elo >= 1800) return 1500;
  return null;
}

/** One 25-point deduction after the grace period, then one per inactive week. */
export function dueDecayPeriods(lastBattleAt: Date, at: Date): number {
  const inactiveMs = at.getTime() - lastBattleAt.getTime();
  if (inactiveMs < GRACE_MS) return 0;
  return 1 + Math.floor((inactiveMs - GRACE_MS) / WEEK_MS);
}

export function decayAmount(
  elo: number,
  floor: number,
  duePeriods: number,
  appliedPeriods: number,
): number {
  return Math.max(
    0,
    Math.min(elo - floor, 25 * Math.max(0, duePeriods - appliedPeriods)),
  );
}

/** The warning job runs Saturday at 00:00 UTC, exactly 48 hours before Monday. */
export function nextDecayRunFromWarning(at: Date): Date {
  return new Date(at.getTime() + 2 * DAY_MS);
}
