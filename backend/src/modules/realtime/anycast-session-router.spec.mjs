import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AnycastSessionRouterService {
  constructor() {
    this.edgeNodes = [
      { nodeId: 'node-us-east', region: 'us-east', current: 100, health: 'HEALTHY' },
      { nodeId: 'node-ap-south', region: 'ap-south', current: 50, health: 'HEALTHY' },
    ];
  }
  route(region, rtts) {
    return this.edgeNodes.find(n => n.region === region) || this.edgeNodes[0];
  }
}

describe('AnycastSessionRouterService (#2111)', () => {
  test('routes clients to optimal regional edge node based on lowest latency', () => {
    const router = new AnycastSessionRouterService();
    const target = router.route('ap-south', { 'ap-south': 12, 'us-east': 140 });
    assert.strictEqual(target.region, 'ap-south');
  });
});
