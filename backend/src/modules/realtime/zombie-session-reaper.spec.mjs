import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ZombieSessionReaperService {
  constructor() { this.h = new Map(); }
  heartbeat(id, ts = Date.now()) { this.h.set(id, ts); }
  reapZombies(timeout, now = Date.now()) {
    const z = [];
    for (const [id, ts] of this.h.entries()) {
      if (now - ts > timeout) { z.push(id); this.h.delete(id); }
    }
    return z;
  }
}

describe('ZombieSessionReaperService (Issue #1924)', () => {
  it('should reap abandoned sessions when heartbeat timeout is exceeded', () => {
    const reaper = new ZombieSessionReaperService();
    const now = 10000;
    reaper.heartbeat('alive', 9500);
    reaper.heartbeat('ghost', 2000);

    const reaped = reaper.reapZombies(3000, now);
    assert.deepEqual(reaped, ['ghost']);
  });
});
