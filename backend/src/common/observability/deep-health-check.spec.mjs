import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DeepHealthCheckService {
  async probeAll(dependencies) {
    const startTime = Date.now();
    const results = await Promise.all(dependencies.map(dep => this.probeSingle(dep)));
    const depMap = {};
    let downCount = 0;
    for (const r of results) {
      depMap[r.name] = r;
      if (r.status === 'DOWN') downCount++;
    }
    let overall = 'UP';
    if (downCount === dependencies.length && dependencies.length > 0) overall = 'DOWN';
    else if (downCount > 0) overall = 'DEGRADED';
    return { status: overall, dependencies: depMap, totalLatencyMs: Date.now() - startTime };
  }

  async probeSingle(dep) {
    const timeoutMs = dep.timeoutMs ?? 1000;
    const start = Date.now();
    try {
      let timer;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      });
      await Promise.race([dep.ping(), timeoutPromise]).finally(() => clearTimeout(timer));
      return { name: dep.name, status: 'UP', latencyMs: Date.now() - start };
    } catch (e) {
      return { name: dep.name, status: 'DOWN', latencyMs: Date.now() - start, error: e.message };
    }
  }
}

describe('DeepHealthCheckService (Issue #1474)', () => {
  it('should return UP when all dependencies respond within timeout', async () => {
    const health = new DeepHealthCheckService();
    const report = await health.probeAll([
      { name: 'postgres', ping: async () => {} },
      { name: 'redis', ping: async () => {} },
      { name: 'neo4j', ping: async () => {} },
      { name: 'kafka', ping: async () => {} }
    ]);

    assert.equal(report.status, 'UP');
    assert.equal(report.dependencies.postgres.status, 'UP');
    assert.equal(report.dependencies.kafka.status, 'UP');
  });

  it('should return DEGRADED when a non-critical dependency times out', async () => {
    const health = new DeepHealthCheckService();
    const report = await health.probeAll([
      { name: 'postgres', ping: async () => {} },
      { name: 'redis', ping: async () => new Promise(r => setTimeout(r, 200)), timeoutMs: 50 }
    ]);

    assert.equal(report.status, 'DEGRADED');
    assert.equal(report.dependencies.redis.status, 'DOWN');
  });
});
