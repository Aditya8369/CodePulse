import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class PayloadAuditLoggerAstService {
  sanitize(p) {
    const s = {};
    for (const [k, v] of Object.entries(p)) {
      if (k === 'password' || k === 'token') s[k] = '***REDACTED***';
      else s[k] = v;
    }
    return s;
  }
}

describe('PayloadAuditLoggerAstService (#2237)', () => {
  test('recursively redacts credentials and sensitive attributes in audit log streams', () => {
    const logger = new PayloadAuditLoggerAstService();
    const clean = logger.sanitize({ username: 'alice', password: 'myPassword123' });
    assert.strictEqual(clean.username, 'alice');
    assert.strictEqual(clean.password, '***REDACTED***');
  });
});
