import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DistributedSagaOrchestratorService {
  async run(steps) {
    const exec = [];
    const comp = [];
    for (const s of steps) {
      try {
        const ok = await s.exec();
        if (!ok) throw new Error();
        exec.push(s);
      } catch {
        for (let i = exec.length - 1; i >= 0; i--) {
          await exec[i].comp();
          comp.push(exec[i].name);
        }
        return { success: false, comp };
      }
    }
    return { success: true, comp: [] };
  }
}

describe('DistributedSagaOrchestratorService (#2709)', () => {
  test('executes compensating rollbacks in reverse order when a middle saga step fails', async () => {
    const orchestrator = new DistributedSagaOrchestratorService();
    let step1Reverted = false;

    const steps = [
      { name: 'reserveInventory', exec: async () => true, comp: async () => { step1Reverted = true; } },
      { name: 'chargePayment', exec: async () => false, comp: async () => {} }
    ];

    const res = await orchestrator.run(steps);
    assert.strictEqual(res.success, false);
    assert.strictEqual(step1Reverted, true);
    assert.deepStrictEqual(res.comp, ['reserveInventory']);
  });
});
