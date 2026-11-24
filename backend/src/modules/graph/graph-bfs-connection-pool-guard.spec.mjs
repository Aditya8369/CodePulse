import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GraphBfsConnectionPoolGuardService {
  constructor() { this.leases = 0; }
  acquire() { this.leases++; return 'c'; }
  release() { if (this.leases > 0) this.leases--; }
  async runSafe(fn) {
    const c = this.acquire();
    try { return await fn(c); }
    finally { this.release(); }
  }
}

describe('GraphBfsConnectionPoolGuardService (#2360)', () => {
  test('guarantees connection release back to pool even when recursive traversal throws', async () => {
    const guard = new GraphBfsConnectionPoolGuardService();
    assert.strictEqual(guard.leases, 0);

    await assert.rejects(async () => {
      await guard.runSafe(async () => {
        throw new Error('Graph traversal failed');
      });
    });

    assert.strictEqual(guard.leases, 0);
  });
});
