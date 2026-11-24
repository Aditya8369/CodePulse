import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class TieredLeakyBucketService {
  constructor() {
    this.caps = { GUEST: 2, REGISTERED: 5, ENTERPRISE: 20 };
    this.buckets = new Map();
  }
  consume(id, tier) {
    const cap = this.caps[tier];
    const c = this.buckets.get(id) || 0;
    if (c < cap) { this.buckets.set(id, c + 1); return true; }
    return false;
  }
}

describe('TieredLeakyBucketService (Issue #1855)', () => {
  it('should enforce distinct leaky bucket capacities based on user authentication tier', () => {
    const bucket = new TieredLeakyBucketService();
    assert.equal(bucket.consume('guest-1', 'GUEST'), true);
    assert.equal(bucket.consume('guest-1', 'GUEST'), true);
    assert.equal(bucket.consume('guest-1', 'GUEST'), false, 'Guest bucket full at 2');

    assert.equal(bucket.consume('user-pro', 'REGISTERED'), true);
    assert.equal(bucket.consume('user-pro', 'REGISTERED'), true);
    assert.equal(bucket.consume('user-pro', 'REGISTERED'), true);
  });
});
