import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ReconnectionNonceGuardService {
  constructor() { this.tickets = new Map(); }
  issue(u) { const n = 'nonce-' + u; this.tickets.set(n, { u, used: false }); return n; }
  consume(n, u) {
    const t = this.tickets.get(n);
    if (!t || t.used || t.u !== u) return false;
    t.used = true;
    this.tickets.delete(n);
    return true;
  }
}

describe('ReconnectionNonceGuardService (#2125)', () => {
  test('authorizes single-use reconnection nonce and rejects replay hijacking', () => {
    const guard = new ReconnectionNonceGuardService();
    const nonce = guard.issue('user-1');

    assert.strictEqual(guard.consume(nonce, 'user-1'), true);
    assert.strictEqual(guard.consume(nonce, 'user-1'), false); // Replay attack fails
  });
});
