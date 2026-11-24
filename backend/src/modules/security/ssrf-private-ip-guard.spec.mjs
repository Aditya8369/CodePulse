import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SsrfPrivateIpGuardService {
  check(urlStr) {
    try {
      const u = new URL(urlStr);
      if (u.hostname === 'localhost' || u.hostname === '169.254.169.254' || u.hostname.startsWith('192.168.')) return false;
      return u.protocol === 'https:';
    } catch { return false; }
  }
}

describe('SsrfPrivateIpGuardService (#2178)', () => {
  test('blocks SSRF attempts to AWS metadata IP and local networks', () => {
    const guard = new SsrfPrivateIpGuardService();
    assert.strictEqual(guard.check('http://169.254.169.254/latest/meta-data'), false);
    assert.strictEqual(guard.check('http://localhost:8080/admin'), false);
    assert.strictEqual(guard.check('https://api.github.com/webhook'), true);
  });
});
