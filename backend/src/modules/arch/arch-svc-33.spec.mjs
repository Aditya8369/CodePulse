import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LatencyWeightedRouterService } from './arch-svc-33.service.ts';

describe('LatencyWeightedRouterService (ARCH-SVC-33)', () => {
  it('steers traffic to the healthiest node with lowest EWMA latency', () => {
    const router = new LatencyWeightedRouterService();
    router.registerNode('n1', 'http://n1', 20);
    router.registerNode('n2', 'http://n2', 50);

    assert.strictEqual(router.pickNextNode()?.id, 'n1');

    // Simulate n1 becoming slow and n2 recovering
    router.recordLatency('n1', 500);
    router.recordLatency('n2', 5);

    assert.strictEqual(router.pickNextNode()?.id, 'n2');
  });
});
