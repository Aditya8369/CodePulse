import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DisruptorRingBufferRecoveryService {
  constructor(size = 8) {
    this.bufferSize = size;
    this.buffer = new Array(size).fill(null).map(() => ({ sequence: -1, data: null, published: false }));
    this.cursor = -1;
    this.consumerSequence = 0;
    this.droppedEventsCount = 0;
  }
  publish(data) {
    const nextSeq = ++this.cursor;
    const index = nextSeq & (this.bufferSize - 1);
    let overrun = false;
    if (nextSeq - this.consumerSequence >= this.bufferSize) {
      overrun = true;
      this.droppedEventsCount += (nextSeq - this.consumerSequence - this.bufferSize + 1);
      this.consumerSequence = nextSeq - this.bufferSize + 1;
    }
    this.buffer[index] = { sequence: nextSeq, data, published: true };
    return { sequence: nextSeq, overrunDetected: overrun };
  }
  consumeNext() {
    if (this.consumerSequence > this.cursor) return { sequence: this.consumerSequence, data: null, available: false };
    const index = this.consumerSequence & (this.bufferSize - 1);
    const slot = this.buffer[index];
    if (!slot || !slot.published || slot.sequence !== this.consumerSequence) return { sequence: this.consumerSequence, data: null, available: false };
    const item = slot.data;
    const seq = slot.sequence;
    this.consumerSequence++;
    return { sequence: seq, data: item, available: true };
  }
}

describe('DisruptorRingBufferRecoveryService (#2107)', () => {
  test('recovers from ring buffer sequence overruns without consumer lockup', () => {
    const buffer = new DisruptorRingBufferRecoveryService(4);
    buffer.publish('event-0');
    buffer.publish('event-1');
    buffer.publish('event-2');
    buffer.publish('event-3');

    // 5th event wraps around and overruns consumer sequence 0
    const res = buffer.publish('event-4');
    assert.strictEqual(res.overrunDetected, true);
    assert.strictEqual(buffer.droppedEventsCount > 0, true);

    const c = buffer.consumeNext();
    assert.strictEqual(c.available, true);
    assert.strictEqual(c.data, 'event-1');
  });
});
