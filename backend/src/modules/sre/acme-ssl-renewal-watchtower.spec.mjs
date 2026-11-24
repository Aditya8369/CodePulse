import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AcmeSslRenewalWatchtowerService {
  check(domain, validUntil, now) {
    const days = Math.floor((validUntil - now) / 86400000);
    return { needsRenewal: days <= 30, days };
  }
}

describe('AcmeSslRenewalWatchtowerService (#2213)', () => {
  test('flags expiring certificates for automated ACME renewal challenge initiation', () => {
    const watchtower = new AcmeSslRenewalWatchtowerService();
    const now = 1000000000000;
    const okCert = now + 45 * 86400000;
    const expCert = now + 15 * 86400000;

    assert.strictEqual(watchtower.check('codepulse.io', okCert, now).needsRenewal, false);
    assert.strictEqual(watchtower.check('codepulse.io', expCert, now).needsRenewal, true);
  });
});
