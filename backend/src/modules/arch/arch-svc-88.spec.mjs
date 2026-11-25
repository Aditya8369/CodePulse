import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ChaosInjectionHookService } from './arch-svc-88.service.ts';

describe('ChaosInjectionHookService (ARCH-SVC-88)', () => {
  it('simulates controlled chaos packet drop rates', () => {
    const chaos = new ChaosInjectionHookService();
    chaos.setDropRate(0.0);
    assert.strictEqual(chaos.shouldDropPacket(), false);

    chaos.setDropRate(1.0);
    assert.strictEqual(chaos.shouldDropPacket(), true);
  });
});
