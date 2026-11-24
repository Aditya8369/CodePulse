import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MultiTenantDataGuardMiddleware {
  injectTenantFilter(q, tid) {
    if (!tid) throw new Error('Missing tenant');
    return { ...q, where: { ...(q.where || {}), tenantId: tid } };
  }
}

describe('MultiTenantDataGuardMiddleware (Issue #1857)', () => {
  it('should enforce tenantId predicate injection into database query filters', () => {
    const guard = new MultiTenantDataGuardMiddleware();
    const query = { where: { active: true } };
    const secured = guard.injectTenantFilter(query, 'tenant-acme');

    assert.deepEqual(secured.where, { active: true, tenantId: 'tenant-acme' });
  });
});
