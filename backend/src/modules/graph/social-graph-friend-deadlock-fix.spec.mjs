import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SocialGraphFriendDeadlockFixService {
  constructor() { this.p = new Set(); }
  req(a, b) {
    if (this.p.has(`${b}->${a}`)) {
      this.p.delete(`${b}->${a}`);
      return { status: 'MUTUAL_ACCEPTED' };
    }
    this.p.add(`${a}->${b}`);
    return { status: 'REQUEST_SENT' };
  }
}

describe('SocialGraphFriendDeadlockFixService (#2354)', () => {
  test('auto-accepts concurrent mutual friend requests to eliminate cyclic deadlocks', () => {
    const fix = new SocialGraphFriendDeadlockFixService();
    const r1 = fix.req('Alice', 'Bob');
    assert.strictEqual(r1.status, 'REQUEST_SENT');

    const r2 = fix.req('Bob', 'Alice'); // Simultaneous reciprocal request
    assert.strictEqual(r2.status, 'MUTUAL_ACCEPTED');
  });
});
