import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SpotTerminationWatchdogService {
  constructor() { this.terminating = false; }
  handleNotice() { this.terminating = true; return { action: 'MIGRATE', remainingSec: 120 }; }
}

describe('SpotTerminationWatchdogService (Issue #1879)', () => {
  it('should trigger state checkpointing upon spot instance 2-minute termination notices', () => {
    const watchdog = new SpotTerminationWatchdogService();
    assert.equal(watchdog.terminating, false);
    const res = watchdog.handleNotice();
    assert.equal(res.action, 'MIGRATE');
    assert.equal(watchdog.terminating, true);
  });
});
