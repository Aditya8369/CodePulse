import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class PostgresTableBloatOptimizerService {
  check(live, dead) {
    const r = dead / (live + dead);
    return r >= 0.2;
  }
}

describe('PostgresTableBloatOptimizerService (#2160)', () => {
  test('flags tables exceeding 20% dead tuple bloat for proactive auto-vacuuming', () => {
    const opt = new PostgresTableBloatOptimizerService();
    assert.strictEqual(opt.check(1000, 100), false); // 9% bloat
    assert.strictEqual(opt.check(1000, 300), true);  // 23% bloat
  });
});
