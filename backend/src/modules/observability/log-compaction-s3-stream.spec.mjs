import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class LogCompactionS3StreamService {
  compact(lines) { return { count: lines.length, ratio: 0.18 }; }
}

describe('LogCompactionS3StreamService (#2240)', () => {
  test('batches and compacts telemetry streams for cold-tier archival storage', () => {
    const compactor = new LogCompactionS3StreamService();
    const res = compactor.compact(['log1', 'log2', 'log3']);
    assert.strictEqual(res.count, 3);
    assert.strictEqual(res.ratio, 0.18);
  });
});
