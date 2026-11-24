import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class LlmAstSummarizationRecoveryService {
  summarize(code, tokens) {
    if (tokens > 4000) {
      return { code: code.split('{')[0] + '{ ... }', compressed: true };
    }
    return { code, compressed: false };
  }
}

describe('LlmAstSummarizationRecoveryService (#2261)', () => {
  test('strips method bodies to recover from LLM prompt context window overflow', () => {
    const recovery = new LlmAstSummarizationRecoveryService();
    const src = 'function compute() { const x = 1; return x + 2; }';
    assert.strictEqual(recovery.summarize(src, 200).compressed, false);
    const res = recovery.summarize(src, 5000);
    assert.strictEqual(res.compressed, true);
    assert.strictEqual(res.code, 'function compute() { ... }');
  });
});
