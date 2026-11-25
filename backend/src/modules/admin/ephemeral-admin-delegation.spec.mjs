import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EphemeralAdminDelegationService {
  constructor() { this.p = new Map(); }
  grant(id, user, role, ttl) {
    const permit = { id, user, role, exp: Date.now() + ttl };
    this.p.set(id, permit);
    return permit;
  }
  valid(id, now) {
    const p = this.p.get(id);
    return p ? p.exp > now : false;
  }
}

describe('EphemeralAdminDelegationService (#2400)', () => {
  test('grants temporary admin permits that automatically expire upon TTL elapsed', () => {
    const delegation = new EphemeralAdminDelegationService();
    const permit = delegation.grant('perm-1', 'user-oncall', 'OPS_ADMIN', 1000);
    const now = Date.now();

    assert.strictEqual(delegation.valid('perm-1', now + 500), true);
    assert.strictEqual(delegation.valid('perm-1', now + 1500), false); // Expired
  });
});
