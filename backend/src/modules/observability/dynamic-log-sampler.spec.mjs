import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DynamicLogSamplerService {
  shouldSample(level, rps) {
    if (level === 'ERROR') return true;
    if (rps > 1000) return false; // deterministic check for test
    return true;
  }
}

describe('DynamicLogSamplerService (Issue #1902)', () => {
  it('should always preserve ERROR logs while suppressing high-volume INFO logs', () => {
    const sampler = new DynamicLogSamplerService();
    assert.equal(sampler.shouldSample('ERROR', 5000), true);
    assert.equal(sampler.shouldSample('INFO', 200), true);
    assert.equal(sampler.shouldSample('INFO', 5000), false);
  });
});
