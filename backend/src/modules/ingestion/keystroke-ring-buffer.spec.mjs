import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class KeystrokeRingBufferService {
  constructor(capacity = 1000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
    this.droppedCount = 0;
  }
  push(event) {
    if (this.size === this.capacity) {
      this.tail = (this.tail + 1) % this.capacity;
      this.droppedCount++;
    } else {
      this.size++;
    }
    this.buffer[this.head] = event;
    this.head = (this.head + 1) % this.capacity;
    return true;
  }
  drainMicroBatch(maxItems = 50) {
    const batch = [];
    const count = Math.min(maxItems, this.size);
    for (let i = 0; i < count; i++) {
      const item = this.buffer[this.tail];
      if (item) {
        batch.push(item);
        this.buffer[this.tail] = null;
      }
      this.tail = (this.tail + 1) % this.capacity;
      this.size--;
    }
    return batch;
  }
  getSize() { return this.size; }
  getDroppedCount() { return this.droppedCount; }
}

describe('KeystrokeRingBufferService (Issue #1797)', () => {
  it('should support O(1) keystroke insertion and drain micro-batches with ring buffer semantics', () => {
    const ring = new KeystrokeRingBufferService(5);
    for (let i = 1; i <= 5; i++) {
      ring.push({ userId: 'u1', battleId: 'b1', key: 'k' + i, timestamp: Date.now() });
    }
    assert.equal(ring.getSize(), 5);

    // Push 6th item causing overflow overwrite
    ring.push({ userId: 'u1', battleId: 'b1', key: 'k6', timestamp: Date.now() });
    assert.equal(ring.getSize(), 5);
    assert.equal(ring.getDroppedCount(), 1);

    const batch = ring.drainMicroBatch(3);
    assert.equal(batch.length, 3);
    assert.equal(batch[0].key, 'k2', 'Oldest preserved item should be k2');
    assert.equal(ring.getSize(), 2);
  });
});
