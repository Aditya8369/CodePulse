import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ReadReplicaLagBalancerService {
  constructor(maxLag = 500) { this.maxLag = maxLag; this.replicas = new Map(); }
  registerReplica(r) { this.replicas.set(r.id, r); }
  selectTarget(isWrite) {
    if (isWrite) return 'primary-db';
    const valid = Array.from(this.replicas.values()).filter(r => r.healthy && r.lagMs <= this.maxLag).sort((a, b) => a.lagMs - b.lagMs);
    return valid.length > 0 ? valid[0].id : 'primary-db';
  }
}

describe('ReadReplicaLagBalancerService (Issue #1821)', () => {
  it('should route reads to least lagging replica and fallback to primary during high lag', () => {
    const balancer = new ReadReplicaLagBalancerService(500);
    balancer.registerReplica({ id: 'rep-1', lagMs: 100, healthy: true });
    balancer.registerReplica({ id: 'rep-2', lagMs: 600, healthy: true }); // Exceeds 500ms

    assert.equal(balancer.selectTarget(false), 'rep-1');
    assert.equal(balancer.selectTarget(true), 'primary-db');

    balancer.registerReplica({ id: 'rep-1', lagMs: 700, healthy: true });
    assert.equal(balancer.selectTarget(false), 'primary-db', 'Should fallback to primary when all replicas lag');
  });
});
