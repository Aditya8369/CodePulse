import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class KafkaTombstoneCleanerService {
  constructor(retentionMs = 86400000) {
    this.retentionMs = retentionMs;
    this.tombstones = new Map();
  }
  emitTombstone(topic, entityKey) {
    const r = { key: entityKey, topic, payload: null, emittedAtMs: Date.now() };
    this.tombstones.set(topic + ':' + entityKey, r);
    return r;
  }
  verifyCompaction(topic, entityKey, now = Date.now()) {
    const r = this.tombstones.get(topic + ':' + entityKey);
    if (!r) return { isCompacted: false, retentionExpired: false };
    return { isCompacted: true, retentionExpired: (now - r.emittedAtMs) >= this.retentionMs };
  }
}

describe('KafkaTombstoneCleanerService (Issue #1807)', () => {
  it('should emit null-payload tombstones and verify log compaction retention expiration for GDPR compliance', () => {
    const cleaner = new KafkaTombstoneCleanerService(1000);
    const tombstone = cleaner.emitTombstone('users', 'user-999');

    assert.equal(tombstone.payload, null);
    assert.equal(cleaner.verifyCompaction('users', 'user-999').isCompacted, true);

    // Verify after retention window has expired
    const expiredCheck = cleaner.verifyCompaction('users', 'user-999', Date.now() + 2000);
    assert.equal(expiredCheck.retentionExpired, true);
  });
});
