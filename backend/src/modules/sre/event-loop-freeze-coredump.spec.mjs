import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EventLoopFreezeCoredumpService {
  evalLag(lag) {
    if (lag > 2000) return { freezeDetected: true, action: 'DUMP_DIAGNOSTICS' };
    return { freezeDetected: false, action: 'NONE' };
  }
}

describe('EventLoopFreezeCoredumpService (#2208)', () => {
  test('flags catastrophic event loop blocking lag for diagnostic capture', () => {
    const watchdog = new EventLoopFreezeCoredumpService();
    assert.strictEqual(watchdog.evalLag(15).freezeDetected, false);
    assert.strictEqual(watchdog.evalLag(2500).freezeDetected, true);
    assert.strictEqual(watchdog.evalLag(2500).action, 'DUMP_DIAGNOSTICS');
  });
});
