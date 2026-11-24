import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class EloInactivityDecayService {
  calculateDecayedRating(rating, days, decay = 2) {
    if (days <= 14) return rating;
    return Math.max(1000, rating - ((days - 14) * decay));
  }
}

describe('EloInactivityDecayService (Issue #1928)', () => {
  it('should preserve ratings during grace period and apply daily decay thereafter', () => {
    const decay = new EloInactivityDecayService();
    assert.equal(decay.calculateDecayedRating(2000, 10), 2000);
    assert.equal(decay.calculateDecayedRating(2000, 19, 5), 1975); // 5 days * 5
  });
});
