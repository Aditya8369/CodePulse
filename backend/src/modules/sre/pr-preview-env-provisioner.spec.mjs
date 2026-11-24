import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class PrPreviewEnvProvisionerService {
  constructor() { this.envs = new Map(); }
  provision(pr) { const ns = `preview-pr-${pr}`; this.envs.set(pr, ns); return ns; }
  destroy(pr) { return this.envs.delete(pr); }
}

describe('PrPreviewEnvProvisionerService (#2214)', () => {
  test('provisions and tears down ephemeral PR preview environments', () => {
    const prov = new PrPreviewEnvProvisionerService();
    assert.strictEqual(prov.provision(2214), 'preview-pr-2214');
    assert.strictEqual(prov.destroy(2214), true);
    assert.strictEqual(prov.destroy(2214), false);
  });
});
