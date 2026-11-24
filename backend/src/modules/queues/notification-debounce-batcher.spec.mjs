import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class NotificationDebounceBatcherService {
  constructor(max = 50) { this.b = new Map(); this.max = max; }
  add(u, p) {
    let buf = this.b.get(u) || [];
    buf.push(p);
    this.b.set(u, buf);
    return { count: buf.length, flushNow: buf.length >= this.max };
  }
  flush(u) {
    const l = this.b.get(u) || [];
    this.b.delete(u);
    return l;
  }
}

describe('NotificationDebounceBatcherService (#2306)', () => {
  test('buffers high-volume notifications per recipient and flushes digests', () => {
    const batcher = new NotificationDebounceBatcherService(3);
    assert.strictEqual(batcher.add('u1', { msg: '1' }).flushNow, false);
    assert.strictEqual(batcher.add('u1', { msg: '2' }).flushNow, false);
    assert.strictEqual(batcher.add('u1', { msg: '3' }).flushNow, true);

    const flushed = batcher.flush('u1');
    assert.strictEqual(flushed.length, 3);
    assert.strictEqual(batcher.flush('u1').length, 0);
  });
});
