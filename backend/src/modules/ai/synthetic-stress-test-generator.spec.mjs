import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SyntheticStressTestGeneratorService {
  gen(t) {
    if (t === 'number') return [0, -Infinity, Number.MAX_SAFE_INTEGER];
    return ['', 'a'.repeat(10000)];
  }
}

describe('SyntheticStressTestGeneratorService (#2260)', () => {
  test('synthesizes boundary inputs and extreme edge cases for test suites', () => {
    const gen = new SyntheticStressTestGeneratorService();
    assert.strictEqual(gen.gen('number').length, 3);
    assert.strictEqual(gen.gen('string').length, 2);
  });
});
