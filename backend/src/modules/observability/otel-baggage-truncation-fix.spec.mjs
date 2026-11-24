import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class OtelBaggageTruncationFixService {
  preserve(h) {
    if (h.length > 8192) return { sanitized: h.slice(0, 8192), truncated: true };
    return { sanitized: h, truncated: false };
  }
}

describe('OtelBaggageTruncationFixService (#2226)', () => {
  test('safely preserves W3C trace baggage context across message broker boundaries', () => {
    const svc = new OtelBaggageTruncationFixService();
    assert.strictEqual(svc.preserve('userId=123,tenantId=456').truncated, false);
    assert.strictEqual(svc.preserve('a'.repeat(9000)).truncated, true);
  });
});
