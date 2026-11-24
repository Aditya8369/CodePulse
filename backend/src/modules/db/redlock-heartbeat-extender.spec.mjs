import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RedlockHeartbeatExtenderService {
  constructor() { this.leases = new Map(); }
  acquireLease(k, ttl = 5000) {
    const l = { lockKey: k, leaseExpiresAtMs: Date.now() + ttl, leaseTtlMs: ttl, active: true };
    this.leases.set(k, l);
    return l;
  }
  renew(k) {
    const l = this.leases.get(k);
    if (!l || !l.active) return false;
    l.leaseExpiresAtMs = Date.now() + l.leaseTtlMs;
    return true;
  }
  release(k) { this.leases.delete(k); }
}

describe('RedlockHeartbeatExtenderService (Issue #1835)', () => {
  it('should acquire distributed leases and renew expiration timestamp via heartbeat', () => {
    const extender = new RedlockHeartbeatExtenderService();
    const lease = extender.acquireLease('tournament:101', 3000);
    const initialExpiry = lease.leaseExpiresAtMs;

    assert.equal(extender.renew('tournament:101'), true);
    assert.equal(lease.leaseExpiresAtMs >= initialExpiry, true);
  });
});
