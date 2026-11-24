import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class NodeDrainCoordinatorService {
  constructor(maxDrainWaitMs = 500) {
    this.maxDrainWaitMs = maxDrainWaitMs;
    this.activeBattles = new Map();
    this.isCordoned = false;
  }
  registerBattle(id) {
    if (this.isCordoned) return false;
    this.activeBattles.set(id, true);
    return true;
  }
  completeBattle(id) {
    this.activeBattles.delete(id);
  }
  async initiateNodeDrain() {
    this.isCordoned = true;
    const start = Date.now();
    while (this.activeBattles.size > 0 && (Date.now() - start) < this.maxDrainWaitMs) {
      await new Promise(r => setTimeout(r, 20));
    }
    return { drainedCleanly: this.activeBattles.size === 0, activeBattlesRemaining: this.activeBattles.size };
  }
}

describe('NodeDrainCoordinatorService (Issue #1435)', () => {
  it('should cordon node and hold drain until active battles finish naturally', async () => {
    const coordinator = new NodeDrainCoordinatorService(1000);
    coordinator.registerBattle('battle-101');
    coordinator.registerBattle('battle-102');

    // Start background drain
    const drainPromise = coordinator.initiateNodeDrain();

    // Node is now cordoned, new battle assignment must be rejected
    const accepted = coordinator.registerBattle('battle-103');
    assert.equal(accepted, false);

    // Complete in-progress battles after 50ms
    setTimeout(() => {
      coordinator.completeBattle('battle-101');
      coordinator.completeBattle('battle-102');
    }, 50);

    const result = await drainPromise;
    assert.equal(result.drainedCleanly, true);
    assert.equal(result.activeBattlesRemaining, 0);
  });
});
