import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SpotPreemptionWatchdogService {
  constructor() {
    this.isPreemptionTriggered = false;
    this.checkpoints = [];
  }
  handleTerminationNotice(notice, runningTasks) {
    this.isPreemptionTriggered = true;
    for (const t of runningTasks) {
      this.checkpoints.push({ taskId: t.id, statePayload: t.state, savedToSharedStorage: true });
    }
    return { preemptionHandled: true, checkpointsSaved: this.checkpoints.length };
  }
  shouldAcceptNewWork() { return !this.isPreemptionTriggered; }
}

describe('SpotPreemptionWatchdogService (Issue #1429)', () => {
  it('should intercept 2-minute preemption notice, stop new work, and checkpoint in-flight tasks', () => {
    const watchdog = new SpotPreemptionWatchdogService();
    assert.equal(watchdog.shouldAcceptNewWork(), true);

    const runningTasks = [
      { id: 'sub-401', state: { currentTest: 5, passed: 4 } },
      { id: 'sub-402', state: { currentTest: 12, passed: 11 } }
    ];

    const result = watchdog.handleTerminationNotice({ action: 'terminate', time: '2026-11-24T14:50:00Z' }, runningTasks);
    assert.equal(result.preemptionHandled, true);
    assert.equal(result.checkpointsSaved, 2);
    assert.equal(watchdog.shouldAcceptNewWork(), false, 'Must reject new assignments upon preemption notice');
  });
});
