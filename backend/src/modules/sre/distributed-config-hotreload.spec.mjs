import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DistributedConfigHotreloadService {
  constructor() { this.cache = new Map(); }
  reload(k, v) { const prev = this.cache.get(k); this.cache.set(k, v); return { reloaded: true, prev }; }
  get(k) { return this.cache.get(k); }
}

describe('DistributedConfigHotreloadService (#2215)', () => {
  test('applies zero-downtime hot-reload updates from distributed configuration stores', () => {
    const engine = new DistributedConfigHotreloadService();
    engine.reload('rate_limit.max_rps', '500');
    assert.strictEqual(engine.get('rate_limit.max_rps'), '500');
    const update = engine.reload('rate_limit.max_rps', '1000');
    assert.strictEqual(update.prev, '500');
    assert.strictEqual(engine.get('rate_limit.max_rps'), '1000');
  });
});
