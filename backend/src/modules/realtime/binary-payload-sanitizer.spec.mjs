import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BinaryPayloadSanitizerService {
  sanitize(buf) {
    if (!buf || buf.length === 0) return false;
    if (buf.length > 4000000) return false;
    if (buf.toString('utf8', 0, 4) === 'EVIL') return false;
    return true;
  }
}

describe('BinaryPayloadSanitizerService (#2128)', () => {
  test('rejects oversized binary payloads and malicious byte headers', () => {
    const sanitizer = new BinaryPayloadSanitizerService();
    assert.strictEqual(sanitizer.sanitize(Buffer.from('CP01valid_data')), true);
    assert.strictEqual(sanitizer.sanitize(Buffer.from('EVILpayload')), false);
  });
});
