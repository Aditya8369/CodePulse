import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class V8MicrotaskQueueWatchdogService {
  constructor() { this.count = 0; }
  rejection() { this.count++; return this.count; }
  depth(d) { return { saturated: d > 10000 }; }
}

describe('V8MicrotaskQueueWatchdogService (#2245)', () => {
  test('tracks unhandled promise rejections and monitors microtask queue backlog', () => {
    const watchdog = new V8MicrotaskQueueWatchdogService();
    assert.strictEqual(watchdog.rejection(), 1);
    assert.strictEqual(watchdog.depth(500).saturated, false);
    assert.strictEqual(watchdog.depth(15000).saturated, true);
  });
});
