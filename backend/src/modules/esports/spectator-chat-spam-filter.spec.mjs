import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SpectatorChatSpamFilterService {
  constructor() { this.b = new Map(); }
  check(u, msg, banned = []) {
    if (banned.some(w => msg.toLowerCase().includes(w))) return { allowed: false, reason: 'TOXIC' };
    const now = Date.now();
    let h = (this.b.get(u) || []).filter(t => now - t < 5000);
    if (h.length >= 3) return { allowed: false, reason: 'RATE_LIMIT' };
    h.push(now);
    this.b.set(u, h);
    return { allowed: true };
  }
}

describe('SpectatorChatSpamFilterService (#2339)', () => {
  test('moderates spectator chat against toxic words and rapid message spamming', () => {
    const filter = new SpectatorChatSpamFilterService();
    assert.strictEqual(filter.check('user1', 'GG WP', ['toxic']).allowed, true);
    assert.strictEqual(filter.check('user1', 'You are toxic', ['toxic']).allowed, false);

    assert.strictEqual(filter.check('user2', 'msg 1').allowed, true);
    assert.strictEqual(filter.check('user2', 'msg 2').allowed, true);
    assert.strictEqual(filter.check('user2', 'msg 3').allowed, true);
    assert.strictEqual(filter.check('user2', 'msg 4').allowed, false); // rate limited
  });
});
