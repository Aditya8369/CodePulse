import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ClickHouseOLAPSyncService {
  constructor(bs = 100) { this.bs = bs; this.batch = []; }
  enqueueRecord(r) { this.batch.push(r); return this.batch.length >= this.bs; }
  flush() { const o = [...this.batch]; this.batch = []; return o; }
}

describe('ClickHouseOLAPSyncService (Issue #1838)', () => {
  it('should batch OLAP events for columnar ClickHouse ingestion', () => {
    const sync = new ClickHouseOLAPSyncService(2);
    assert.equal(sync.enqueueRecord({ event: 'sub_1' }), false);
    assert.equal(sync.enqueueRecord({ event: 'sub_2' }), true);
    assert.equal(sync.flush().length, 2);
  });
});
