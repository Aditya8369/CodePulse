import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RedisStreamPelCleanerService {
  constructor() { this.s = new Map(); }
  reg(stream, id, consumer, time = Date.now()) {
    const l = this.s.get(stream) || [];
    l.push({ id, consumer, time });
    this.s.set(stream, l);
  }
  purge(stream, maxIdle = 60000) {
    const l = this.s.get(stream) || [];
    const now = Date.now();
    const active = [];
    const purged = [];
    for (const e of l) {
      if (now - e.time > maxIdle) purged.push(e.id);
      else active.push(e);
    }
    this.s.set(stream, active);
    return { purgedCount: purged.length, purged };
  }
}

describe('RedisStreamPelCleanerService (#2288)', () => {
  test('identifies and sweeps unacknowledged PEL entries past idle threshold', () => {
    const cleaner = new RedisStreamPelCleanerService();
    const oldTime = Date.now() - 70000;
    cleaner.reg('stream-events', 'msg-1', 'c1', oldTime);
    cleaner.reg('stream-events', 'msg-2', 'c1', Date.now());

    const result = cleaner.purge('stream-events', 60000);
    assert.strictEqual(result.purgedCount, 1);
    assert.deepStrictEqual(result.purged, ['msg-1']);
  });
});
