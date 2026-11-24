import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class QueueDepthThresholdInterceptorService {
  check(d) {
    if (d > 1000) return { admit: false, action: 'REJECT' };
    if (d > 800) return { admit: true, action: 'THROTTLE' };
    return { admit: true, action: 'ACCEPT' };
  }
}

describe('QueueDepthThresholdInterceptorService (#2218)', () => {
  test('imposes backpressure throttling and shedding on high queue depths', () => {
    const interceptor = new QueueDepthThresholdInterceptorService();
    assert.strictEqual(interceptor.check(500).action, 'ACCEPT');
    assert.strictEqual(interceptor.check(850).action, 'THROTTLE');
    assert.strictEqual(interceptor.check(1200).action, 'REJECT');
  });
});
