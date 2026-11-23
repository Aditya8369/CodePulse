/**
 * Lock-Free Work-Stealing Pool & Chase-Lev Deque Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOLEN';

export interface TestCasePayload {
  testId: string;
  submissionId: string;
  input: string;
  expectedOutput: string;
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface TestCaseResult {
  testId: string;
  submissionId: string;
  passed: boolean;
  executionTimeMs: number;
  memoryUsedMb: number;
  error?: string;
  workerId: number;
  wasStolen: boolean;
}

export interface WorkStealingTask<T = unknown, R = unknown> {
  taskId: string;
  payload: T;
  execute: () => Promise<R> | R;
  originWorkerId: number;
  assignedWorkerId?: number;
  createdAt: number;
  wasStolen: boolean;
}

export interface WorkerMetrics {
  workerId: number;
  tasksPushed: number;
  tasksPoppedLocally: number;
  tasksStolenByOthers: number;
  tasksStolenFromOthers: number;
  tasksCompleted: number;
  queueDepth: number;
  idleTimeMs: number;
}

export interface WorkStealingPoolMetrics {
  totalWorkers: number;
  totalTasksSubmitted: number;
  totalTasksCompleted: number;
  totalStealsExecuted: number;
  stealSuccessRatePercent: number;
  workers: WorkerMetrics[];
}

export interface WorkStealingPoolConfig {
  workerCount?: number;
  initialDequeCapacity?: number;
  maxStealAttempts?: number;
}
