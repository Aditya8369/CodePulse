import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GuildSoulboundBadgeVerifierService {
  constructor() { this.b = new Map(); }
  mint(id, user) {
    this.b.set(id, { id, user });
    return true;
  }
  transfer(id, from, to) {
    return { ok: false, err: 'NON_TRANSFERABLE_SOULBOUND' };
  }
}

describe('GuildSoulboundBadgeVerifierService (#2369)', () => {
  test('mints soulbound achievement badges and strictly prohibits transfers', () => {
    const verifier = new GuildSoulboundBadgeVerifierService();
    assert.strictEqual(verifier.mint('badge-01', 'dev-1'), true);
    const res = verifier.transfer('badge-01', 'dev-1', 'dev-2');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.err, 'NON_TRANSFERABLE_SOULBOUND');
  });
});
