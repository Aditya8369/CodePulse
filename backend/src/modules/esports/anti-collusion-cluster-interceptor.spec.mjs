import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AntiCollusionClusterInterceptorService {
  check(a, b) {
    if (a.ip === b.ip) return { ok: false, reason: 'SHARED_IP' };
    if (a.hw === b.hw) return { ok: false, reason: 'SHARED_HW' };
    return { ok: true };
  }
}

describe('AntiCollusionClusterInterceptorService (#2332)', () => {
  test('intercepts and forbids matchups between players sharing IP or hardware signatures', () => {
    const interceptor = new AntiCollusionClusterInterceptorService();
    const legit = interceptor.check({ ip: '1.2.3.4', hw: 'hw-a' }, { ip: '5.6.7.8', hw: 'hw-b' });
    assert.strictEqual(legit.ok, true);

    const sameIp = interceptor.check({ ip: '1.2.3.4', hw: 'hw-a' }, { ip: '1.2.3.4', hw: 'hw-b' });
    assert.strictEqual(sameIp.ok, false);
    assert.strictEqual(sameIp.reason, 'SHARED_IP');
  });
});
