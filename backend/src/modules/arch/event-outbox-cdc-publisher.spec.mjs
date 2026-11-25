import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EventOutboxCdcPublisherService {
  constructor() { this.store = []; }
  append(r) {
    const entry = { ...r, pub: false };
    this.store.push(entry);
    return entry;
  }
  sweep(fn) {
    let count = 0;
    this.store.forEach(r => {
      if (!r.pub && fn(r)) { r.pub = true; count++; }
    });
    return count;
  }
}

describe('EventOutboxCdcPublisherService (#2714)', () => {
  test('persists outbox records and marks them published upon CDC stream dispatch', () => {
    const outbox = new EventOutboxCdcPublisherService();
    outbox.append({ id: '1', event: 'USER_CREATED' });
    outbox.append({ id: '2', event: 'USER_UPDATED' });

    const published = outbox.sweep(() => true);
    assert.strictEqual(published, 2);
    assert.strictEqual(outbox.store[0].pub, true);
    assert.strictEqual(outbox.store[1].pub, true);
  });
});
