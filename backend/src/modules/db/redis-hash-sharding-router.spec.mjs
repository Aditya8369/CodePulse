import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RedisHashShardingRouterService {
  constructor(nodes = ['node-1', 'node-2', 'node-3']) { this.nodes = nodes; }
  routeKey(k) {
    let h = 0;
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
    return this.nodes[Math.abs(h) % this.nodes.length];
  }
}

describe('RedisHashShardingRouterService (Issue #1839)', () => {
  it('should deterministically route cache keys to cluster nodes', () => {
    const router = new RedisHashShardingRouterService(['node-a', 'node-b']);
    const target1 = router.routeKey('user:101');
    const target2 = router.routeKey('user:101');
    assert.equal(target1, target2);
  });
});
