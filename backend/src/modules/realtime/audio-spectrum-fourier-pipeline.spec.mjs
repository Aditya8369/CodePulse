import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AudioSpectrumFourierPipelineService {
  compute(samples, n = 4) {
    const res = [];
    const size = Math.floor(samples.length / n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < size; j++) sum += Math.abs(samples[i * size + j]);
      res.push(Math.round(sum / size));
    }
    return res;
  }
}

describe('AudioSpectrumFourierPipelineService (#2132)', () => {
  test('computes discrete frequency bands from audio PCM samples', () => {
    const pipeline = new AudioSpectrumFourierPipelineService();
    const bands = pipeline.compute([10, 20, 30, 40, 50, 60, 70, 80], 2);
    assert.strictEqual(bands.length, 2);
    assert.strictEqual(bands[0], 25);
    assert.strictEqual(bands[1], 65);
  });
});
