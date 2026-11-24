import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SyntheticTransactionMonitorService {
  constructor(slaThresholdMs = 2000) {
    this.slaThresholdMs = slaThresholdMs;
  }
  async probeJourney(journeyName, region, steps) {
    const startTime = Date.now();
    for (const step of steps) {
      const timeoutMs = step.timeoutMs ?? 500;
      try {
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
        });
        await Promise.race([step.action(), timeoutPromise]).finally(() => clearTimeout(timer));
      } catch (e) {
        return { journeyName, region, success: false, totalDurationMs: Date.now() - startTime, failedStep: step.name, error: e.message };
      }
    }
    const totalDurationMs = Date.now() - startTime;
    return { journeyName, region, success: totalDurationMs <= this.slaThresholdMs, totalDurationMs };
  }
}

describe('SyntheticTransactionMonitorService (Issue #1466)', () => {
  it('should successfully execute user journey steps within SLA', async () => {
    const prober = new SyntheticTransactionMonitorService(1000);
    const result = await prober.probeJourney('Arena Battle Journey', 'us-east-1', [
      { name: 'SignIn', action: async () => {} },
      { name: 'JoinArena', action: async () => {} },
      { name: 'SubmitSolution', action: async () => {} },
      { name: 'VerifyLeaderboard', action: async () => {} }
    ]);

    assert.equal(result.success, true);
    assert.equal(result.journeyName, 'Arena Battle Journey');
  });

  it('should detect failing step in journey immediately', async () => {
    const prober = new SyntheticTransactionMonitorService();
    const result = await prober.probeJourney('Matchmaking', 'eu-west-1', [
      { name: 'SignIn', action: async () => {} },
      { name: 'JoinQueue', action: async () => { throw new Error('Queue full'); } }
    ]);

    assert.equal(result.success, false);
    assert.equal(result.failedStep, 'JoinQueue');
  });
});
