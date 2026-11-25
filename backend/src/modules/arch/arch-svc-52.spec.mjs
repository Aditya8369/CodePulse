import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CacheInvalidationBroadcasterService } from './arch-svc-52.service.ts';

describe('CacheInvalidationBroadcasterService (ARCH-SVC-52)', () => {
  it('broadcasts cache invalidations with monotonic generations', () => {
    const nodeA = new CacheInvalidationBroadcasterService('node-A');
    nodeA.setLocal('user:10', { name: 'Dan' });
    assert.deepStrictEqual(nodeA.getLocal('user:10'), { name: 'Dan' });

    const msg = nodeA.createInvalidationBroadcast('user:10');
    assert.strictEqual(msg.generation, 1);
    assert.strictEqual(nodeA.getLocal('user:10'), undefined);
  });

  it('evicts local cache upon receiving gossip invalidation from peer', () => {
    const nodeB = new CacheInvalidationBroadcasterService('node-B');
    nodeB.setLocal('user:10', { name: 'Dan' });

    const applied = nodeB.receiveGossipInvalidation({
      nodeId: 'node-A',
      cacheKey: 'user:10',
      timestamp: Date.now(),
      generation: 1
    });

    assert.strictEqual(applied, true);
    assert.strictEqual(nodeB.getLocal('user:10'), undefined);

    // Stale duplicate gossip ignored
    const stale = nodeB.receiveGossipInvalidation({
      nodeId: 'node-A',
      cacheKey: 'user:10',
      timestamp: Date.now(),
      generation: 1
    });
    assert.strictEqual(stale, false);
  });
});
