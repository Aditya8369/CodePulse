import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class LatencyEqualizationDelayBufferService {
  delay(ping, target = 120) {
    return ping >= target ? 0 : target - ping;
  }
}

describe('LatencyEqualizationDelayBufferService (#2336)', () => {
  test('calculates artificial latency padding to equalize response windows across regions', () => {
    const service = new LatencyEqualizationDelayBufferService();
    assert.strictEqual(service.delay(20, 120), 100);
    assert.strictEqual(service.delay(120, 120), 0);
    assert.strictEqual(service.delay(150, 120), 0);
  });
});
