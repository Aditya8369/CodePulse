import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MonteCarloGuildSprintSimulatorService {
  sim(rem, hist, days, trials = 500) {
    let succ = 0, tot = 0;
    for (let t = 0; t < trials; t++) {
      let p = 0;
      for (let d = 0; d < days; d++) {
        p += hist[Math.floor(Math.random() * hist.length)];
      }
      tot += p;
      if (p >= rem) succ++;
    }
    return { pct: Math.round((succ / trials) * 100), exp: Math.round(tot / trials) };
  }
}

describe('MonteCarloGuildSprintSimulatorService (#2355)', () => {
  test('simulates sprint completion probability across random historical velocity trials', () => {
    const sim = new MonteCarloGuildSprintSimulatorService();
    const res = sim.sim(50, [10, 10, 10], 5); // 10 pts/day * 5 days = exactly 50
    assert.strictEqual(res.pct, 100);
    assert.strictEqual(res.exp, 50);

    const impossible = sim.sim(100, [10, 10], 5); // 50 pts vs 100 remaining
    assert.strictEqual(impossible.pct, 0);
  });
});
