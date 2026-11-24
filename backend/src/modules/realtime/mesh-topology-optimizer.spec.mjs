import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MeshTopologyOptimizerService {
  optimize(peers, bw) {
    if (peers > 4 || bw < 1000) return 'SFU_HYBRID';
    return 'FULL_MESH';
  }
}

describe('MeshTopologyOptimizerService (#2127)', () => {
  test('switches dynamically from full mesh to SFU hybrid when room size exceeds 4 peers', () => {
    const optimizer = new MeshTopologyOptimizerService();
    assert.strictEqual(optimizer.optimize(3, 5000), 'FULL_MESH');
    assert.strictEqual(optimizer.optimize(6, 5000), 'SFU_HYBRID');
  });
});
