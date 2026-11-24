import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ShardRouterMigrationService {
  constructor() { this.s = new Map(); }
  assign(t, sh) { this.s.set(t, sh); }
  get(t) { return this.s.get(t) || 'shard-default'; }
  migrate(t, to) {
    const from = this.get(t);
    this.s.set(t, to);
    return { from, to };
  }
}

describe('ShardRouterMigrationService (#2388)', () => {
  test('dynamically routes tenants to designated shards and supports runtime migration', () => {
    const router = new ShardRouterMigrationService();
    router.assign('tenant-a', 'shard-us-east-1');
    assert.strictEqual(router.get('tenant-a'), 'shard-us-east-1');

    const mig = router.migrate('tenant-a', 'shard-eu-central-1');
    assert.strictEqual(mig.from, 'shard-us-east-1');
    assert.strictEqual(mig.to, 'shard-eu-central-1');
    assert.strictEqual(router.get('tenant-a'), 'shard-eu-central-1');
  });
});
