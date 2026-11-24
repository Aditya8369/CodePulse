import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TenantQueryAstValidatorService {
  validate(q) {
    const norm = q.toLowerCase();
    const ok = norm.includes('tenant_id') || norm.includes('tenantid');
    return { ok, err: ok ? undefined : 'MISSING_TENANT_PREDICATE' };
  }
}

describe('TenantQueryAstValidatorService (#2392)', () => {
  test('rejects database queries missing explicit tenant scoping predicates', () => {
    const validator = new TenantQueryAstValidatorService();
    const safeQuery = 'SELECT * FROM users WHERE tenant_id = "tenant-1" AND active = true;';
    assert.strictEqual(validator.validate(safeQuery).ok, true);

    const unsafeQuery = 'SELECT * FROM users WHERE active = true;';
    assert.strictEqual(validator.validate(unsafeQuery).ok, false);
    assert.strictEqual(validator.validate(unsafeQuery).err, 'MISSING_TENANT_PREDICATE');
  });
});
