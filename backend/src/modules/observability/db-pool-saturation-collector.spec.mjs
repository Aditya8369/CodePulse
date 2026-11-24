import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DbPoolSaturationCollectorService {
  compute(act, max, wait) {
    const ratio = act / max;
    return { ratio, exhausted: ratio >= 1.0 || wait > 10 };
  }
}

describe('DbPoolSaturationCollectorService (#2242)', () => {
  test('monitors database connection pool utilization and queuing saturation', () => {
    const collector = new DbPoolSaturationCollectorService();
    assert.strictEqual(collector.compute(10, 20, 0).exhausted, false);
    assert.strictEqual(collector.compute(20, 20, 25).exhausted, true);
  });
});
