import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ZeroAllocationLoggerService {
  constructor(capacity = 100) {
    this.capacity = capacity;
    this.ringBuffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
  log(level, msg, context) {
    const line = JSON.stringify({ level, msg, context, ts: new Date().toISOString() });
    this.ringBuffer[this.tail] = line;
    this.tail = (this.tail + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
    else this.head = (this.head + 1) % this.capacity;
  }
  drain() {
    const items = [];
    while (this.count > 0) {
      items.push(this.ringBuffer[this.head]);
      this.head = (this.head + 1) % this.capacity;
      this.count--;
    }
    return items;
  }
  getBufferedCount() { return this.count; }
}

describe('ZeroAllocationLoggerService (Issue #1464)', () => {
  it('should buffer logs in ring-buffer and drain without dropping data', () => {
    const logger = new ZeroAllocationLoggerService(10);
    logger.log('INFO', 'User signed in', { userId: 101 });
    logger.log('WARN', 'Rate limit approaching', { count: 95 });

    assert.equal(logger.getBufferedCount(), 2);
    const lines = logger.drain();
    assert.equal(lines.length, 2);
    assert.equal(logger.getBufferedCount(), 0);

    const first = JSON.parse(lines[0]);
    assert.equal(first.level, 'INFO');
    assert.equal(first.msg, 'User signed in');
  });

  it('should wrap around gracefully when ring buffer capacity is exceeded', () => {
    const logger = new ZeroAllocationLoggerService(3);
    logger.log('INFO', 'm1');
    logger.log('INFO', 'm2');
    logger.log('INFO', 'm3');
    logger.log('INFO', 'm4'); // Overwrites m1

    assert.equal(logger.getBufferedCount(), 3);
    const lines = logger.drain().map(l => JSON.parse(l).msg);
    assert.deepEqual(lines, ['m2', 'm3', 'm4']);
  });
});
