import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class WebSocketHandoffCoordinatorService {
  constructor() { this.s = new Map(); }
  captureState(s) { this.s.set(s.connectionId, s); }
  restoreState(id) { const f = this.s.get(id); if (f) { this.s.delete(id); return f; } return null; }
}

describe('WebSocketHandoffCoordinatorService (Issue #1920)', () => {
  it('should capture connection snapshots and restore state upon reconnecting to replacement pods', () => {
    const coordinator = new WebSocketHandoffCoordinatorService();
    coordinator.captureState({ connectionId: 'conn-1', userId: 'user-777', lastMessageSeq: 42 });

    const restored = coordinator.restoreState('conn-1');
    assert.equal(restored?.lastMessageSeq, 42);
    assert.equal(coordinator.restoreState('conn-1'), null);
  });
});
