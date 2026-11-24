import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class KafkaPartitionDetectorService {
  constructor(timeoutMs = 3000, minISR = 2) {
    this.timeout = timeoutMs;
    this.minISR = minISR;
    this.brokers = new Map();
  }
  registerBroker(b) { this.brokers.set(b.brokerId, b); }
  evaluatePartition(bId, nowMs = Date.now()) {
    const b = this.brokers.get(bId);
    if (!b) return { isPartitioned: true, failoverRecommended: true };
    if (nowMs - b.lastHeartbeatMs > this.timeout) return { isPartitioned: true, failoverRecommended: true };
    if (b.inSyncReplicasCount < this.minISR) return { isPartitioned: true, failoverRecommended: true };
    return { isPartitioned: false, failoverRecommended: false };
  }
}

describe('KafkaPartitionDetectorService (Issue #1812)', () => {
  it('should detect network partitions and recommend failover on ISR drop or heartbeat timeouts', () => {
    const detector = new KafkaPartitionDetectorService(3000, 2);
    detector.registerBroker({ brokerId: 'b-1', isAlive: true, lastHeartbeatMs: 1000, inSyncReplicasCount: 3 });

    assert.equal(detector.evaluatePartition('b-1', 2000).failoverRecommended, false);
    assert.equal(detector.evaluatePartition('b-1', 5500).failoverRecommended, true); // Timed out

    detector.registerBroker({ brokerId: 'b-2', isAlive: true, lastHeartbeatMs: 5000, inSyncReplicasCount: 1 });
    assert.equal(detector.evaluatePartition('b-2', 5100).failoverRecommended, true); // ISR < 2
  });
});
