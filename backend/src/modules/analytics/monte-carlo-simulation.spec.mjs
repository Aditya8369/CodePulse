import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MonteCarloSimulationService {
  simulateCompletionDays(points, velocities, n = 100) {
    const res = [];
    for (let i = 0; i < n; i++) {
      let p = points; let d = 0;
      while (p > 0) { d++; p -= velocities[Math.floor(Math.random() * velocities.length)]; }
      res.push(d);
    }
    res.sort((a, b) => a - b);
    return { p50: res[Math.floor(n * 0.5)], p90: res[Math.floor(n * 0.9)] };
  }
}

describe('MonteCarloSimulationService (Issue #1934)', () => {
  it('should run Monte Carlo simulations to estimate sprint completion percentiles', () => {
    const sim = new MonteCarloSimulationService();
    const est = sim.simulateCompletionDays(30, [5, 6, 4, 5]);

    assert.ok(est.p50 >= 5 && est.p50 <= 7);
    assert.ok(est.p90 >= est.p50);
  });
});
