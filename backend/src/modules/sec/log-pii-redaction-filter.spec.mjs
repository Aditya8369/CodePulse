import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class LogPIIRedactionFilterService {
  constructor() {
    this.email = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
    this.token = /(bearer\s+|token\s+)[a-zA-Z0-9._-]+/gi;
  }
  redact(msg) {
    return msg.replace(this.email, '[REDACTED_EMAIL]').replace(this.token, '$1[REDACTED_TOKEN]');
  }
}

describe('LogPIIRedactionFilterService (Issue #1851)', () => {
  it('should redact sensitive PII including email addresses and auth bearer tokens', () => {
    const filter = new LogPIIRedactionFilterService();
    const raw = 'User john.doe@example.com logged in with Bearer secret-jwt-token-xyz';
    const clean = filter.redact(raw);

    assert.equal(clean.includes('john.doe@example.com'), false);
    assert.equal(clean.includes('secret-jwt-token-xyz'), false);
    assert.equal(clean.includes('[REDACTED_EMAIL]'), true);
    assert.equal(clean.includes('[REDACTED_TOKEN]'), true);
  });
});
