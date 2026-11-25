import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CryptographicAuditTrailService } from './arch-svc-54.service.ts';

describe('CryptographicAuditTrailService (ARCH-SVC-54)', () => {
  it('appends audit events and verifies cryptographically chained SHA-256 hashes', () => {
    const audit = new CryptographicAuditTrailService();
    audit.appendEvent({ action: 'USER_LOGIN', userId: 'u-1' });
    audit.appendEvent({ action: 'UPDATE_PERMISSION', role: 'ADMIN' });

    assert.strictEqual(audit.blockCount, 3); // genesis + 2
    assert.strictEqual(audit.verifyIntegrity(), true);
  });
});
