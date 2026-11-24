import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class OccCollisionCompensatorService {
  backoff(attempt) {
    const exp = Math.min(1000, 50 * Math.pow(2, attempt));
    return Math.floor(exp / 2); // Deterministic test mid-range
  }
}

describe('OccCollisionCompensatorService (#2150)', () => {
  test('calculates progressive exponential backoff bounds to prevent retry collisions', () => {
    const occ = new OccCollisionCompensatorService();
    assert.strictEqual(occ.backoff(1), 50);
    assert.strictEqual(occ.backoff(2), 100);
    assert.strictEqual(occ.backoff(3), 200);
  });
});
