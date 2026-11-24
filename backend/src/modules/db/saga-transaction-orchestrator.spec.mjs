import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SagaTransactionOrchestratorService {
  async executeSaga(steps) {
    const done = [];
    const comp = [];
    for (const s of steps) {
      try {
        const res = await s.execute();
        if (!res) throw new Error();
        done.push(s);
      } catch {
        for (let i = done.length - 1; i >= 0; i--) {
          await done[i].compensate();
          comp.push(done[i].name);
        }
        return { success: false, compensated: comp };
      }
    }
    return { success: true, compensated: [] };
  }
}

describe('SagaTransactionOrchestratorService (#2142)', () => {
  test('executes forward steps and triggers reverse compensating actions upon step failure', async () => {
    const saga = new SagaTransactionOrchestratorService();
    let walletDeducted = false;
    let inventoryReserved = false;

    const steps = [
      { name: 'deduct_wallet', execute: async () => { walletDeducted = true; return true; }, compensate: async () => { walletDeducted = false; } },
      { name: 'reserve_inventory', execute: async () => { inventoryReserved = true; return true; }, compensate: async () => { inventoryReserved = false; } },
      { name: 'charge_gateway', execute: async () => { return false; }, compensate: async () => {} },
    ];

    const result = await saga.executeSaga(steps);
    assert.strictEqual(result.success, false);
    assert.strictEqual(walletDeducted, false);
    assert.strictEqual(inventoryReserved, false);
  });
});
