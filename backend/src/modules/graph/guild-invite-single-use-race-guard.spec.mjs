import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GuildInviteSingleUseRaceGuardService {
  constructor() { this.t = new Map(); }
  create(tok, ttl) { this.t.set(tok, { used: false, exp: Date.now() + ttl }); }
  consume(tok) {
    const r = this.t.get(tok);
    if (!r) return { ok: false, err: 'NOT_FOUND' };
    if (Date.now() > r.exp) return { ok: false, err: 'EXPIRED' };
    if (r.used) return { ok: false, err: 'ALREADY_USED' };
    r.used = true;
    return { ok: true };
  }
}

describe('GuildInviteSingleUseRaceGuardService (#2371)', () => {
  test('ensures atomic single consumption of guild invite tokens', () => {
    const guard = new GuildInviteSingleUseRaceGuardService();
    guard.create('tok_123', 5000);

    const first = guard.consume('tok_123');
    assert.strictEqual(first.ok, true);

    const second = guard.consume('tok_123');
    assert.strictEqual(second.ok, false);
    assert.strictEqual(second.err, 'ALREADY_USED');
  });
});
