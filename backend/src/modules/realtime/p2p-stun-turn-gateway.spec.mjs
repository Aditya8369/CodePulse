import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class P2pStunTurnGatewayService {
  getIce(force) {
    if (force) return [{ urls: ['turn:codepulse'] }];
    return [{ urls: ['stun:google'] }, { urls: ['turn:codepulse'] }];
  }
}

describe('P2pStunTurnGatewayService (#2131)', () => {
  test('returns primary STUN servers with automated TURN fallback for restrictive NAT', () => {
    const gw = new P2pStunTurnGatewayService();
    assert.strictEqual(gw.getIce(false).length, 2);
    assert.strictEqual(gw.getIce(true).length, 1);
  });
});
