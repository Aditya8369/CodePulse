import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class Glicko2StarvationRingSolverService {
  window(rating, waitSec, base = 50, rate = 5, max = 300) {
    const rad = Math.min(max, base + waitSec * rate);
    return { min: Math.max(0, rating - rad), max: rating + rad, rad };
  }
}

describe('Glicko2StarvationRingSolverService (#2318)', () => {
  test('expands search radius dynamically to prevent high-MMR queue starvation', () => {
    const solver = new Glicko2StarvationRingSolverService();
    const w0 = solver.window(2000, 0);
    assert.strictEqual(w0.rad, 50);
    assert.strictEqual(w0.min, 1950);
    assert.strictEqual(w0.max, 2050);

    const w10 = solver.window(2000, 10);
    assert.strictEqual(w10.rad, 100);
    assert.strictEqual(w10.min, 1900);
    assert.strictEqual(w10.max, 2100);
  });
});
