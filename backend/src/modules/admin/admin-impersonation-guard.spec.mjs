import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AdminImpersonationGuardService {
  constructor() { this.s = new Map(); }
  start(id, admin, user, ttl = 5000) {
    const sess = { id, admin, user, revoked: false, exp: Date.now() + ttl };
    this.s.set(id, sess);
    return sess;
  }
  revoke(id) {
    const sess = this.s.get(id);
    if (!sess) return false;
    sess.revoked = true;
    return true;
  }
  validate(id) {
    const sess = this.s.get(id);
    if (!sess || sess.revoked || Date.now() > sess.exp) return false;
    return true;
  }
}

describe('AdminImpersonationGuardService (#2389)', () => {
  test('manages ephemeral impersonation leases and enforces immediate revocation', () => {
    const guard = new AdminImpersonationGuardService();
    guard.start('sess-123', 'admin-super', 'user-target');
    assert.strictEqual(guard.validate('sess-123'), true);

    guard.revoke('sess-123');
    assert.strictEqual(guard.validate('sess-123'), false);
  });
});
