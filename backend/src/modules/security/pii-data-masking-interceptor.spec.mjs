import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class PiiDataMaskingInterceptorService {
  mask(t) {
    return t.replace(/([a-zA-Z0-9_\.]+)@([a-zA-Z0-9_\.]+)/g, 'u***@domain')
            .replace(/bearer\s+[a-zA-Z0-9_\.]+/gi, 'Bearer [REDACTED]');
  }
}

describe('PiiDataMaskingInterceptorService (#2179)', () => {
  test('masks email addresses and auth tokens from operational telemetry logs', () => {
    const masker = new PiiDataMaskingInterceptorService();
    const log = masker.mask('User john.doe@example.com logged in with Bearer token_xyz123');
    assert.strictEqual(log.includes('john.doe@example.com'), false);
    assert.strictEqual(log.includes('token_xyz123'), false);
  });
});
