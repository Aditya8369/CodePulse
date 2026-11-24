import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CanaryDeploymentMetricsControllerService {
  constructor() { this.step = 10; }
  eval(errRate, p99) {
    if (errRate > 0.02 || p99 > 300) { this.step = 0; return { step: 0, action: 'ROLLBACK' }; }
    this.step = Math.min(100, this.step + 25);
    return { step: this.step, action: 'PROMOTE' };
  }
}

describe('CanaryDeploymentMetricsControllerService (#2204)', () => {
  test('promotes healthy canary steps and triggers automated rollback on breach', () => {
    const canary = new CanaryDeploymentMetricsControllerService();
    const p1 = canary.eval(0.005, 80);
    assert.strictEqual(p1.action, 'PROMOTE');
    assert.strictEqual(p1.step, 35);

    const r1 = canary.eval(0.05, 450);
    assert.strictEqual(r1.action, 'ROLLBACK');
    assert.strictEqual(r1.step, 0);
  });
});
