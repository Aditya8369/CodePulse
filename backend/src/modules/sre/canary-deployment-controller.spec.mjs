import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CanaryDeploymentControllerService {
  evaluateCanary(m) {
    if (m.errorRatePercent > 1.0 || m.p99LatencyMs > 400) return 'ROLLBACK';
    return 'PROMOTE';
  }
}

describe('CanaryDeploymentControllerService (Issue #1882)', () => {
  it('should trigger automated rollbacks when canary metrics breach error or latency SLAs', () => {
    const controller = new CanaryDeploymentControllerService();
    assert.equal(controller.evaluateCanary({ errorRatePercent: 0.1, p99LatencyMs: 150 }), 'PROMOTE');
    assert.equal(controller.evaluateCanary({ errorRatePercent: 2.5, p99LatencyMs: 150 }), 'ROLLBACK');
    assert.equal(controller.evaluateCanary({ errorRatePercent: 0.2, p99LatencyMs: 600 }), 'ROLLBACK');
  });
});
