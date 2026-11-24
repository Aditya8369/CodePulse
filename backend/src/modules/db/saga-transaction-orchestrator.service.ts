import { Injectable } from '@nestjs/common';

export interface SagaStep {
  name: string;
  execute: () => Promise<boolean>;
  compensate: () => Promise<void>;
}

@Injectable()
export class SagaTransactionOrchestratorService {
  public async executeSaga(steps: SagaStep[]): Promise<{ success: boolean; executedSteps: string[]; compensatedSteps: string[] }> {
    const executed: SagaStep[] = [];
    const compensated: string[] = [];

    for (const step of steps) {
      try {
        const ok = await step.execute();
        if (!ok) throw new Error(`Step ${step.name} returned failure`);
        executed.push(step);
      } catch {
        // Rollback compensating actions in reverse order
        for (let i = executed.length - 1; i >= 0; i--) {
          await executed[i].compensate();
          compensated.push(executed[i].name);
        }
        return { success: false, executedSteps: executed.map((s) => s.name), compensatedSteps: compensated };
      }
    }

    return { success: true, executedSteps: executed.map((s) => s.name), compensatedSteps: [] };
  }
}
