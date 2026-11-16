export const BASELINE_ELO = 1200;
export const PLACEMENT_MATCHES = 5;
export const STANDARD_K_FACTOR = 32;

/** Bring ratings toward the baseline without erasing the previous season's order. */
export function compressSeasonRating(
  currentElo: number,
  baselineElo = BASELINE_ELO,
): number {
  if (!Number.isFinite(currentElo) || !Number.isFinite(baselineElo)) {
    throw new RangeError('Season ratings must be finite numbers');
  }
  return currentElo * 0.5 + baselineElo * 0.5;
}

export function placementKFactor(remaining: number): number {
  return remaining > 0 ? STANDARD_K_FACTOR * 3 : STANDARD_K_FACTOR;
}

export function remainingPlacementsAfterMatch(remaining: number): number {
  return Math.max(0, remaining - 1);
}

export function publicSeasonRating(
  rating: number,
  remaining: number,
): number | null {
  return remaining > 0 ? null : rating;
}

export function tierForElo(
  elo: number,
):
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'DIAMOND'
  | 'MASTER'
  | 'GRANDMASTER' {
  if (elo >= 2400) return 'GRANDMASTER';
  if (elo >= 2100) return 'MASTER';
  if (elo >= 1800) return 'DIAMOND';
  if (elo >= 1600) return 'PLATINUM';
  if (elo >= 1400) return 'GOLD';
  if (elo >= 1200) return 'SILVER';
  return 'BRONZE';
}
