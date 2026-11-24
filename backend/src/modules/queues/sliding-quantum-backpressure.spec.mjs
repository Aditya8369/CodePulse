import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SlidingQuantumBackpressureService {
  eval(d, h) {
    const r = d / h;
    if (r >= 1.0) return { state: 'PAUSE', ratio: 0.0 };
    if (r >= 0.75) return { state: 'THROTTLE', ratio: 0.25 };
    if (r >= 0.5) return { state: 'THROTTLE', ratio: 0.5 };
    return { state: 'FLOW', ratio: 1.0 };
  }
}

describe('SlidingQuantumBackpressureService (#2291)', () => {
  test('regulates downstream consumption rates based on buffer saturation', () => {
    const backpressure = new SlidingQuantumBackpressureService();
    assert.strictEqual(backpressure.eval(20, 100).state, 'FLOW');
    assert.strictEqual(backpressure.eval(60, 100).state, 'THROTTLE');
    assert.strictEqual(backpressure.eval(80, 100).ratio, 0.25);
    assert.strictEqual(backpressure.eval(105, 100).state, 'PAUSE');
  });
});
