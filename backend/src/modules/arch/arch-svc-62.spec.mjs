import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SocketReconnectCoordinatorService } from './arch-svc-62.service.ts';

describe('SocketReconnectCoordinatorService (ARCH-SVC-62)', () => {
  it('computes exponential jitter delays and caps at maxAttempts', () => {
    const coordinator = new SocketReconnectCoordinatorService(100, 1000, 3);

    const r1 = coordinator.getNextReconnectDelay();
    assert.strictEqual(r1.canRetry, true);
    assert.ok(r1.delayMs >= 80 && r1.delayMs <= 120);

    const r2 = coordinator.getNextReconnectDelay();
    assert.strictEqual(r2.canRetry, true);

    const r3 = coordinator.getNextReconnectDelay();
    assert.strictEqual(r3.canRetry, true);

    const r4 = coordinator.getNextReconnectDelay();
    assert.strictEqual(r4.canRetry, false);
  });
});
