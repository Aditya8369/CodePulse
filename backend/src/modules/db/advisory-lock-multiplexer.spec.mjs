import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class AdvisoryLockMultiplexerService {
  constructor() { this.held = new Set(); }
  hashKey(ns, res) { return ns + ':' + res; }
  tryAcquire(ns, res) {
    const k = this.hashKey(ns, res);
    if (this.held.has(k)) return false;
    this.held.add(k);
    return true;
  }
  release(ns, res) { this.held.delete(this.hashKey(ns, res)); }
}

describe('AdvisoryLockMultiplexerService (Issue #1819)', () => {
  it('should acquire and release advisory locks without collision', () => {
    const mux = new AdvisoryLockMultiplexerService();
    assert.equal(mux.tryAcquire('leaderboard', 'tourn-1'), true);
    assert.equal(mux.tryAcquire('leaderboard', 'tourn-1'), false, 'Duplicate acquire must be rejected');
    mux.release('leaderboard', 'tourn-1');
    assert.equal(mux.tryAcquire('leaderboard', 'tourn-1'), true);
  });
});
