import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class IdempotencyKeyValidatorService {
  constructor(ttl = 1000) { this.cache = new Map(); this.ttl = ttl; }
  getExisting(k) {
    const e = this.cache.get(k);
    if (!e) return null;
    if (Date.now() - e.createdAt > this.ttl) { this.cache.delete(k); return null; }
    return e.response;
  }
  store(k, r) { this.cache.set(k, { response: r, createdAt: Date.now() }); }
}

describe('IdempotencyKeyValidatorService (Issue #1831)', () => {
  it('should store and return cached responses for idempotency keys within TTL', () => {
    const validator = new IdempotencyKeyValidatorService(2000);
    assert.equal(validator.getExisting('idemp-1'), null);
    validator.store('idemp-1', { orderId: 101, status: 'PAID' });
    assert.deepEqual(validator.getExisting('idemp-1'), { orderId: 101, status: 'PAID' });
  });
});
