import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ReplicationDecodingLeakDetectorService {
  constructor() { this.c = 0; }
  in() { return ++this.c > 5; }
  ack() { this.c = Math.max(0, this.c - 1); }
}

describe('ReplicationDecodingLeakDetectorService (#2164)', () => {
  test('flags memory accumulation in replication stream decode queue', () => {
    const detector = new ReplicationDecodingLeakDetectorService();
    for (let i = 0; i < 5; i++) detector.in();
    assert.strictEqual(detector.in(), true); // Exceeded 5 packets
    detector.ack();
    assert.strictEqual(detector.c, 5);
  });
});
