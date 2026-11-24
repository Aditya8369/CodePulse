import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class BullMQStalledJobReaperService {
  evaluateJob(job, now = Date.now(), timeout = 1000) {
    if (now - job.lastHeartbeat < timeout) return 'ACTIVE';
    if (job.attemptsMade + 1 >= job.maxAttempts) return 'QUARANTINE';
    return 'REDRIVE';
  }
}

describe('BullMQStalledJobReaperService (Issue #1873)', () => {
  it('should quarantine poison pill jobs and redrive stalled recoverable jobs', () => {
    const reaper = new BullMQStalledJobReaperService();
    const now = 10000;

    assert.equal(reaper.evaluateJob({ jobId: '1', attemptsMade: 0, maxAttempts: 3, lastHeartbeat: 9500 }, now), 'ACTIVE');
    assert.equal(reaper.evaluateJob({ jobId: '2', attemptsMade: 1, maxAttempts: 3, lastHeartbeat: 5000 }, now), 'REDRIVE');
    assert.equal(reaper.evaluateJob({ jobId: '3', attemptsMade: 2, maxAttempts: 3, lastHeartbeat: 5000 }, now), 'QUARANTINE');
  });
});
