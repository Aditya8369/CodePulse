import { describe, it } from 'node:test';
import assert from 'node:assert';
import { IdempotentCommandBusService } from './arch-svc-19.service.ts';

describe('IdempotentCommandBusService (ARCH-SVC-19)', () => {
  it('executes command on first dispatch and caches outcome for subsequent duplicates', async () => {
    const bus = new IdempotentCommandBusService();
    let executions = 0;

    const cmd = {
      idempotencyKey: 'cmd-tx-001',
      commandType: 'CREATE_RECORD',
      payload: { id: 1 },
      timestamp: Date.now()
    };

    const r1 = await bus.executeCommand(cmd, async () => {
      executions++;
      return { status: 'CREATED' };
    });

    assert.strictEqual(r1.cached, false);
    assert.strictEqual(executions, 1);

    const r2 = await bus.executeCommand(cmd, async () => {
      executions++;
      return { status: 'SHOULD_NOT_RUN' };
    });

    assert.strictEqual(r2.cached, true);
    assert.strictEqual(r2.result.status, 'CREATED');
    assert.strictEqual(executions, 1);
  });
});
