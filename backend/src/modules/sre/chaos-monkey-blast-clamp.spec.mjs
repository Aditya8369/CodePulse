import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ChaosMonkeyBlastClampService {
  clamp(total, req) {
    const max = Math.floor(total * 0.2);
    const allowed = Math.min(req, max);
    return { allowed, clamped: allowed < req };
  }
}

describe('ChaosMonkeyBlastClampService (#2222)', () => {
  test('clamps synthetic chaos monkey terminations to prevent cluster collapse', () => {
    const clamp = new ChaosMonkeyBlastClampService();
    const res1 = clamp.clamp(10, 1);
    assert.strictEqual(res1.clamped, false);
    assert.strictEqual(res1.allowed, 1);

    const res2 = clamp.clamp(10, 5);
    assert.strictEqual(res2.clamped, true);
    assert.strictEqual(res2.allowed, 2);
  });
});
