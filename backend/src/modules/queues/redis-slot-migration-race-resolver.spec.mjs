import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RedisSlotMigrationRaceResolverService {
  handle(err) {
    if (err.startsWith('ASK')) {
      const p = err.split(' ');
      return { strategy: 'EXEC_ASKING', target: p[2], slot: parseInt(p[1]) };
    }
    if (err.startsWith('MOVED')) {
      const p = err.split(' ');
      return { strategy: 'REFRESH_TOPOLOGY', target: p[2], slot: parseInt(p[1]) };
    }
    return { strategy: 'STANDARD' };
  }
}

describe('RedisSlotMigrationRaceResolverService (#2300)', () => {
  test('handles ASK and MOVED cluster slot migrations cleanly', () => {
    const resolver = new RedisSlotMigrationRaceResolverService();
    const askRes = resolver.handle('ASK 3999 10.0.0.5:6379');
    assert.strictEqual(askRes.strategy, 'EXEC_ASKING');
    assert.strictEqual(askRes.target, '10.0.0.5:6379');

    const movedRes = resolver.handle('MOVED 3999 10.0.0.6:6379');
    assert.strictEqual(movedRes.strategy, 'REFRESH_TOPOLOGY');
    assert.strictEqual(movedRes.target, '10.0.0.6:6379');
  });
});
