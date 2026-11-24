import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TenantResourceQuotaGovernorService {
  constructor() { this.q = new Map(); }
  set(t, quota) { this.q.set(t, quota); }
  check(t, cpu, mem) {
    const quota = this.q.get(t);
    if (!quota) return { ok: true };
    if (cpu > quota.cpu) return { ok: false, err: 'EXCEEDED_CPU' };
    if (mem > quota.mem) return { ok: false, err: 'EXCEEDED_MEM' };
    return { ok: true };
  }
}

describe('TenantResourceQuotaGovernorService (#2382)', () => {
  test('rejects tenant execution requests exceeding allocated CPU or memory limits', () => {
    const governor = new TenantResourceQuotaGovernorService();
    governor.set('tenant-free', { cpu: 2, mem: 4096 });

    assert.strictEqual(governor.check('tenant-free', 1, 2048).ok, true);
    assert.strictEqual(governor.check('tenant-free', 4, 2048).ok, false);
    assert.strictEqual(governor.check('tenant-free', 1, 8192).ok, false);
  });
});
