import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TransactionBoundaryValidatorService } from './arch-svc-67.service.ts';

describe('TransactionBoundaryValidatorService (ARCH-SVC-67)', () => {
  it('enforces that domain events are coupled to active database transaction contexts', () => {
    const validator = new TransactionBoundaryValidatorService();
    const validCtx = { txId: 'tx-1', hasOpenTransaction: true, registeredEvents: [] };

    validator.validateEventDispatch(validCtx, 'ORDER_PLACED');
    assert.strictEqual(validCtx.registeredEvents.length, 1);

    const invalidCtx = { txId: 'tx-2', hasOpenTransaction: false, registeredEvents: [] };
    assert.throws(() => {
      validator.validateEventDispatch(invalidCtx, 'ORDER_PLACED');
    }, /must be dispatched within an active transaction/);
  });
});
