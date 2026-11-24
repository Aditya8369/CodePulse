import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AiConversationMemoryPrunerService {
  prune(msgs) {
    const sys = msgs.filter(m => m.role === 'system');
    const other = msgs.filter(m => m.role !== 'system');
    if (other.length > 4) return [...sys, ...other.slice(-4)];
    return msgs;
  }
}

describe('AiConversationMemoryPrunerService (#2279)', () => {
  test('prunes conversation history to preserve sliding-turn context limits', () => {
    const pruner = new AiConversationMemoryPrunerService();
    const msgs = [
      { role: 'system', content: 'init' },
      { role: 'user', content: '1' },
      { role: 'assistant', content: '2' },
      { role: 'user', content: '3' },
      { role: 'assistant', content: '4' },
      { role: 'user', content: '5' },
    ];
    const out = pruner.prune(msgs);
    assert.strictEqual(out.length, 5); // 1 sys + 4 last
    assert.strictEqual(out[0].content, 'init');
    assert.strictEqual(out[4].content, '5');
  });
});
