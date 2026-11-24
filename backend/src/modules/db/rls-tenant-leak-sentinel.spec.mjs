import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RlsTenantLeakSentinelService {
  validate(sql, tenant) {
    if (!tenant) return false;
    const l = sql.toLowerCase();
    return l.includes('tenant_id') || l.includes('current_setting');
  }
}

describe('RlsTenantLeakSentinelService (#2138)', () => {
  test('flags queries lacking tenant isolation predicates to prevent cross-tenant data leaks', () => {
    const sentinel = new RlsTenantLeakSentinelService();
    assert.strictEqual(sentinel.validate('SELECT * FROM users WHERE tenant_id = 123', 't-1'), true);
    assert.strictEqual(sentinel.validate('SELECT * FROM users', 't-1'), false);
  });
});
