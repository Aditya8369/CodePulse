import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class KafkaLagAutoscalerService {
  constructor(target = 200, min = 1, max = 20, alpha = 0.3, beta = 0.1) {
    this.target = target;
    this.min = min;
    this.max = max;
    this.alpha = alpha;
    this.beta = beta;
    this.sEMA = null;
    this.trendEMA = null;
  }
  recordSnapshot(snapshot) {
    const lag = snapshot.currentLag;
    if (this.sEMA === null) {
      this.sEMA = lag;
      this.trendEMA = 0;
    } else {
      const prev = this.sEMA;
      this.sEMA = this.alpha * lag + (1 - this.alpha) * (this.sEMA + this.trendEMA);
      this.trendEMA = this.beta * (this.sEMA - prev) + (1 - this.beta) * this.trendEMA;
    }
    const predicted = Math.max(0, this.sEMA + this.trendEMA);
    const req = Math.ceil(predicted / this.target);
    const target = Math.min(this.max, Math.max(this.min, req));
    let action = 'maintain';
    if (target > snapshot.currentConsumers) action = 'scale_up';
    else if (target < snapshot.currentConsumers && predicted === 0) action = 'scale_down';
    return { recommendedConsumers: target, predictedLag: Math.round(predicted), action };
  }
}

describe('KafkaLagAutoscalerService (Issue #1793)', () => {
  it('should predictively scale up consumer count during rapid lag growth', () => {
    const autoscaler = new KafkaLagAutoscalerService(200, 1, 10);
    autoscaler.recordSnapshot({ timestampMs: 1000, currentLag: 100, currentConsumers: 1 });
    autoscaler.recordSnapshot({ timestampMs: 2000, currentLag: 500, currentConsumers: 1 });
    const decision = autoscaler.recordSnapshot({ timestampMs: 3000, currentLag: 1200, currentConsumers: 1 });

    assert.equal(decision.action, 'scale_up');
    assert.equal(decision.recommendedConsumers >= 3, true);
  });
});
