import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class LlmAstEvaluationGuardService {
  validate(code, fns) {
    const hall = fns.filter(f => !code.includes(f));
    return { valid: hall.length === 0, hall };
  }
}

describe('LlmAstEvaluationGuardService (#2256)', () => {
  test('detects hallucinated function references in LLM code evaluations', () => {
    const guard = new LlmAstEvaluationGuardService();
    assert.strictEqual(guard.validate('function add(a, b) { return a + b; }', ['add']).valid, true);
    assert.strictEqual(guard.validate('function add(a, b) { return a + b; }', ['add', 'subtract']).valid, false);
  });
});
