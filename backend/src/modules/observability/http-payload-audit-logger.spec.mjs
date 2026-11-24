import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class HTTPPayloadAuditLoggerService {
  constructor() { this.keys = new Set(['password', 'token']); }
  maskPayload(p) {
    const res = {};
    for (const [k, v] of Object.entries(p)) {
      if (this.keys.has(k.toLowerCase())) res[k] = '***MASKED***';
      else if (typeof v === 'object' && v !== null) res[k] = this.maskPayload(v);
      else res[k] = v;
    }
    return res;
  }
}

describe('HTTPPayloadAuditLoggerService (Issue #1904)', () => {
  it('should mask sensitive credential keys recursively in HTTP payload audits', () => {
    const logger = new HTTPPayloadAuditLoggerService();
    const raw = { username: 'dipak', password: 'secret123', meta: { token: 'xyz' } };
    const masked = logger.maskPayload(raw);

    assert.equal(masked.username, 'dipak');
    assert.equal(masked.password, '***MASKED***');
    assert.equal(masked.meta.token, '***MASKED***');
  });
});
