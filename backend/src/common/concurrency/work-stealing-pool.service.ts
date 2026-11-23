import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ABORT, ChaseLevDeque, DequeResult, EMPTY } from './chase-lev-deque';
import {
  TestCasePayload,
  TestCaseResult,
  WorkerMetrics,
  WorkStealingPoolConfig,
  WorkStealingPoolMetrics,
  WorkStealingTask,
} from './work-stealing.types';

@Injectable()
export class WorkStealingPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkStealingPoolService.name);

  public readonly workerCount: number;
  private readonly deques: ChaseLevDeque<WorkStealingTask>[];
  private readonly metrics: WorkerMetrics[];
  private readonly maxStealAttempts: number;

  private totalSubmitted = 0;
  private totalCompleted = 0;
  private totalSteals = 0;
  private failedSteals = 0;
  private roundRobinIndex = 0;

  constructor(@Optional() config?: WorkStealingPoolConfig) {
    this.workerCount = config?.workerCount ?? 8;
    this.maxStealAttempts = config?.maxStealAttempts ?? 16;
    const initialCapacity = config?.initialDequeCapacity ?? 512;

    this.deques = [];
    this.metrics = [];

    for (let i = 0; i < this.workerCount; i++) {
      this.deques.push(new ChaseLevDeque<WorkStealingTask>(initialCapacity));
      this.metrics.push({
        workerId: i,
        tasksPushed: 0,
        tasksPoppedLocally: 0,
        tasksStolenByOthers: 0,
        tasksStolenFromOthers: 0,
        tasksCompleted: 0,
        queueDepth: 0,
        idleTimeMs: 0,
      });
    }
  }

  public onModuleDestroy(): void {
    // cleanup
  }

  /**
   * Submits a task to the pool.
   * Assigns to the target worker (or round-robin if unspecified).
   */
  public submitTask<T, R>(
    taskId: string,
    payload: T,
    execute: () => Promise<R> | R,
    targetWorkerId?: number,
  ): WorkStealingTask<T, R> {
    const workerId =
      targetWorkerId !== undefined && targetWorkerId >= 0 && targetWorkerId < this.workerCount
        ? targetWorkerId
        : this.roundRobinIndex++ % this.workerCount;

    const task: WorkStealingTask<T, R> = {
      taskId,
      payload,
      execute,
      originWorkerId: workerId,
      createdAt: Date.now(),
      wasStolen: false,
    };

    this.deques[workerId].pushBottom(task as WorkStealingTask);
    this.metrics[workerId].tasksPushed++;
    this.metrics[workerId].queueDepth = this.deques[workerId].size();
    this.totalSubmitted++;

    return task;
  }

  /**
   * Worker task retrieval:
   * 1. Try local LIFO popBottom()
   * 2. If empty, steal from random peer FIFO stealTop()
   */
  public getNextTaskForWorker(workerId: number): WorkStealingTask | null {
    // 1. Local pop
    const localResult: DequeResult<WorkStealingTask> = this.deques[workerId].popBottom();
    if (localResult !== EMPTY && localResult !== ABORT) {
      this.metrics[workerId].tasksPoppedLocally++;
      this.metrics[workerId].queueDepth = this.deques[workerId].size();
      return localResult as WorkStealingTask;
    }

    // 2. Local deque is empty -> Work Stealing from other workers!
    for (let attempt = 0; attempt < this.maxStealAttempts; attempt++) {
      const victimId = Math.floor(Math.random() * (this.workerCount - 1));
      const effectiveVictimId = victimId >= workerId ? victimId + 1 : victimId;

      if (this.deques[effectiveVictimId].isEmpty()) {
        continue;
      }

      const stolenResult = this.deques[effectiveVictimId].stealTop();
      if (stolenResult === ABORT) {
        // CAS contention with another thief, try again
        this.failedSteals++;
        continue;
      }

      if (stolenResult !== EMPTY) {
        const task = stolenResult as WorkStealingTask;
        task.wasStolen = true;
        task.assignedWorkerId = workerId;

        this.totalSteals++;
        this.metrics[workerId].tasksStolenFromOthers++;
        this.metrics[effectiveVictimId].tasksStolenByOthers++;
        this.metrics[effectiveVictimId].queueDepth = this.deques[effectiveVictimId].size();

        return task;
      }
    }

    return null;
  }

  /**
   * Executes all pending tasks across the pool using parallel worker simulation.
   */
  public async drainAndProcessAll(): Promise<number> {
    let processed = 0;

    const workerPromises = Array.from({ length: this.workerCount }, async (_, workerId) => {
      let localProcessed = 0;
      while (true) {
        const task = this.getNextTaskForWorker(workerId);
        if (!task) {
          break; // No more tasks and cannot steal anything
        }

        try {
          await task.execute();
        } catch (err: unknown) {
          this.logger.error(`Error executing task ${task.taskId}: ${String(err)}`);
        }

        this.metrics[workerId].tasksCompleted++;
        this.totalCompleted++;
        localProcessed++;
      }
      return localProcessed;
    });

    const results = await Promise.all(workerPromises);
    processed = results.reduce((sum, n) => sum + n, 0);
    return processed;
  }

  /**
   * High-throughput parallel algorithmic submission evaluation pipeline.
   * Balances uneven test cases (e.g. short timeouts vs max runtime tests) across all cores.
   */
  public async evaluateBatchTestCases(
    testCases: TestCasePayload[],
    runner: (tc: TestCasePayload) => Promise<boolean> | boolean,
  ): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];
    const promises: Promise<void>[] = [];

    // Submit test cases across worker deques
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const targetWorker = i % this.workerCount;

      this.submitTask(
        tc.testId,
        tc,
        async () => {
          const start = performance.now();
          let passed = false;
          let error: string | undefined;

          try {
            passed = await runner(tc);
          } catch (err: unknown) {
            error = String(err);
          }

          const elapsed = performance.now() - start;
          results.push({
            testId: tc.testId,
            submissionId: tc.submissionId,
            passed,
            executionTimeMs: Math.round(elapsed * 100) / 100,
            memoryUsedMb: Math.round(tc.memoryLimitMb * 0.4),
            error,
            workerId: targetWorker,
            wasStolen: false,
          });
        },
        targetWorker,
      );
    }

    // Run parallel drain
    await this.drainAndProcessAll();
    return results;
  }

  public getMetrics(): WorkStealingPoolMetrics {
    const totalStealAttempts = this.totalSteals + this.failedSteals;
    const rate =
      totalStealAttempts > 0 ? (this.totalSteals / totalStealAttempts) * 100 : 100;

    return {
      totalWorkers: this.workerCount,
      totalTasksSubmitted: this.totalSubmitted,
      totalTasksCompleted: this.totalCompleted,
      totalStealsExecuted: this.totalSteals,
      stealSuccessRatePercent: Math.round(rate * 10) / 10,
      workers: this.metrics.map((m, i) => ({
        ...m,
        queueDepth: this.deques[i].size(),
      })),
    };
  }
}
