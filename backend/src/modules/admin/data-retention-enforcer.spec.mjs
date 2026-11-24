import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DataRetentionEnforcerService {
  prune(recs, days, now) {
    const cutoff = now - (days * 86400000);
    const kept = recs.filter(r => r.ts >= cutoff);
    return { kept, pruned: recs.length - kept.length };
  }
}

describe('DataRetentionEnforcerService (#2403)', () => {
  test('prunes telemetry records exceeding defined retention cutoff days', () => {
    const enforcer = new DataRetentionEnforcerService();
    const now = 100000000000;
    const records = [
      { id: 'r1', ts: now - (10 * 86400000) }, // 10 days old
      { id: 'r2', ts: now - (40 * 86400000) }  // 40 days old
    ];

    const res = enforcer.prune(records, 30, now);
    assert.strictEqual(res.pruned, 1);
    assert.strictEqual(res.kept[0].id, 'r1');
  });
});
