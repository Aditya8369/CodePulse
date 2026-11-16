import {
  BASELINE_ELO,
  PLACEMENT_MATCHES,
  compressSeasonRating,
  placementKFactor,
  publicSeasonRating,
  remainingPlacementsAfterMatch,
} from './season-rating';

describe('season rating rules', () => {
  it('compresses both high and low ratings halfway toward the baseline', () => {
    expect(compressSeasonRating(2000)).toBe(1600);
    expect(compressSeasonRating(800)).toBe(1000);
    expect(compressSeasonRating(BASELINE_ELO)).toBe(BASELINE_ELO);
    expect(compressSeasonRating(1500, 1000)).toBe(1250);
  });

  it('rejects invalid ratings before a season reset writes them', () => {
    expect(() => compressSeasonRating(Number.NaN)).toThrow(RangeError);
    expect(() => compressSeasonRating(1200, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('uses a triple K-factor for five placements and reveals Elo after the fifth', () => {
    let remaining = PLACEMENT_MATCHES;
    while (remaining > 0) {
      expect(placementKFactor(remaining)).toBe(96);
      expect(publicSeasonRating(1420, remaining)).toBeNull();
      remaining = remainingPlacementsAfterMatch(remaining);
    }
    expect(remaining).toBe(0);
    expect(placementKFactor(remaining)).toBe(32);
    expect(publicSeasonRating(1420, remaining)).toBe(1420);
    expect(remainingPlacementsAfterMatch(0)).toBe(0);
  });
});
