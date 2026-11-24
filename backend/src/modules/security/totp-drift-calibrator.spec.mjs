import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TotpDriftCalibratorService {
  steps(ts, d = 1) {
    const s = Math.floor(ts / 30000);
    const r = [];
    for (let i = -d; i <= d; i++) r.push(s + i);
    return r;
  }
}

describe('TotpDriftCalibratorService (#2193)', () => {
  test('calibrates TOTP time-step verification with +/- 1 sliding step drift window', () => {
    const cal = new TotpDriftCalibratorService();
    const steps = cal.steps(60000, 1); // step 2
    assert.strictEqual(steps.length, 3);
    assert.strictEqual(steps[1], 2);
    assert.strictEqual(steps[0], 1);
    assert.strictEqual(steps[2], 3);
  });
});
