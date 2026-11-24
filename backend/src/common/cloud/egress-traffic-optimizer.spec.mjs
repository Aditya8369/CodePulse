import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class EgressTrafficOptimizerService {
  constructor() {
    this.peering = new Map([
      ['us-east-1->us-west-2', 'tgw-peering-usw2.internal'],
      ['us-east-1->eu-west-1', 'tgw-peering-euw1.internal']
    ]);
  }
  routeTransfer(source, dest, pub) {
    if (source === dest) {
      return { routeType: 'VPC_PEERING_TRANSIT_GATEWAY', savingsRatio: 0.89 };
    }
    const priv = this.peering.get(source + '->' + dest);
    if (priv) {
      return { routeType: 'VPC_PEERING_TRANSIT_GATEWAY', targetEndpoint: priv, savingsRatio: 0.55 };
    }
    return { routeType: 'PUBLIC_INTERNET', targetEndpoint: pub, savingsRatio: 0 };
  }
}

describe('EgressTrafficOptimizerService (Issue #1439)', () => {
  it('should route inter-region replication traffic over private peering gateway', () => {
    const optimizer = new EgressTrafficOptimizerService();
    const route = optimizer.routeTransfer('us-east-1', 'us-west-2', 'api.codepulse.io');
    assert.equal(route.routeType, 'VPC_PEERING_TRANSIT_GATEWAY');
    assert.equal(route.targetEndpoint, 'tgw-peering-usw2.internal');
    assert.equal(route.savingsRatio, 0.55);
  });

  it('should fall back to public internet when no peering link is configured', () => {
    const optimizer = new EgressTrafficOptimizerService();
    const route = optimizer.routeTransfer('us-east-1', 'ap-southeast-1', 's3.ap-southeast-1.amazonaws.com');
    assert.equal(route.routeType, 'PUBLIC_INTERNET');
    assert.equal(route.savingsRatio, 0);
  });
});
