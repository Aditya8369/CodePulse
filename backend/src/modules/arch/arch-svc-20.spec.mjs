import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DynamicBackpressureFeedbackLoopService } from './arch-svc-20.service.ts';

describe('DynamicBackpressureFeedbackLoopService (ARCH-SVC-20)', () => {
  it('does not throttle when queue depth is beneath threshold', () => {
    const loop = new DynamicBackpressureFeedbackLoopService(0.7);
    const decision = loop.evaluateBackpressure({
      queueName: 'events.ingest',
      currentDepth: 500,
      maxCapacity: 1000,
      consumerRatePerSec: 100,
      producerRatePerSec: 80,
    });
    assert.strictEqual(decision.throttled, false);
    assert.strictEqual(decision.throttleFactor, 0.0);
    assert.strictEqual(decision.recommendedDelayMs, 0);
  });

  it('dynamically computes throttle factor and backpressure delay when queue fills up', () => {
    const loop = new DynamicBackpressureFeedbackLoopService(0.7, 1000);
    const decision = loop.evaluateBackpressure({
      queueName: 'events.ingest',
      currentDepth: 850,
      maxCapacity: 1000,
      consumerRatePerSec: 50,
      producerRatePerSec: 200,
    });
    assert.strictEqual(decision.throttled, true);
    assert.strictEqual(decision.throttleFactor, 0.5); // (0.85 - 0.70) / 0.30 = 0.50
    assert.strictEqual(decision.recommendedDelayMs, 500);
  });
});
