import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AdaptiveTracingSamplerService {
  constructor() { this.rate = 0.05; }
  adjust(err) {
    this.rate = err > 0.05 ? 1.0 : 0.05;
    return this.rate;
  }
}

describe('AdaptiveTracingSamplerService (#2234)', () => {
  test('dynamically adjusts trace sampling rate up to 100% during error bursts', () => {
    const sampler = new AdaptiveTracingSamplerService();
    assert.strictEqual(sampler.adjust(0.01), 0.05);
    assert.strictEqual(sampler.adjust(0.12), 1.0);
  });
});
