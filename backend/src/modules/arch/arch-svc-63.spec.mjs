import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PipelineStepTimeoutSupervisorService } from './arch-svc-63.service.ts';

describe('PipelineStepTimeoutSupervisorService (ARCH-SVC-63)', () => {
  it('completes fast steps successfully before timeout', async () => {
    const supervisor = new PipelineStepTimeoutSupervisorService();
    const res = await supervisor.executeWithTimeout('compile', async () => 'OK', 1000);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.result, 'OK');
  });

  it('triggers abort signal and returns timedOut flag when execution exceeds limit', async () => {
    const supervisor = new PipelineStepTimeoutSupervisorService();
    const res = await supervisor.executeWithTimeout(
      'infinite-loop',
      async signal => {
        await new Promise(r => setTimeout(r, 200));
        return 'SHOULD_NOT_ARRIVE';
      },
      50
    );

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.timedOut, true);
  });
});
