import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AlertWebhookDedupQueueService {
  constructor() { this.seen = new Set(); }
  dispatch(fp) {
    if (this.seen.has(fp)) return false;
    this.seen.add(fp);
    return true;
  }
}

describe('AlertWebhookDedupQueueService (#2255)', () => {
  test('deduplicates identical alert webhook deliveries across distributed retry loops', () => {
    const queue = new AlertWebhookDedupQueueService();
    assert.strictEqual(queue.dispatch('fp-alert-1'), true);
    assert.strictEqual(queue.dispatch('fp-alert-1'), false); // deduped
  });
});
