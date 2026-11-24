export interface SagaStep {
  name: string;
  forwardAction: () => Promise<boolean>;
  compensatingAction: () => Promise<boolean>;
}

export interface SagaExecutionResult {
  sagaId: string;
  success: boolean;
  executedSteps: string[];
  compensatedSteps: string[];
  escalatedToManualIntervention: boolean;
}

export class SagaRollbackEscalationService {
  public async executeSaga(sagaId: string, steps: SagaStep[]): Promise<SagaExecutionResult> {
    const executed: SagaStep[] = [];
    const compensatedSteps: string[] = [];
    let failureOccurred = false;

    for (const step of steps) {
      try {
        const ok = await step.forwardAction();
        if (ok) {
          executed.push(step);
        } else {
          failureOccurred = true;
          break;
        }
      } catch (err) {
        failureOccurred = true;
        break;
      }
    }

    if (!failureOccurred) {
      return {
        sagaId,
        success: true,
        executedSteps: executed.map(s => s.name),
        compensatedSteps: [],
        escalatedToManualIntervention: false
      };
    }

    // Execute backward compensations in reverse order
    let escalationNeeded = false;
    for (let i = executed.length - 1; i >= 0; i--) {
      const step = executed[i];
      try {
        const compOk = await step.compensatingAction();
        if (compOk) {
          compensatedSteps.push(step.name);
        } else {
          escalationNeeded = true;
        }
      } catch (compErr) {
        escalationNeeded = true;
      }
    }

    return {
      sagaId,
      success: false,
      executedSteps: executed.map(s => s.name),
      compensatedSteps,
      escalatedToManualIntervention: escalationNeeded
    };
  }
}
