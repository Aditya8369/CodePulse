import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MultiTenantKeyIsolationEnforcerService } from './arch-svc-50.service.ts';

describe('MultiTenantKeyIsolationEnforcerService (ARCH-SVC-50)', () => {
  it('enforces tenant namespace prefixes and blocks missing tenant context', () => {
    const enforcer = new MultiTenantKeyIsolationEnforcerService();
    const scoped = enforcer.enforceIsolationKey('org-123', 'profile:456');
    assert.strictEqual(scoped, 't:org-123:profile:456');

    const parsed = enforcer.extractTenantKey(scoped);
    assert.strictEqual(parsed.tenantId, 'org-123');
    assert.strictEqual(parsed.entityKey, 'profile:456');

    assert.throws(() => {
      enforcer.enforceIsolationKey('', 'key');
    }, /Tenant context missing/);
  });
});
