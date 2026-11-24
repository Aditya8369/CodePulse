import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class WebsocketHeartbeatReaperService {
  constructor() {
    this.sessions = new Map();
    this.timeoutMs = 30000;
  }
  registerSession(id, socketId, userId, now = Date.now()) {
    this.sessions.set(id, { id, last: now, missed: 0 });
  }
  recordHeartbeat(id, now = Date.now()) {
    const s = this.sessions.get(id);
    if (s) { s.last = now; s.missed = 0; }
  }
  sweepZombies(now) {
    const reaped = [];
    for (const [id, s] of this.sessions.entries()) {
      if (now - s.last > this.timeoutMs) {
        reaped.push(id);
        this.sessions.delete(id);
      }
    }
    return reaped;
  }
}

describe('WebsocketHeartbeatReaperService (#2110)', () => {
  test('reaps silent zombie sockets after heartbeat window expiration', () => {
    const reaper = new WebsocketHeartbeatReaperService();
    const t0 = 1000000;
    reaper.registerSession('sess-active', 'sock-1', 'user-1', t0);
    reaper.registerSession('sess-zombie', 'sock-2', 'user-2', t0);

    reaper.recordHeartbeat('sess-active', t0 + 20000);
    const dead = reaper.sweepZombies(t0 + 35000);

    assert.strictEqual(dead.length, 1);
    assert.strictEqual(dead[0], 'sess-zombie');
    assert.strictEqual(reaper.sessions.has('sess-active'), true);
  });
});
