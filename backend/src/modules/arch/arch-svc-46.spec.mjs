import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DistributedCronCoordinatorService } from './arch-svc-46.service.ts';

describe('DistributedCronCoordinatorService (ARCH-SVC-46)', () => {
  it('guarantees strictly one replica claims job execution within a given cron window', () => {
    const cron = new DistributedCronCoordinatorService();
    assert.strictEqual(cron.claimJobExecution('daily-billing', '2026-11-25:00:00'), true);
    assert.strictEqual(cron.claimJobExecution('daily-billing', '2026-11-25:00:00'), false);
  });
});
