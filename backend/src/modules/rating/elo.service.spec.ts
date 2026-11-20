import { EloService } from './elo.service';

describe('EloService - Competitive Glicko-2 / Elo Rating Calculations', () => {
  let service: EloService;

  beforeEach(() => {
    service = new EloService();
  });

  it('calculates equal win probabilities for equal ratings (50% each)', () => {
    const expected = service.calculateExpectedScore(1200, 1200);
    expect(expected).toBeCloseTo(0.5, 2);
  });

  it('calculates higher expected probability for a higher rated player', () => {
    const expected = service.calculateExpectedScore(1600, 1200);
    expect(expected).toBeGreaterThan(0.9);
  });

  it('uses K=40 for provisional placement matches and awards higher delta', () => {
    const playerA = {
      userId: 'user_a',
      eloRating: 1200,
      ratingDeviation: 350,
      volatility: 0.06,
      placementMatchesRemaining: 5,
      peakRating: 1200,
    };

    const playerB = {
      userId: 'user_b',
      eloRating: 1200,
      ratingDeviation: 350,
      volatility: 0.06,
      placementMatchesRemaining: 0,
      peakRating: 1200,
    };

    const result = service.computeMatchResult(playerA, playerB, 'user_a');
    expect(result.deltaA).toBe(20); // 40 * 0.5
    expect(result.deltaB).toBe(-10); // 20 * (0 - 0.5)
  });

  it('applies seasonal decay for players inactive > 30 days', () => {
    const decayed = service.applyInactivityDecay(1800, 45);
    expect(decayed).toBeLessThan(1800);
  });

  it('does not decay ratings at or below 1200 threshold', () => {
    const decayed = service.applyInactivityDecay(1200, 60);
    expect(decayed).toBe(1200);
  });
});
