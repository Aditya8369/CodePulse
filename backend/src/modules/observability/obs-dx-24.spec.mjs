import assert from 'node:assert/strict';
import { DeepReadinessAggregatorService, HealthStatus } from './obs-dx-24.service.ts';

const aggregator = new DeepReadinessAggregatorService(2000);

aggregator.registerProbe('postgres', true, async () => ({ status: HealthStatus.UP, latencyMs: 5 }));
aggregator.registerProbe('redis', true, async () => ({ status: HealthStatus.UP, latencyMs: 2 }));
aggregator.registerProbe('emailSvc', false, async () => ({ status: HealthStatus.UP, latencyMs: 40 }));

// Healthy check
const res1 = await aggregator.checkReadiness();
assert.strictEqual(res1.overallStatus, HealthStatus.UP);
assert.strictEqual(res1.httpStatusCode, 200);

// Non-critical degraded
aggregator.registerProbe('emailSvc', false, async () => ({ status: HealthStatus.DOWN, latencyMs: -1, message: 'Circuit open' }));
const res2 = await aggregator.checkReadiness();
assert.strictEqual(res2.overallStatus, HealthStatus.DEGRADED);
assert.strictEqual(res2.httpStatusCode, 200);

// Critical failure (database down) -> HTTP 503
aggregator.registerProbe('postgres', true, async () => ({ status: HealthStatus.DOWN, latencyMs: -1, message: 'Connection refused' }));
const res3 = await aggregator.checkReadiness();
assert.strictEqual(res3.overallStatus, HealthStatus.DOWN);
assert.strictEqual(res3.httpStatusCode, 503);

console.log('Issue #3204 [OBS-DX-24] spec passed successfully.');
