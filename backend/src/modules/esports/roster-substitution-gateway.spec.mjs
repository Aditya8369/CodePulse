import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RosterSubstitutionGatewayService {
  auth(subId, locked, bench) {
    if (locked) return { ok: false, reason: 'LOCKED' };
    if (!bench.includes(subId)) return { ok: false, reason: 'NOT_ON_BENCH' };
    return { ok: true };
  }
}

describe('RosterSubstitutionGatewayService (#2342)', () => {
  test('enforces official roster locks and verifies substitute bench credentials', () => {
    const gateway = new RosterSubstitutionGatewayService();
    const bench = ['subA', 'subB'];
    assert.strictEqual(gateway.auth('subA', false, bench).ok, true);
    assert.strictEqual(gateway.auth('subA', true, bench).ok, false); // Locked
    assert.strictEqual(gateway.auth('unregistered', false, bench).ok, false); // Not on bench
  });
});
