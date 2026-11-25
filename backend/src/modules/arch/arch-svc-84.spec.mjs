import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StorageQuotaEnforcementEngineService } from './arch-svc-84.service.ts';

describe('StorageQuotaEnforcementEngineService (ARCH-SVC-84)', () => {
  it('enforces multi-tenant storage quotas and blocks writes exceeding hard caps', () => {
    const quota = new StorageQuotaEnforcementEngineService(1000);
    const r1 = quota.recordWrite('t-1', 800);
    assert.strictEqual(r1.allowed, true);
    assert.strictEqual(r1.remainingBytes, 200);

    const r2 = quota.recordWrite('t-1', 300); // exceeds cap
    assert.strictEqual(r2.allowed, false);
    assert.strictEqual(r2.remainingBytes, 200);
  });
});
