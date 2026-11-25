import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ZeroCopyRingBufferIpcService {
  constructor(cap = 3) {
    this.cap = cap;
    this.b = new Array(cap);
    this.h = 0; this.t = 0; this.cnt = 0;
  }
  push(x) {
    if (this.cnt === this.cap) return false;
    this.b[this.t] = x;
    this.t = (this.t + 1) % this.cap;
    this.cnt++;
    return true;
  }
  pop() {
    if (this.cnt === 0) return null;
    const item = this.b[this.h];
    this.b[this.h] = null;
    this.h = (this.h + 1) % this.cap;
    this.cnt--;
    return item;
  }
}

describe('ZeroCopyRingBufferIpcService (#2712)', () => {
  test('manages FIFO circular buffer slots and indicates backpressure when full', () => {
    const ring = new ZeroCopyRingBufferIpcService(2);
    assert.strictEqual(ring.push('task1'), true);
    assert.strictEqual(ring.push('task2'), true);
    assert.strictEqual(ring.push('task3'), false); // Capacity 2 full

    assert.strictEqual(ring.pop(), 'task1');
    assert.strictEqual(ring.push('task3'), true); // Now has slot
    assert.strictEqual(ring.pop(), 'task2');
    assert.strictEqual(ring.pop(), 'task3');
  });
});
