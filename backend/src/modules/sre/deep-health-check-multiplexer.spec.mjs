import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DeepHealthCheckMultiplexerService {
  async executeHealthChecks(checks, timeoutMs = 100) {
    const results = {};
    let allHealthy = true;
    await Promise.all(checks.map(async c => {
      try {
        const res = await Promise.race([c.check(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))]);
        results[c.name] = res;
        if (!res) allHealthy = false;
      } catch (e) { results[c.name] = false; allHealthy = false; }
    }));
    return { healthy: allHealthy, results };
  }
}

describe('DeepHealthCheckMultiplexerService (Issue #1877)', () => {
  it('should multiplex dependency health probes with strict per-check timeouts', async () => {
    const multiplexer = new DeepHealthCheckMultiplexerService();
    const checks = [
      { name: 'postgres', check: async () => true },
      { name: 'redis', check: async () => true },
      { name: 'kafka', check: async () => { await new Promise(r => setTimeout(r, 200)); return true; } } // Will timeout
    ];

    const report = await multiplexer.executeHealthChecks(checks, 50);
    assert.equal(report.healthy, false);
    assert.equal(report.results.postgres, true);
    assert.equal(report.results.kafka, false);
  });
});
