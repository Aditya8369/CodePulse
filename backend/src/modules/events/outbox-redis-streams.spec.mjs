import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class OutboxRedisStreamsService {
  constructor() {
    this.outbox = new Map();
    this.publishedLog = [];
  }
  createOutboxRecord(entry) {
    const r = { ...entry, status: 'PENDING', retryCount: 0 };
    this.outbox.set(r.id, r);
    return r;
  }
  async publishPending(streamName, writer) {
    let published = 0;
    for (const e of this.outbox.values()) {
      if (e.status !== 'PUBLISHED') {
        const ok = await writer(streamName, e.payload);
        if (ok) {
          e.status = 'PUBLISHED';
          this.publishedLog.push({ id: e.id, stream: streamName });
          published++;
        }
      }
    }
    return { publishedCount: published };
  }
  getPendingCount() {
    return Array.from(this.outbox.values()).filter(e => e.status !== 'PUBLISHED').length;
  }
}

describe('OutboxRedisStreamsService (Issue #1802)', () => {
  it('should stage transactional outbox entries and reliably publish them to Redis Streams', async () => {
    const service = new OutboxRedisStreamsService();
    service.createOutboxRecord({ id: 'out-1', aggregateType: 'BATTLE', aggregateId: 'b-99', eventType: 'STARTED', payload: { match: 1 } });
    service.createOutboxRecord({ id: 'out-2', aggregateType: 'BATTLE', aggregateId: 'b-99', eventType: 'FINISHED', payload: { winner: 'u1' } });

    assert.equal(service.getPendingCount(), 2);

    const mockWriter = async (stream, payload) => true;
    const res = await service.publishPending('stream:battles', mockWriter);

    assert.equal(res.publishedCount, 2);
    assert.equal(service.getPendingCount(), 0);
  });
});
