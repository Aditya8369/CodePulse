import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class WebhookSsrfWhitelistGuardService {
  validate(urlStr, headers) {
    try {
      const u = new URL(urlStr);
      const h = u.hostname.toLowerCase();
      if (h === 'localhost' || h.startsWith('127.') || h.startsWith('10.') || h.startsWith('192.168.') || h === '169.254.169.254') {
        return { ok: false, err: 'SSRF_BLOCKED' };
      }
      const san = {};
      const blocked = new Set(['host', 'authorization', 'cookie']);
      for (const [k, v] of Object.entries(headers)) {
        if (!blocked.has(k.toLowerCase())) san[k] = v;
      }
      return { ok: true, san };
    } catch {
      return { ok: false, err: 'INVALID_URL' };
    }
  }
}

describe('WebhookSsrfWhitelistGuardService (#2397)', () => {
  test('blocks SSRF to private subnet addresses and strips dangerous headers', () => {
    const guard = new WebhookSsrfWhitelistGuardService();
    const ssrf = guard.validate('http://169.254.169.254/latest/meta-data', {});
    assert.strictEqual(ssrf.ok, false);
    assert.strictEqual(ssrf.err, 'SSRF_BLOCKED');

    const valid = guard.validate('https://api.partner.com/webhook', {
      'X-Webhook-Signature': 'sig123',
      'Host': 'attacker.com'
    });
    assert.strictEqual(valid.ok, true);
    assert.strictEqual(valid.san['X-Webhook-Signature'], 'sig123');
    assert.strictEqual(valid.san['Host'], undefined);
  });
});
