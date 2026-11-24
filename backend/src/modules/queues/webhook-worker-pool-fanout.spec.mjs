import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class WebhookWorkerPoolFanoutService {
  constructor(poolSize = 4) { this.poolSize = poolSize; }
  partition(urls) {
    const batches = Array.from({ length: this.poolSize }, (_, i) => ({ id: i, urls: [] }));
    urls.forEach((u, idx) => batches[idx % this.poolSize].urls.push(u));
    return batches.filter(b => b.urls.length > 0);
  }
}

describe('WebhookWorkerPoolFanoutService (#2314)', () => {
  test('partitions webhook URLs evenly across worker thread pools for parallel dispatch', () => {
    const fanout = new WebhookWorkerPoolFanoutService(3);
    const urls = ['http://a.com', 'http://b.com', 'http://c.com', 'http://d.com'];
    const batches = fanout.partition(urls);

    assert.strictEqual(batches.length, 3);
    assert.strictEqual(batches[0].urls.length, 2); // a and d
    assert.strictEqual(batches[1].urls.length, 1); // b
    assert.strictEqual(batches[2].urls.length, 1); // c
  });
});
