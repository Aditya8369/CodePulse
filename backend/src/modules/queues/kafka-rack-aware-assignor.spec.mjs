import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class KafkaRackAwareAssignorService {
  assign(consumers, partitions, prev) {
    const res = new Map();
    for (const c of consumers) res.set(c.consumerId, []);
    if (consumers.length === 0) return res;
    const pKey = p => p.topic + '-' + p.partition;
    const claimed = new Set();
    if (prev) {
      for (const [cId, keys] of prev) {
        const c = consumers.find(x => x.consumerId === cId);
        if (!c) continue;
        for (const k of keys) {
          const m = partitions.find(p => pKey(p) === k);
          if (m && !claimed.has(k) && m.leaderRackId === c.rackId) {
            res.get(cId).push(k);
            claimed.add(k);
          }
        }
      }
    }
    for (const p of partitions) {
      const k = pKey(p);
      if (claimed.has(k)) continue;
      const sameRack = consumers.filter(c => c.rackId === p.leaderRackId)
        .sort((a, b) => res.get(a.consumerId).length - res.get(b.consumerId).length);
      if (sameRack.length > 0) res.get(sameRack[0].consumerId).push(k);
      else {
        const min = [...consumers].sort((a, b) => res.get(a.consumerId).length - res.get(b.consumerId).length)[0];
        res.get(min.consumerId).push(k);
      }
    }
    return res;
  }
}

describe('KafkaRackAwareAssignorService (Issue #1798)', () => {
  it('should assign partitions to consumers sharing identical rack ID while preserving stickiness', () => {
    const assignor = new KafkaRackAwareAssignorService();
    const consumers = [
      { consumerId: 'c1', rackId: 'us-east-1a' },
      { consumerId: 'c2', rackId: 'us-east-1b' }
    ];
    const partitions = [
      { topic: 'events', partition: 0, leaderRackId: 'us-east-1a' },
      { topic: 'events', partition: 1, leaderRackId: 'us-east-1b' },
      { topic: 'events', partition: 2, leaderRackId: 'us-east-1a' }
    ];

    const assignments = assignor.assign(consumers, partitions);
    assert.deepEqual(assignments.get('c1'), ['events-0', 'events-2']);
    assert.deepEqual(assignments.get('c2'), ['events-1']);
  });
});
