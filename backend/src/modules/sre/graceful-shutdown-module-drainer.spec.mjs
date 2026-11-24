import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GracefulShutdownModuleDrainerService {
  constructor() { this.tasks = []; }
  register(t) { this.tasks.push(t); }
  async drain() {
    this.tasks.sort((a,b)=>a.tier-b.tier);
    const drained = [];
    for (const t of this.tasks) { await t.fn(); drained.push(t.name); }
    return drained;
  }
}

describe('GracefulShutdownModuleDrainerService (#2216)', () => {
  test('orchestrates drain sequences by dependency priority tiers', async () => {
    const drainer = new GracefulShutdownModuleDrainerService();
    drainer.register({ name: 'postgres', tier: 3, fn: async () => {} });
    drainer.register({ name: 'http-ingress', tier: 1, fn: async () => {} });
    drainer.register({ name: 'bullmq-workers', tier: 2, fn: async () => {} });
    const order = await drainer.drain();
    assert.deepStrictEqual(order, ['http-ingress', 'bullmq-workers', 'postgres']);
  });
});
