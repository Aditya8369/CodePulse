import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class Glicko2DifficultyCalibratorService {
  constructor() {
    this.scale = 173.7178;
  }
  updateRating(current, competitorRating, competitorPassed) {
    const actual = competitorPassed ? 0 : 1;
    const mu = (current.rating - 1500) / this.scale;
    const phi = current.rd / this.scale;
    const oppMu = (competitorRating - 1500) / this.scale;
    const oppPhi = 100 / this.scale;
    const g = 1 / Math.sqrt(1 + (3 * oppPhi * oppPhi) / (Math.PI * Math.PI));
    const exp = 1 / (1 + Math.exp(-g * (mu - oppMu)));
    const v = 1 / (g * g * exp * (1 - exp));
    const newPhi = 1 / Math.sqrt(1 / (phi * phi) + 1 / v);
    const newMu = mu + newPhi * newPhi * (g * (actual - exp));
    return {
      challengeId: current.challengeId,
      rating: Math.round((newMu * this.scale + 1500) * 10) / 10,
      rd: Math.max(30, Math.round((newPhi * this.scale) * 10) / 10),
      volatility: current.volatility
    };
  }
}

describe('Glicko2DifficultyCalibratorService (Issue #1446)', () => {
  it('should increase challenge rating when top-tier competitors fail it', () => {
    const calibrator = new Glicko2DifficultyCalibratorService();
    const initial = { challengeId: 'ch-alg-1', rating: 1500, rd: 200, volatility: 0.06 };

    // Competitor with 2000 rating fails the challenge
    const updated = calibrator.updateRating(initial, 2000, false);
    assert.ok(updated.rating > 1500, 'Challenge rating must rise when expert fails');
    assert.ok(updated.rd < initial.rd, 'Rating deviation must narrow with more evidence');
  });

  it('should decrease challenge rating when novice passes it easily', () => {
    const calibrator = new Glicko2DifficultyCalibratorService();
    const initial = { challengeId: 'ch-easy-1', rating: 1600, rd: 150, volatility: 0.06 };

    // Competitor with 1200 rating passes
    const updated = calibrator.updateRating(initial, 1200, true);
    assert.ok(updated.rating < 1600, 'Challenge rating must decrease when novice solves it');
  });
});
