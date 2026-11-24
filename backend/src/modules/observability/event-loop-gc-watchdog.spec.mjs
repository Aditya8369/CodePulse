import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class EventLoopGCWatchdogService {
  evaluateLag(ms) {
    if (ms > 200) return { isBlocked: true, severity: 'CRITICAL' };
    if (ms > 50) return { isBlocked: false, severity: 'WARN' };
    return { isBlocked: false, severity: 'HEALTHY' };
  }
}

describe('EventLoopGCWatchdogService (Issue #1901)', () => {
  it('should classify event loop lag severity levels', () => {
    const watchdog = new EventLoopGCWatchdogService();
    assert.equal(watchdog.evaluateLag(10).severity, 'HEALTHY');
    assert.equal(watchdog.evaluateLag(80).severity, 'WARN');
    assert.equal(watchdog.evaluateLag(250).severity, 'CRITICAL');
  });
});
