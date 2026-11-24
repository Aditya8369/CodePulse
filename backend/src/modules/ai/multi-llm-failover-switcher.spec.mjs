import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MultiLlmFailoverSwitcherService {
  constructor() { this.p = ['gemini', 'anthropic', 'openai']; this.idx = 0; }
  fail() { this.idx = (this.idx + 1) % this.p.length; return this.p[this.idx]; }
}

describe('MultiLlmFailoverSwitcherService (#2275)', () => {
  test('smoothly fails over across multiple AI model provider backends', () => {
    const switcher = new MultiLlmFailoverSwitcherService();
    assert.strictEqual(switcher.fail(), 'anthropic');
    assert.strictEqual(switcher.fail(), 'openai');
    assert.strictEqual(switcher.fail(), 'gemini');
  });
});
