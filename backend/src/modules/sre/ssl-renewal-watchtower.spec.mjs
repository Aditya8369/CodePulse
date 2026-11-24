import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SSLRenewalWatchtowerService {
  checkCertificateExpiry(validTo, threshDays = 30) {
    const days = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return { needsRenewal: days <= threshDays, daysRemaining: days };
  }
}

describe('SSLRenewalWatchtowerService (Issue #1886)', () => {
  it('should flag certificates expiring within the renewal threshold', () => {
    const watchtower = new SSLRenewalWatchtowerService();
    const futureFar = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const futureSoon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    assert.equal(watchtower.checkCertificateExpiry(futureFar, 30).needsRenewal, false);
    assert.equal(watchtower.checkCertificateExpiry(futureSoon, 30).needsRenewal, true);
  });
});
