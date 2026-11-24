import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ChaosLatencyPacketLossInjectorService {
  constructor() { this.drop = 0; this.delay = 0; }
  configure(drop, delay) { this.drop = drop; this.delay = delay; }
  intercept(rand = 0.5) {
    if (rand < this.drop) return 'DROP';
    if (this.delay > 0) return 'DELAY';
    return 'PASS';
  }
}

describe('ChaosLatencyPacketLossInjectorService (#2202)', () => {
  test('injects controlled packet loss and latency for resilience chaos testing', () => {
    const chaos = new ChaosLatencyPacketLossInjectorService();
    chaos.configure(0.2, 100);
    assert.strictEqual(chaos.intercept(0.1), 'DROP');
    assert.strictEqual(chaos.intercept(0.5), 'DELAY');
    chaos.configure(0, 0);
    assert.strictEqual(chaos.intercept(0.5), 'PASS');
  });
});
