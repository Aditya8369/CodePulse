import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TwoPhaseCommitWatchdogService } from './arch-svc-13.service.ts';

describe('TwoPhaseCommitWatchdogService (ARCH-SVC-13)', () => {
  it('successfully commits 2PC transaction when all participants vote COMMIT', () => {
    const svc = new TwoPhaseCommitWatchdogService();
    svc.beginTransaction('tx-1', ['db-orders', 'db-inventory']);

    svc.votePrepare('tx-1', 'db-orders', 'COMMIT');
    const state = svc.votePrepare('tx-1', 'db-inventory', 'COMMIT');
    assert.strictEqual(state, 'PREPARED');

    const committed = svc.commit('tx-1');
    assert.strictEqual(committed, true);
    assert.strictEqual(svc.getTransaction('tx-1')?.state, 'COMMITTED');
  });

  it('aborts transaction immediately if any participant votes ABORT', () => {
    const svc = new TwoPhaseCommitWatchdogService();
    svc.beginTransaction('tx-2', ['db-orders', 'db-billing']);

    svc.votePrepare('tx-2', 'db-orders', 'COMMIT');
    const state = svc.votePrepare('tx-2', 'db-billing', 'ABORT');
    assert.strictEqual(state, 'ABORTED');
  });

  it('watchdog detects hung participants and triggers automatic abort', () => {
    const svc = new TwoPhaseCommitWatchdogService();
    svc.beginTransaction('tx-3', ['svc-auth', 'svc-payment'], 1000);
    svc.votePrepare('tx-3', 'svc-auth', 'COMMIT');

    const aborted = svc.checkWatchdog(Date.now() + 2000);
    assert.ok(aborted.includes('tx-3'));
    assert.strictEqual(svc.getTransaction('tx-3')?.state, 'ABORTED');
  });
});
