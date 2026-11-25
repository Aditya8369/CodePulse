import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GossipKvStoreService } from './arch-svc-82.service.ts';

describe('GossipKvStoreService (ARCH-SVC-82)', () => {
  it('manages node heartbeats and key-value state store', () => {
    const store = new GossipKvStoreService();
    store.registerNode('n1');
    store.registerNode('n2');
    store.put('key1', 'val1');

    assert.strictEqual(store.get('key1'), 'val1');
    assert.strictEqual(store.getAliveNodeCount(), 2);
  });
});
