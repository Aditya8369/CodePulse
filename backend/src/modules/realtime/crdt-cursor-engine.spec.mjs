import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CrdtCursorEngineService {
  constructor() { this.cursors = new Map(); this.clock = 0; }
  update(user, line, col, remote) {
    this.clock = Math.max(this.clock, remote) + 1;
    const ex = this.cursors.get(user);
    if (!ex || remote >= ex.clock) {
      const s = { user, line, col, clock: this.clock };
      this.cursors.set(user, s);
      return s;
    }
    return ex;
  }
}

describe('CrdtCursorEngineService (#2122)', () => {
  test('converges multi-user cursor updates monotonically using Lamport clocks', () => {
    const engine = new CrdtCursorEngineService();
    engine.update('u1', 10, 5, 1);
    const updated = engine.update('u1', 12, 8, 2);

    assert.strictEqual(updated.line, 12);
    assert.strictEqual(updated.col, 8);
  });
});
