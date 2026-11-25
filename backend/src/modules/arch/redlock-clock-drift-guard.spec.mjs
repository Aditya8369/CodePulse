import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RedlockClockDriftGuardService {
  validity(ttl, duration) {
    const drift = Math.round(ttl * 0.01) + 2;
    const rem = ttl - duration - drift;
    return { ok: rem > 0, rem: Math.max(0, rem) };
  }
}

describe('RedlockClockDriftGuardService (#2713)', () => {
  test('disallows distributed lock lease if acquisition time exceeds validity minus clock drift', () => {
    const guard = new RedlockClockDriftGuardService();
    const good = guard.validity(1000, 100);
    assert.strictEqual(good.ok, true);
    assert.ok(good.rem > 800);

    const expired = guard.validity(1000, 995);
    assert.strictEqual(expired.ok, false);
    assert.strictEqual(expired.rem, 0);
  });
});
