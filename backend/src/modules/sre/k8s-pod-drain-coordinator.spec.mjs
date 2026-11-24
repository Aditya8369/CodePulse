import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class K8sPodDrainCoordinatorService {
  constructor() {
    this.phase = 'HEALTHY';
    this.matches = new Set();
  }
  reg(id) {
    if (this.phase !== 'HEALTHY') throw new Error('draining');
    this.matches.add(id);
  }
  drain() {
    this.phase = this.matches.size === 0 ? 'SAFE_TO_TERMINATE' : 'CHECKPOINTING';
    return this.phase;
  }
  evac(id) {
    this.matches.delete(id);
    if (this.matches.size === 0 && this.phase === 'CHECKPOINTING') this.phase = 'SAFE_TO_TERMINATE';
  }
}

describe('K8sPodDrainCoordinatorService (#2197)', () => {
  test('gracefully coordinates pod termination with match checkpoints', () => {
    const svc = new K8sPodDrainCoordinatorService();
    svc.reg('match-1');
    assert.strictEqual(svc.drain(), 'CHECKPOINTING');
    assert.throws(() => svc.reg('match-2'));
    svc.evac('match-1');
    assert.strictEqual(svc.phase, 'SAFE_TO_TERMINATE');
  });
});
