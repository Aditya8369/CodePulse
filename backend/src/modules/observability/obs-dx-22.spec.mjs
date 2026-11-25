import assert from 'node:assert/strict';
import { ChaosExperimentRunnerService, FaultType } from './obs-dx-22.service.ts';

const runner = new ChaosExperimentRunnerService(2, 5); // 02:00 to 05:00 UTC

// Blast radius safety guard check
assert.throws(() => {
  runner.registerExperiment({
    id: 'exp-unsafe',
    name: 'Too aggressive',
    faultType: FaultType.PACKET_DROP,
    durationMs: 10000,
    maxTargetPercentage: 0.50, // exceeds 20% limit
    intensityMultiplier: 1.0
  });
}, /Blast radius safety violation/);

// Register safe experiment
runner.registerExperiment({
  id: 'exp-latency',
  name: 'Upstream Auth Latency Spike',
  faultType: FaultType.LATENCY_INJECTION,
  durationMs: 5000,
  maxTargetPercentage: 0.10,
  intensityMultiplier: 1.5
});

// Rejection during peak hours (14:00 UTC)
const peakDate = new Date('2026-11-25T14:00:00Z');
const peakRes = await runner.executeExperiment('exp-latency', peakDate, async () => ({ injectedErrors: 0, recovered: true }));
assert.strictEqual(peakRes.executed, false);
assert.strictEqual(peakRes.status, 'REJECTED_PEAK_HOURS');

// Success during off-peak hours (03:30 UTC)
const offPeakDate = new Date('2026-11-25T03:30:00Z');
const offPeakRes = await runner.executeExperiment('exp-latency', offPeakDate, async () => ({ injectedErrors: 15, recovered: true }));
assert.strictEqual(offPeakRes.executed, true);
assert.strictEqual(offPeakRes.status, 'COMPLETED');
assert.strictEqual(offPeakRes.metricsObserved.injectedErrors, 15);

// Emergency stop
runner.triggerEmergencyStop('High customer traffic anomaly');
const stoppedRes = await runner.executeExperiment('exp-latency', offPeakDate, async () => ({ injectedErrors: 0, recovered: true }));
assert.strictEqual(stoppedRes.status, 'ABORTED');

console.log('Issue #3202 [OBS-DX-22] spec passed successfully.');
