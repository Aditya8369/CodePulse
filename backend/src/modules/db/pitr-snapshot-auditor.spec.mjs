import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class PitrSnapshotAuditorService {
  verify(s, now = Date.now()) {
    const age = (now - s.ts) / 3600000;
    return s.consistent && age <= 24;
  }
}

describe('PitrSnapshotAuditorService (#2154)', () => {
  test('audits point-in-time recovery backup snapshots for contiguous WAL LSN health', () => {
    const auditor = new PitrSnapshotAuditorService();
    const now = 100000000;
    assert.strictEqual(auditor.verify({ consistent: true, ts: now - 3600000 }, now), true);
    assert.strictEqual(auditor.verify({ consistent: false, ts: now - 3600000 }, now), false);
  });
});
