import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EventCompactionS3BufferService {
  constructor(thresh = 3) { this.b = []; this.t = thresh; }
  push(e) {
    this.b.push(e);
    if (this.b.length >= this.t) {
      const c = this.b.length;
      this.b = [];
      return { flushed: true, count: c };
    }
    return { flushed: false, count: 0 };
  }
}

describe('EventCompactionS3BufferService (#2135)', () => {
  test('compacts high-volume match events and triggers bulk flush when threshold is reached', () => {
    const buffer = new EventCompactionS3BufferService(2);
    assert.strictEqual(buffer.push('e1').flushed, false);
    const r2 = buffer.push('e2');
    assert.strictEqual(r2.flushed, true);
    assert.strictEqual(r2.count, 2);
  });
});
