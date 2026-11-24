import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class LogSurgeAdaptiveSuppressorService {
  sample(rate) {
    if (rate > 5000) return { sampleRate: 0.01, suppressed: true };
    if (rate > 1000) return { sampleRate: 0.1, suppressed: true };
    return { sampleRate: 1.0, suppressed: false };
  }
}

describe('LogSurgeAdaptiveSuppressorService (#2251)', () => {
  test('downsamples high-volume log surges to protect centralized log storage', () => {
    const suppressor = new LogSurgeAdaptiveSuppressorService();
    assert.strictEqual(suppressor.sample(500).suppressed, false);
    assert.strictEqual(suppressor.sample(2500).sampleRate, 0.1);
    assert.strictEqual(suppressor.sample(8000).sampleRate, 0.01);
  });
});
