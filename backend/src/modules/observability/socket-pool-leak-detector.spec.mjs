import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SocketPoolLeakDetectorService {
  constructor() { this.s = new Map(); }
  registerSocket(id, ts = Date.now()) { this.s.set(id, ts); }
  disconnectSocket(id) { this.s.delete(id); }
  detectZombies(maxMs, now = Date.now()) {
    const z = [];
    for (const [id, ts] of this.s.entries()) if (now - ts > maxMs) z.push(id);
    return z;
  }
}

describe('SocketPoolLeakDetectorService (Issue #1905)', () => {
  it('should track WebSocket connection lifetimes and identify zombie connections', () => {
    const detector = new SocketPoolLeakDetectorService();
    const now = 10000;
    detector.registerSocket('sock-active', 9000);
    detector.registerSocket('sock-zombie', 2000);

    const zombies = detector.detectZombies(5000, now);
    assert.deepEqual(zombies, ['sock-zombie']);
  });
});
