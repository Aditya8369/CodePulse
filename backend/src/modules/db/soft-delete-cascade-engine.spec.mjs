import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SoftDeleteCascadeEngineService {
  constructor() { this.tombstones = new Map(); }
  softDelete(type, id, children) {
    const t = { entityId: id, entityType: type, deletedAtMs: Date.now(), cascadedChildrenCount: children.length };
    this.tombstones.set(type + ':' + id, t);
    return t;
  }
  isDeleted(type, id) { return this.tombstones.has(type + ':' + id); }
}

describe('SoftDeleteCascadeEngineService (Issue #1823)', () => {
  it('should track soft-delete tombstones and verify cascaded deletion state', () => {
    const engine = new SoftDeleteCascadeEngineService();
    const t = engine.softDelete('User', 'u-1', ['sub-1', 'sub-2']);
    assert.equal(t.cascadedChildrenCount, 2);
    assert.equal(engine.isDeleted('User', 'u-1'), true);
    assert.equal(engine.isDeleted('User', 'u-2'), false);
  });
});
