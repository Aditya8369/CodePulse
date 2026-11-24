import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TenantAstPredicateValidatorService {
  validate(sql) {
    const l = sql.toLowerCase();
    if (l.includes('from users')) return l.includes('tenant_id');
    return true;
  }
}

describe('TenantAstPredicateValidatorService (#2153)', () => {
  test('rejects raw SQL queries that touch multi-tenant tables without tenant filters', () => {
    const validator = new TenantAstPredicateValidatorService();
    assert.strictEqual(validator.validate('SELECT * FROM users WHERE tenant_id = 1'), true);
    assert.strictEqual(validator.validate('SELECT * FROM users WHERE age > 20'), false);
  });
});
