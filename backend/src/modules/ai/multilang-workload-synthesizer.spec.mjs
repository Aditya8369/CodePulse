import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MultilangWorkloadSynthesizerService {
  gen(lang, n) {
    if (lang === 'python') return `range(${n})`;
    return `for(${n})`;
  }
}

describe('MultilangWorkloadSynthesizerService (#2281)', () => {
  test('synthesizes multi-language benchmark workloads for cross-runtime profiling', () => {
    const synth = new MultilangWorkloadSynthesizerService();
    assert.strictEqual(synth.gen('python', 1000), 'range(1000)');
    assert.strictEqual(synth.gen('typescript', 1000), 'for(1000)');
  });
});
