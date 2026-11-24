import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class K8sNodeDrainCoordinatorService {
  constructor() { this.matches = new Set(); }
  registerMatch(id) { this.matches.add(id); }
  completeMatch(id) { this.matches.delete(id); }
  canDrain() { return this.matches.size === 0; }
}

describe('K8sNodeDrainCoordinatorService (Issue #1880)', () => {
  it('should defer Kubernetes pod eviction until active live matches reach completion', () => {
    const coordinator = new K8sNodeDrainCoordinatorService();
    assert.equal(coordinator.canDrain(), true);

    coordinator.registerMatch('match-101');
    assert.equal(coordinator.canDrain(), false, 'Drain must be blocked while match active');

    coordinator.completeMatch('match-101');
    assert.equal(coordinator.canDrain(), true, 'Drain permitted once active matches clear');
  });
});
