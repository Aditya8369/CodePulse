import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MultiTopicAuditAggregatorService {
  constructor() { this.e = []; }
  ingest(topic, id, action, time = Date.now()) { this.e.push({ topic, id, action, time }); }
  trail(limit = 100) {
    return [...this.e].sort((a, b) => a.time - b.time).slice(0, limit);
  }
}

describe('MultiTopicAuditAggregatorService (#2301)', () => {
  test('aggregates events across topics and orders them chronologically', () => {
    const agg = new MultiTopicAuditAggregatorService();
    agg.ingest('auth', 'e1', 'LOGIN', 2000);
    agg.ingest('billing', 'e2', 'CHARGE', 1000);

    const trail = agg.trail();
    assert.strictEqual(trail[0].id, 'e2');
    assert.strictEqual(trail[1].id, 'e1');
  });
});
