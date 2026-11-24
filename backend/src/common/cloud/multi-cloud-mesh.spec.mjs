import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MultiCloudMeshService {
  constructor() { this.nodes = new Map(); }
  registerNode(n) { this.nodes.set(n.id, n); }
  updateNodeHealth(id, isHealthy, latencyMs) {
    const n = this.nodes.get(id);
    if (n) { n.isHealthy = isHealthy; n.latencyMs = latencyMs; }
  }
  routeRequest(pref = 'AWS') {
    const healthy = Array.from(this.nodes.values()).filter(n => n.isHealthy);
    if (healthy.length === 0) throw new Error('Outage');
    const p = healthy.find(n => n.provider === pref);
    if (p) return p;
    return healthy.sort((a, b) => a.latencyMs - b.latencyMs)[0];
  }
}

describe('MultiCloudMeshService (Issue #1424)', () => {
  it('should route to preferred provider when healthy and failover on brownout', () => {
    const mesh = new MultiCloudMeshService();
    mesh.registerNode({ id: 'n-aws', provider: 'AWS', isHealthy: true, latencyMs: 25 });
    mesh.registerNode({ id: 'n-gcp', provider: 'GCP', isHealthy: true, latencyMs: 30 });
    mesh.registerNode({ id: 'n-do', provider: 'DIGITAL_OCEAN', isHealthy: true, latencyMs: 45 });

    // Normal operation: routes to AWS
    assert.equal(mesh.routeRequest('AWS').id, 'n-aws');

    // AWS experiences complete regional outage
    mesh.updateNodeHealth('n-aws', false, 9999);

    // Mesh automatically fails over to next healthiest provider (GCP)
    const failoverNode = mesh.routeRequest('AWS');
    assert.equal(failoverNode.provider, 'GCP');
    assert.equal(failoverNode.id, 'n-gcp');
  });
});
