import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TestcaseMutationFuzzerService {
  mutate(inp) { return [inp.trim(), inp + ' ', inp.toUpperCase()]; }
}

describe('TestcaseMutationFuzzerService (#2267)', () => {
  test('mutates test inputs to detect flaky assertions and boundary weaknesses', () => {
    const fuzzer = new TestcaseMutationFuzzerService();
    const mutants = fuzzer.mutate('hello');
    assert.strictEqual(mutants.length, 3);
    assert.ok(mutants.includes('HELLO'));
  });
});
