import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MeteringEventDeduplicatorService {
  constructor() { this.seen = new Set(); }
  process(evt) {
    if (this.seen.has(evt.key)) return { ok: false, units: 0 };
    this.seen.add(evt.key);
    return { ok: true, units: evt.units };
  }
}

describe('MeteringEventDeduplicatorService (#2385)', () => {
  test('ingests first-time usage events and drops duplicates based on idempotency keys', () => {
    const dedupe = new MeteringEventDeduplicatorService();
    const first = dedupe.process({ key: 'evt_001', units: 100 });
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.units, 100);

    const dup = dedupe.process({ key: 'evt_001', units: 100 });
    assert.strictEqual(dup.ok, false);
    assert.strictEqual(dup.units, 0);
  });
});
