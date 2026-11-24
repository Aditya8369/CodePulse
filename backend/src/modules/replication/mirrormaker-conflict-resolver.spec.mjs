import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MirrorMakerConflictResolverService {
  compareClocks(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let aG = false, bG = false;
    for (const k of keys) {
      const vA = a[k] || 0, vB = b[k] || 0;
      if (vA > vB) aG = true;
      if (vB > vA) bG = true;
    }
    if (aG && !bG) return 'DOMINATES';
    if (bG && !aG) return 'DOMINATED';
    if (!aG && !bG) return 'EQUAL';
    return 'CONCURRENT';
  }
  resolveConflict(local, incoming) {
    const comp = this.compareClocks(local.vectorClock, incoming.vectorClock);
    const mergedClock = {};
    for (const k of new Set([...Object.keys(local.vectorClock), ...Object.keys(incoming.vectorClock)])) {
      mergedClock[k] = Math.max(local.vectorClock[k] || 0, incoming.vectorClock[k] || 0);
    }
    if (comp === 'DOMINATES') return { winner: local, mergedClock, resolution: 'LOCAL_ACCEPTED' };
    if (comp === 'DOMINATED') return { winner: incoming, mergedClock, resolution: 'INCOMING_ACCEPTED' };
    const winner = incoming.timestampMs >= local.timestampMs ? incoming : local;
    return { winner, mergedClock, resolution: 'CONCURRENT_LWW' };
  }
}

describe('MirrorMakerConflictResolverService (Issue #1800)', () => {
  it('should detect vector clock dominance and resolve concurrent multi-cluster divergence with LWW', () => {
    const resolver = new MirrorMakerConflictResolverService();

    // 1. Dominance test
    const c1 = { 'us-east': 2, 'eu-west': 1 };
    const c2 = { 'us-east': 1, 'eu-west': 1 };
    assert.equal(resolver.compareClocks(c1, c2), 'DOMINATES');

    // 2. Concurrent divergence test
    const localEntity = {
      entityId: 'e-1',
      vectorClock: { 'us-east': 2, 'eu-west': 1 },
      timestampMs: 1000,
      data: 'local'
    };
    const incomingEntity = {
      entityId: 'e-1',
      vectorClock: { 'us-east': 1, 'eu-west': 2 },
      timestampMs: 1050,
      data: 'incoming-newer'
    };

    const res = resolver.resolveConflict(localEntity, incomingEntity);
    assert.equal(res.resolution, 'CONCURRENT_LWW');
    assert.equal(res.winner.data, 'incoming-newer');
    assert.deepEqual(res.mergedClock, { 'us-east': 2, 'eu-west': 2 });
  });
});
