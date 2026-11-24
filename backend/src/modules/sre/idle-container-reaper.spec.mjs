import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class IdleContainerReaperService {
  identifyOrphanedContainers(list, maxIdle = 1000, now = Date.now()) {
    return list.filter(c => !c.isExecuting && (now - c.lastActive > maxIdle)).map(c => c.containerId);
  }
}

describe('IdleContainerReaperService (Issue #1885)', () => {
  it('should identify orphaned idle runner containers exceeding inactivity threshold', () => {
    const reaper = new IdleContainerReaperService();
    const now = 10000;
    const containers = [
      { containerId: 'c1', isExecuting: true, lastActive: 2000 },
      { containerId: 'c2', isExecuting: false, lastActive: 9500 },
      { containerId: 'c3', isExecuting: false, lastActive: 1000 }
    ];

    const prunable = reaper.identifyOrphanedContainers(containers, 3000, now);
    assert.deepEqual(prunable, ['c3']);
  });
});
