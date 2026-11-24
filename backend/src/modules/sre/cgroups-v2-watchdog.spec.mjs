import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CGroupsV2WatchdogService {
  evaluateResourcePressure(used, limit) {
    const r = used / limit;
    if (r >= 0.9) return { ratio: r, action: 'THROTTLE' };
    if (r >= 0.75) return { ratio: r, action: 'WARN' };
    return { ratio: r, action: 'NORMAL' };
  }
}

describe('CGroupsV2WatchdogService (Issue #1874)', () => {
  it('should detect memory and CPU limit pressure and recommend adaptive self-throttling', () => {
    const watchdog = new CGroupsV2WatchdogService();
    assert.equal(watchdog.evaluateResourcePressure(500, 1000).action, 'NORMAL');
    assert.equal(watchdog.evaluateResourcePressure(800, 1000).action, 'WARN');
    assert.equal(watchdog.evaluateResourcePressure(950, 1000).action, 'THROTTLE');
  });
});
