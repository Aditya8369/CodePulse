import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ActorModelSupervisionTreeService } from './arch-svc-11.service.ts';

describe('ActorModelSupervisionTreeService (ARCH-SVC-11)', () => {
  it('registers actor and delivers messages to mailbox', () => {
    const tree = new ActorModelSupervisionTreeService('ONE_FOR_ONE');
    tree.registerActor('worker-1');
    const delivered = tree.sendMessage({
      id: 'm1',
      sender: 'root',
      targetActorId: 'worker-1',
      payload: { code: 'console.log(1)' },
      timestamp: Date.now()
    });
    assert.strictEqual(delivered, true);
    assert.strictEqual(tree.getQueueLength('worker-1'), 1);
  });

  it('routes messages to dead letter queue when actor stopped', () => {
    const tree = new ActorModelSupervisionTreeService();
    const delivered = tree.sendMessage({
      id: 'm2',
      sender: 'root',
      targetActorId: 'unregistered-worker',
      payload: 'noop',
      timestamp: Date.now()
    });
    assert.strictEqual(delivered, false);
    assert.strictEqual(tree.getDeadLetters().length, 1);
  });

  it('supervises and restarts failed actors up to maxRestarts then escalates', () => {
    const tree = new ActorModelSupervisionTreeService('ONE_FOR_ONE');
    tree.registerActor('worker-2', 2, 10000);

    const r1 = tree.handleActorFailure('worker-2', new Error('OOM'));
    assert.strictEqual(r1, 'RESTARTED');
    assert.strictEqual(tree.getActor('worker-2')?.restartCount, 1);

    const r2 = tree.handleActorFailure('worker-2', new Error('SegFault'));
    assert.strictEqual(r2, 'RESTARTED');
    assert.strictEqual(tree.getActor('worker-2')?.restartCount, 2);

    const r3 = tree.handleActorFailure('worker-2', new Error('Unrecoverable'));
    assert.strictEqual(r3, 'ESCALATED');
    assert.strictEqual(tree.getActor('worker-2')?.state, 'STOPPED');
  });
});
