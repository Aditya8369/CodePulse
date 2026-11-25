import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LamportLogicalTimestampService } from './arch-svc-87.service.ts';

describe('LamportLogicalTimestampService (ARCH-SVC-87)', () => {
  it('increments monotonically on local events and causal message reception', () => {
    const lamport = new LamportLogicalTimestampService();
    assert.strictEqual(lamport.tickLocal(), 1);
    assert.strictEqual(lamport.tickLocal(), 2);

    // Receive message with clock 10 from peer
    const updated = lamport.updateOnReceive(10);
    assert.strictEqual(updated, 11);
    assert.strictEqual(lamport.tickLocal(), 12);
  });
});
