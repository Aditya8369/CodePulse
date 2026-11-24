import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ActiveActiveDBMeshService {
  constructor() { this.r = new Map(); }
  registerRegion(region, healthy, lag) { this.r.set(region, { region, healthy, lag }); }
  selectTargetRegion(pref) {
    const p = this.r.get(pref);
    if (p && p.healthy && p.lag < 1000) return pref;
    let best = null;
    for (const n of this.r.values()) {
      if (!n.healthy) continue;
      if (!best || n.lag < best.lag) best = n;
    }
    if (!best) throw new Error('Unhealthy');
    return best.region;
  }
}

describe('ActiveActiveDBMeshService (Issue #1881)', () => {
  it('should route to preferred region when healthy and fail over to lowest lag replica', () => {
    const mesh = new ActiveActiveDBMeshService();
    mesh.registerRegion('us-east-1', false, 2500); // Unhealthy
    mesh.registerRegion('eu-central-1', true, 120); // Healthy, low lag
    mesh.registerRegion('ap-south-1', true, 450);  // Healthy, higher lag

    assert.equal(mesh.selectTargetRegion('eu-central-1'), 'eu-central-1');
    assert.equal(mesh.selectTargetRegion('us-east-1'), 'eu-central-1', 'Must failover from unhealthy us-east-1');
  });
});
