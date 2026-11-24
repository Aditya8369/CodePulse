import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

class TOTPAuthEngineService {
  generateCode(secret, counter) {
    const hmac = crypto.createHmac('sha1', Buffer.from(secret));
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter), 0);
    hmac.update(buf);
    const digest = hmac.digest();
    const offset = digest[digest.length - 1] & 0xf;
    const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
    return String(code).padStart(6, '0');
  }
  verify(secret, code, counter, drift = 1) {
    for (let d = -drift; d <= drift; d++) {
      if (this.generateCode(secret, counter + d) === code) return true;
    }
    return false;
  }
}

describe('TOTPAuthEngineService (Issue #1856)', () => {
  it('should generate RFC 6238 compliant 6-digit codes and verify with clock drift tolerance', () => {
    const totp = new TOTPAuthEngineService();
    const secret = 'MYSECRETKEY12345';
    const code = totp.generateCode(secret, 500);

    assert.equal(code.length, 6);
    assert.equal(totp.verify(secret, code, 500), true);
    assert.equal(totp.verify(secret, code, 501), true, 'Should accept 1 step drift');
    assert.equal(totp.verify(secret, code, 505), false, 'Should reject excessive drift');
  });
});
