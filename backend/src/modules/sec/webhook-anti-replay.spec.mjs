import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class WebhookAntiReplayGuard {
  constructor(tol = 300000) { this.tol = tol; this.nonces = new Map(); }
  validate(nonce, ts, now = Date.now()) {
    if (Math.abs(now - ts) > this.tol) return false;
    if (this.nonces.has(nonce)) return false;
    this.nonces.set(nonce, ts);
    return true;
  }
}

describe('WebhookAntiReplayGuard (Issue #1847)', () => {
  it('should reject replayed nonces and out-of-window timestamps', () => {
    const guard = new WebhookAntiReplayGuard(60000);
    const now = 1000000;

    assert.equal(guard.validate('nonce-1', now - 10000, now), true);
    assert.equal(guard.validate('nonce-1', now - 10000, now), false, 'Duplicate nonce must be rejected');
    assert.equal(guard.validate('nonce-2', now - 70000, now), false, 'Expired timestamp must be rejected');
  });
});
