import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class Glicko2MatchmakingSolverService {
  computeTolerance(wait) { return Math.min(50 + Math.floor(wait / 5) * 15, 500); }
  canMatch(rA, rB, wait) { return Math.abs(rA - rB) <= this.computeTolerance(wait); }
}

describe('Glicko2MatchmakingSolverService (Issue #1919)', () => {
  it('should expand rating tolerance over time to prevent matchmaking pool starvation', () => {
    const solver = new Glicko2MatchmakingSolverService();
    // At wait = 0s, delta 80 is rejected
    assert.equal(solver.canMatch(1500, 1580, 0), false);
    // At wait = 15s (tolerance = 50 + 3*15 = 95), delta 80 is accepted
    assert.equal(solver.canMatch(1500, 1580, 15), true);
  });
});
