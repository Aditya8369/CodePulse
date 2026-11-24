import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AiLeakPredictionProfilerService {
  predict(deltas) {
    const growing = deltas.every((v, i) => i === 0 || v >= deltas[i-1]);
    const prob = growing && deltas.length >= 4 ? 0.92 : 0.15;
    return { prob, warning: prob > 0.8 };
  }
}

describe('AiLeakPredictionProfilerService (#2262)', () => {
  test('predicts memory leaks from monotonic heap growth trends', () => {
    const profiler = new AiLeakPredictionProfilerService();
    assert.strictEqual(profiler.predict([10, 15, 12, 11]).warning, false);
    assert.strictEqual(profiler.predict([10, 20, 30, 40]).warning, true);
  });
});
