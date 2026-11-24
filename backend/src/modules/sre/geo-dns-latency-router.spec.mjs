import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GeoDnsLatencyRouterService {
  constructor() { this.pops = new Map(); }
  set(r, l, h) { this.pops.set(r, { region: r, latencyMs: l, healthy: h }); }
  route(pref) {
    const p = this.pops.get(pref);
    if (p && p.healthy && p.latencyMs < 250) return { region: pref, failover: false };
    const h = Array.from(this.pops.values()).filter(x => x.healthy).sort((a,b)=>a.latencyMs - b.latencyMs);
    return { region: h[0].region, failover: true };
  }
}

describe('GeoDnsLatencyRouterService (#2199)', () => {
  test('dynamically fails over DNS routing on regional latency degradation', () => {
    const router = new GeoDnsLatencyRouterService();
    router.set('us-east', 35, true);
    router.set('eu-west', 45, true);
    assert.strictEqual(router.route('us-east').failover, false);
    router.set('us-east', 300, false);
    const failover = router.route('us-east');
    assert.strictEqual(failover.failover, true);
    assert.strictEqual(failover.region, 'eu-west');
  });
});
