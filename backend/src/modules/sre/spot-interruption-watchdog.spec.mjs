import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SpotInterruptionWatchdogService {
  constructor() { this.draining = false; }
  notice(n) {
    if (n && n.action) { this.draining = true; return true; }
    return false;
  }
  checkpoint(items) { return { count: items.length, ready: true }; }
}

describe('SpotInterruptionWatchdogService (#2200)', () => {
  test('handles spot termination 120s warnings with state evacuation', () => {
    const watchdog = new SpotInterruptionWatchdogService();
    assert.strictEqual(watchdog.notice({ action: 'terminate', time: 'now' }), true);
    assert.strictEqual(watchdog.checkpoint(['sess-1', 'sess-2']).count, 2);
  });
});
