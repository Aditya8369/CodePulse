import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RedisSentinelFailoverManagerService {
  eval(acks, total) {
    const req = Math.floor(total / 2) + 1;
    return { ok: acks >= req };
  }
}

describe('RedisSentinelFailoverManagerService (#2224)', () => {
  test('validates strict majority sentinel consensus before electing new master', () => {
    const mgr = new RedisSentinelFailoverManagerService();
    assert.strictEqual(mgr.eval(2, 3).ok, true);
    assert.strictEqual(mgr.eval(1, 3).ok, false);
  });
});
