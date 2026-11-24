import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SocketioPoolLeakTrackerService {
  constructor() { this.sockets = new Map(); }
  conn(id, t) { this.sockets.set(id, t); }
  disconn(id) { return this.sockets.delete(id); }
  ghosts(now) {
    const res = [];
    for (const [id, t] of this.sockets.entries()) {
      if (now - t > 300000) res.push(id);
    }
    return res;
  }
}

describe('SocketioPoolLeakTrackerService (#2238)', () => {
  test('tracks active socket pool handles and identifies lingering disconnections', () => {
    const tracker = new SocketioPoolLeakTrackerService();
    tracker.conn('s1', 1000);
    tracker.conn('s2', 1000000);
    assert.deepStrictEqual(tracker.ghosts(500000), ['s1']);
    assert.strictEqual(tracker.disconn('s1'), true);
  });
});
