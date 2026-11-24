import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EloInactivityDecayCalibratorService {
  eval(elo, days, grace = 14, decayRate = 10, floor = 1000) {
    if (days <= grace || elo <= floor) return { elo, loss: 0, decayed: false };
    const loss = Math.min(elo - floor, (days - grace) * decayRate);
    return { elo: elo - loss, loss, decayed: loss > 0 };
  }
}

describe('EloInactivityDecayCalibratorService (#2319)', () => {
  test('calculates Elo inactivity decay while respecting grace periods and tier floors', () => {
    const calibrator = new EloInactivityDecayCalibratorService();
    const active = calibrator.eval(1800, 10, 14, 10, 1000);
    assert.strictEqual(active.decayed, false);
    assert.strictEqual(active.elo, 1800);

    const inactive = calibrator.eval(1800, 20, 14, 10, 1000); // 6 days * 10 = 60 pts
    assert.strictEqual(inactive.decayed, true);
    assert.strictEqual(inactive.loss, 60);
    assert.strictEqual(inactive.elo, 1740);
  });
});
