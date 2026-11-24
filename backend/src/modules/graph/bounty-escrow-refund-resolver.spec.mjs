import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BountyEscrowRefundResolverService {
  check(claimed, exp, now = Date.now()) {
    if (claimed) return { refund: false, status: 'CLAIMED' };
    if (now >= exp) return { refund: true, status: 'REFUNDED_EXPIRED' };
    return { refund: false, status: 'ACTIVE' };
  }
}

describe('BountyEscrowRefundResolverService (#2352)', () => {
  test('automatically issues escrow refunds for unclaimed bounties past expiration date', () => {
    const resolver = new BountyEscrowRefundResolverService();
    const t0 = 1000000;
    assert.strictEqual(resolver.check(false, t0, t0 - 5000).status, 'ACTIVE');
    assert.strictEqual(resolver.check(false, t0, t0 + 1).status, 'REFUNDED_EXPIRED');
    assert.strictEqual(resolver.check(true, t0, t0 + 1000).status, 'CLAIMED');
  });
});
