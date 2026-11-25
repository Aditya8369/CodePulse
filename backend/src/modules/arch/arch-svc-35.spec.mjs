import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DistributedWorkflowCheckpointingService } from './arch-svc-35.service.ts';

describe('DistributedWorkflowCheckpointingService (ARCH-SVC-35)', () => {
  it('persists and restores latest workflow execution checkpoints', () => {
    const engine = new DistributedWorkflowCheckpointingService();
    engine.saveCheckpoint('wf-99', 1, { status: 'INIT' });
    engine.saveCheckpoint('wf-99', 2, { status: 'PROCESSED', records: 100 });

    const latest = engine.getLatestCheckpoint('wf-99');
    assert.strictEqual(latest?.stepNumber, 2);
    assert.deepStrictEqual(latest?.state, { status: 'PROCESSED', records: 100 });
  });
});
