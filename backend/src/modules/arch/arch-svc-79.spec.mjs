import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TournamentPriorityBypassQueueService } from './arch-svc-79.service.ts';

describe('TournamentPriorityBypassQueueService (ARCH-SVC-79)', () => {
  it('dispatches live tournament submissions ahead of regular submissions', () => {
    const queue = new TournamentPriorityBypassQueueService();
    queue.enqueueSubmission('sub-regular-1', false);
    queue.enqueueSubmission('sub-regular-2', false);
    queue.enqueueSubmission('sub-tournament-1', true);

    assert.strictEqual(queue.dequeueNext(), 'sub-tournament-1');
    assert.strictEqual(queue.dequeueNext(), 'sub-regular-1');
  });
});
