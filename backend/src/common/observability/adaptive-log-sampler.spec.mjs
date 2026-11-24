import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

class AdaptiveLogSamplerService {
  constructor(windowMs = 5000, maxUnsampledPerWindow = 5, sampleRatio = 10) {
    this.windowMs = windowMs;
    this.maxUnsampledPerWindow = maxUnsampledPerWindow;
    this.sampleRatio = sampleRatio;
    this.errorFrequencies = new Map();
  }
  evaluateLog(errorName, message, stack) {
    const top = (stack || '').split('\n')[1]?.trim() || '';
    const fp = crypto.createHash('md5').update(`${errorName}:${message}:${top}`).digest('hex').substring(0, 8);
    const now = Date.now();
    let stats = this.errorFrequencies.get(fp);
    if (!stats || now - stats.windowStart > this.windowMs) {
      stats = { count: 1, windowStart: now, suppressed: 0 };
      this.errorFrequencies.set(fp, stats);
      return { shouldLog: true, suppressedCount: 0, fingerprint: fp };
    }
    stats.count++;
    if (stats.count <= this.maxUnsampledPerWindow) {
      return { shouldLog: true, suppressedCount: 0, fingerprint: fp };
    }
    if (stats.count % this.sampleRatio === 0) {
      const sup = stats.suppressed;
      stats.suppressed = 0;
      return { shouldLog: true, suppressedCount: sup, fingerprint: fp };
    } else {
      stats.suppressed++;
      return { shouldLog: false, suppressedCount: stats.suppressed, fingerprint: fp };
    }
  }
}

describe('AdaptiveLogSamplerService (Issue #1462)', () => {
  it('should capture initial unique errors and suppress repetitive error surges', () => {
    const sampler = new AdaptiveLogSamplerService(10000, 3, 5);

    // First 3 should all be logged
    for (let i = 1; i <= 3; i++) {
      const res = sampler.evaluateLog('TypeError', 'Cannot read properties of undefined', 'Error\n at foo.js:10:5');
      assert.equal(res.shouldLog, true);
    }

    // 4th should be suppressed
    const res4 = sampler.evaluateLog('TypeError', 'Cannot read properties of undefined', 'Error\n at foo.js:10:5');
    assert.equal(res4.shouldLog, false);
  });
});
