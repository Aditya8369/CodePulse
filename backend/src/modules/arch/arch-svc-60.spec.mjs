import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DistributedStateMachineService } from './arch-svc-60.service.ts';

describe('DistributedStateMachineService (ARCH-SVC-60)', () => {
  it('executes valid state machine transitions deterministically', () => {
    const sm = new DistributedStateMachineService({
      initialState: 'DRAFT',
      transitions: {
        DRAFT: { SUBMIT: 'PENDING_REVIEW' },
        PENDING_REVIEW: { APPROVE: 'PUBLISHED', REJECT: 'REJECTED' }
      }
    });

    sm.initialize('challenge-101');
    assert.strictEqual(sm.getState('challenge-101'), 'DRAFT');

    const t1 = sm.transition('challenge-101', 'SUBMIT');
    assert.strictEqual(t1.success, true);
    assert.strictEqual(t1.state, 'PENDING_REVIEW');

    const tInvalid = sm.transition('challenge-101', 'SUBMIT'); // invalid in review
    assert.strictEqual(tInvalid.success, false);
    assert.strictEqual(tInvalid.state, 'PENDING_REVIEW');
  });
});
