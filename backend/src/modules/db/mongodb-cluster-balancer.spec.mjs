import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MongodbClusterBalancerService {
  check(shards) {
    const counts = shards.map(s => s.chunks);
    const diff = Math.max(...counts) - Math.min(...counts);
    return diff >= 5;
  }
}

describe('MongodbClusterBalancerService (#2156)', () => {
  test('triggers cluster rebalancing when chunk count difference between shards exceeds threshold', () => {
    const balancer = new MongodbClusterBalancerService();
    assert.strictEqual(balancer.check([{ chunks: 10 }, { chunks: 12 }]), false);
    assert.strictEqual(balancer.check([{ chunks: 10 }, { chunks: 18 }]), true);
  });
});
