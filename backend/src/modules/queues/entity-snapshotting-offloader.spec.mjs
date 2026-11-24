import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EntitySnapshottingOffloaderService {
  constructor(interval = 100) { this.s = new Map(); this.inv = interval; }
  record(id, v, state) {
    if (v % this.inv === 0) {
      this.s.set(id, { v, state, time: Date.now() });
      return true;
    }
    return false;
  }
  get(id) { return this.s.get(id) || null; }
}

describe('EntitySnapshottingOffloaderService (#2308)', () => {
  test('takes periodic state snapshots at configured version intervals', () => {
    const offloader = new EntitySnapshottingOffloaderService(50);
    assert.strictEqual(offloader.record('user-1', 49, { name: 'Alice' }), false);
    assert.strictEqual(offloader.record('user-1', 50, { name: 'Alice' }), true);

    const snap = offloader.get('user-1');
    assert.strictEqual(snap?.v, 50);
    assert.deepStrictEqual(snap?.state, { name: 'Alice' });
  });
});
