import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HealthProbeAggregatorService } from './arch-svc-42.service.ts';

describe('HealthProbeAggregatorService (ARCH-SVC-42)', () => {
  it('synthesizes health across multiple subsystem probes into deep readiness status', async () => {
    const aggregator = new HealthProbeAggregatorService();
    aggregator.registerProbe('db', async () => true);
    aggregator.registerProbe('redis', async () => false);

    const report = await aggregator.aggregateHealth();
    assert.strictEqual(report.status, 'DEGRADED');
    assert.strictEqual(report.subsystems.db, true);
    assert.strictEqual(report.subsystems.redis, false);
  });
});
