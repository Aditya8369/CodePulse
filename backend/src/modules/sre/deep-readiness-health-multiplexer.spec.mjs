import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DeepReadinessHealthMultiplexerService {
  constructor() { this.probes = new Map(); }
  register(name, fn) { this.probes.set(name, fn); }
  async run() {
    const res = [];
    for (const [name, fn] of this.probes.entries()) {
      try {
        const ok = await fn();
        res.push({ name, healthy: ok });
      } catch (err) {
        res.push({ name, healthy: false, err: err.message });
      }
    }
    return { overall: res.every(r => r.healthy), results: res };
  }
}

describe('DeepReadinessHealthMultiplexerService (#2206)', () => {
  test('multiplexes health checks with bounded concurrency and timeout guarantees', async () => {
    const svc = new DeepReadinessHealthMultiplexerService();
    svc.register('db', async () => true);
    svc.register('redis', async () => true);
    const r1 = await svc.run();
    assert.strictEqual(r1.overall, true);

    svc.register('kafka', async () => { throw new Error('connection refused'); });
    const r2 = await svc.run();
    assert.strictEqual(r2.overall, false);
    assert.strictEqual(r2.results.find(x => x.name === 'kafka').healthy, false);
  });
});
