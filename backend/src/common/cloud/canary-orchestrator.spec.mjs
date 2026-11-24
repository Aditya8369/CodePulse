import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CanaryOrchestratorService {
  constructor(maxErrorRate = 0.01, maxP99LatencyMs = 500) {
    this.maxErrorRate = maxErrorRate;
    this.maxP99LatencyMs = maxP99LatencyMs;
    this.phase = 'INIT';
    this.weight = 0;
  }
  startCanary() {
    this.phase = 'CANARY_5_PERCENT';
    this.weight = 5;
    return { phase: this.phase, weight: this.weight };
  }
  evaluateAndStep(m) {
    if (m.errorRate5xx > this.maxErrorRate || m.p99LatencyMs > this.maxP99LatencyMs) {
      this.phase = 'ROLLED_BACK';
      this.weight = 0;
      return { phase: this.phase, weight: 0, isRollback: true };
    }
    if (this.phase === 'CANARY_5_PERCENT') { this.phase = 'CANARY_25_PERCENT'; this.weight = 25; }
    else if (this.phase === 'CANARY_25_PERCENT') { this.phase = 'PROMOTED'; this.weight = 100; }
    return { phase: this.phase, weight: this.weight, isRollback: false };
  }
}

describe('CanaryOrchestratorService (Issue #1423)', () => {
  it('should promote traffic from 5% to 25% to 100% on healthy SLIs', () => {
    const orchestrator = new CanaryOrchestratorService();
    const init = orchestrator.startCanary();
    assert.equal(init.weight, 5);

    const step1 = orchestrator.evaluateAndStep({ errorRate5xx: 0.001, p99LatencyMs: 80 });
    assert.equal(step1.weight, 25);
    assert.equal(step1.isRollback, false);

    const step2 = orchestrator.evaluateAndStep({ errorRate5xx: 0.002, p99LatencyMs: 90 });
    assert.equal(step2.weight, 100);
    assert.equal(step2.phase, 'PROMOTED');
  });

  it('should trigger instant auto-rollback when error rate breaches 1%', () => {
    const orchestrator = new CanaryOrchestratorService(0.01, 500);
    orchestrator.startCanary();

    // Sudden spike in 5xx errors (3.5%)
    const result = orchestrator.evaluateAndStep({ errorRate5xx: 0.035, p99LatencyMs: 120 });
    assert.equal(result.isRollback, true);
    assert.equal(result.phase, 'ROLLED_BACK');
    assert.equal(result.weight, 0);
  });
});
