import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class GracefulShutdownCoordinatorService {
  constructor() { this.hooks = []; this.shuttingDown = false; }
  registerHook(name, prio, hook) {
    this.hooks.push({ name, prio, hook });
    this.hooks.sort((a, b) => b.prio - a.prio);
  }
  async initiateShutdown() {
    this.shuttingDown = true;
    const completed = [];
    for (const h of this.hooks) {
      await h.hook();
      completed.push(h.name);
    }
    return { completed };
  }
}

describe('GracefulShutdownCoordinatorService (Issue #1867)', () => {
  it('should execute registered shutdown hooks in priority order', async () => {
    const coordinator = new GracefulShutdownCoordinatorService();
    const sequence = [];

    coordinator.registerHook('close-db', 10, async () => { sequence.push('db'); });
    coordinator.registerHook('drain-http', 100, async () => { sequence.push('http'); });
    coordinator.registerHook('drain-ws', 50, async () => { sequence.push('ws'); });

    const res = await coordinator.initiateShutdown();
    assert.deepEqual(sequence, ['http', 'ws', 'db']);
    assert.equal(res.completed.length, 3);
  });
});
