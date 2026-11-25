import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BulkMutationCoordinatorService } from './arch-svc-44.service.ts';

describe('BulkMutationCoordinatorService (ARCH-SVC-44)', () => {
  it('rolls back previously committed steps in reverse order upon step failure', async () => {
    const coordinator = new BulkMutationCoordinatorService();
    const log = [];

    const steps = [
      {
        name: 'step1',
        execute: async () => { log.push('exec1'); },
        rollback: async () => { log.push('roll1'); }
      },
      {
        name: 'step2',
        execute: async () => { throw new Error('fail'); },
        rollback: async () => { log.push('roll2'); }
      }
    ];

    const res = await coordinator.executePipeline(steps);
    assert.strictEqual(res.success, false);
    assert.deepStrictEqual(log, ['exec1', 'roll1']);
  });
});
