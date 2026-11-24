export type SagaState = 'STARTED' | 'EXECUTING' | 'COMPENSATING' | 'COMPLETED' | 'FAILED';

export interface SagaStep<T = any> {
  name: string;
  execute: (context: T) => Promise<any>;
  compensate: (context: T) => Promise<void>;
  timeoutMs?: number;
}

/**
 * DistributedSagaOrchestrator
 * Coordinates forward steps and automatically executes reverse compensating transactions
 * if any step fails or times out (> 10s watchdog).
 */
export class DistributedSagaOrchestrator<T = any> {
  private readonly steps: SagaStep<T>[] = [];
  private state: SagaState = 'STARTED';
  private readonly executedSteps: SagaStep<T>[] = [];

  addStep(step: SagaStep<T>): this {
    this.steps.push(step);
    return this;
  }

  getState(): SagaState {
    return this.state;
  }

  async execute(context: T): Promise<{ success: boolean; state: SagaState; error?: string }> {
    this.state = 'EXECUTING';

    for (const step of this.steps) {
      try {
        const timeoutMs = step.timeoutMs || 10000;
        await this.runWithTimeout(step.execute(context), timeoutMs, step.name);
        this.executedSteps.push(step);
      } catch (err: any) {
        // Step failed or timed out: initiate compensation in LIFO order
        this.state = 'COMPENSATING';
        await this.compensate(context);
        this.state = 'FAILED';
        return { success: false, state: this.state, error: err.message };
      }
    }

    this.state = 'COMPLETED';
    return { success: true, state: this.state };
  }

  private async compensate(context: T): Promise<void> {
    const toCompensate = [...this.executedSteps].reverse();
    for (const step of toCompensate) {
      try {
        await step.compensate(context);
      } catch (compErr) {
        // Log compensation error without breaking chain
        console.error(`Failed to compensate step ${step.name}:`, compErr);
      }
    }
  }

  private runWithTimeout<R>(promise: Promise<R>, ms: number, stepName: string): Promise<R> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Saga step '${stepName}' timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
  }
}
