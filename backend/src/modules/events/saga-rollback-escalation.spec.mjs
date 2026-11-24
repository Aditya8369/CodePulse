import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SagaRollbackEscalationService {
  async executeSaga(sagaId, steps) {
    const executed = [];
    const compensated = [];
    let failed = false;
    for (const s of steps) {
      try {
        if (await s.forwardAction()) executed.push(s);
        else { failed = true; break; }
      } catch { failed = true; break; }
    }
    if (!failed) return { sagaId, success: true, executedSteps: executed.map(s => s.name), compensatedSteps: [] };
    let escalated = false;
    for (let i = executed.length - 1; i >= 0; i--) {
      try {
        if (await executed[i].compensatingAction()) compensated.push(executed[i].name);
        else escalated = true;
      } catch { escalated = true; }
    }
    return { sagaId, success: false, executedSteps: executed.map(s => s.name), compensatedSteps: compensated, escalatedToManualIntervention: escalated };
  }
}

describe('SagaRollbackEscalationService (Issue #1809)', () => {
  it('should execute reverse compensating transactions when downstream step fails', async () => {
    const coordinator = new SagaRollbackEscalationService();
    const rollbackLog = [];

    const steps = [
      {
        name: 'ReserveSlot',
        forwardAction: async () => true,
        compensatingAction: async () => { rollbackLog.push('ReleaseSlot'); return true; }
      },
      {
        name: 'DeductTokens',
        forwardAction: async () => true,
        compensatingAction: async () => { rollbackLog.push('RefundTokens'); return true; }
      },
      {
        name: 'ProvisionSandbox',
        forwardAction: async () => false, // Fails!
        compensatingAction: async () => true
      }
    ];

    const result = await coordinator.executeSaga('saga-001', steps);
    assert.equal(result.success, false);
    assert.equal(result.compensatedSteps.length, 2);
    assert.deepEqual(rollbackLog, ['RefundTokens', 'ReleaseSlot']);
  });
});
