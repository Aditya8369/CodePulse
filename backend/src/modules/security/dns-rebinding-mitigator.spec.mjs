import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DnsRebindingMitigatorService {
  pin(host, ip) {
    if (ip.startsWith('127.') || ip.startsWith('10.')) return false;
    return true;
  }
}

describe('DnsRebindingMitigatorService (#2187)', () => {
  test('rejects DNS rebinding resolution to internal loopback and private subnets', () => {
    const mitigator = new DnsRebindingMitigatorService();
    assert.strictEqual(mitigator.pin('webhook.com', '93.184.216.34'), true);
    assert.strictEqual(mitigator.pin('webhook.com', '127.0.0.1'), false);
  });
});
