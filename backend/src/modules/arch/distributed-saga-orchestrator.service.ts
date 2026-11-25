import { Injectable, Logger } from '@nestjs/common';

export interface SagaStep {
  name: string;
  execute: () => Promise<boolean>;
  compensate: () => Promise<void>;
}

@Injectable()
export class DistributedSagaOrchestratorService {
  private readonly logger = new Logger(DistributedSagaOrchestratorService.name);

  public async executeSaga(steps: SagaStep[]): Promise<{ success: boolean; executedSteps: string[]; compensatedSteps: string[] }> {
    const executed: SagaStep[] = [];
    const compensatedSteps: string[] = [];

    for (const step of steps) {
      try {
        const ok = await step.execute();
        if (!ok) {
          throw new Error(`Step ${step.name} failed`);
        }
        executed.push(step);
      } catch (err) {
        this.logger.error(`Saga step failed at ${step.name}. Initiating compensating rollbacks in reverse.`);

        // Rollback executed steps in LIFO order
        for (let i = executed.length - 1; i >= 0; i--) {
          const comp = executed[i];
          await comp.compensate();
          compensatedSteps.push(comp.name);
        }

        return {
          success: false,
          executedSteps: executed.map(s => s.name),
          compensatedSteps
        };
      }
    }

    return {
      success: true,
      executedSteps: executed.map(s => s.name),
      compensatedSteps: []
    };
  }
}
