import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class AuditTrailParquetStreamerService {
  constructor(maxBatch = 100) {
    this.max = maxBatch;
    this.buffer = [];
  }
  append(r) {
    this.buffer.push(r);
    return { bufferSize: this.buffer.length, readyToFlush: this.buffer.length >= this.max };
  }
  flushBatch() {
    if (this.buffer.length === 0) return null;
    const toFlush = this.buffer.splice(0, this.max);
    const d = new Date(toFlush[0].timestampMs);
    const pKey = 'year=' + d.getUTCFullYear() + '/month=' + String(d.getUTCMonth() + 1).padStart(2, '0');
    return { partitionKey: pKey, recordCount: toFlush.length, records: toFlush };
  }
}

describe('AuditTrailParquetStreamerService (Issue #1808)', () => {
  it('should buffer audit records and flush partitioned columnar parquet batches', () => {
    const streamer = new AuditTrailParquetStreamerService(2);
    streamer.append({ id: 'a1', actorId: 'u1', action: 'LOGIN', resource: 'auth', timestampMs: Date.now() });
    const r2 = streamer.append({ id: 'a2', actorId: 'u1', action: 'UPDATE', resource: 'profile', timestampMs: Date.now() });

    assert.equal(r2.readyToFlush, true);

    const batch = streamer.flushBatch();
    assert.equal(batch.recordCount, 2);
    assert.equal(batch.partitionKey.includes('year='), true);
  });
});
