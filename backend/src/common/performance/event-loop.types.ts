/**
 * Event-Loop Lag Watchdog & Task Sharding Scheduler Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type TaskPriority = 'IMMEDIATE' | 'HIGH' | 'NORMAL' | 'BACKGROUND';

export interface EventLoopLagStatus {
  currentLagMs: number;
  p50LagMs: number;
  p95LagMs: number;
  p99LagMs: number;
  maxLagMs: number;
  isSheddingLoad: boolean;
  sampleCount: number;
  measuredAt: number;
}

export interface EventLoopWatchdogConfig {
  sampleIntervalMs?: number;
  warningThresholdMs?: number; // Target benchmark: 15ms
  criticalThresholdMs?: number; // Target: 30ms
  historyWindowSize?: number;
}

export interface ShardedTaskOptions {
  taskId?: string;
  chunkSize?: number;
  maxChunkDurationMs?: number; // Target budget: 4ms per setImmediate slice
  priority?: TaskPriority;
}

export interface ShardedTaskProgress {
  taskId: string;
  totalItems: number;
  processedItems: number;
  yieldCount: number;
  durationMs: number;
  completed: boolean;
}

export interface TaskSharderMetrics {
  totalTasksScheduled: number;
  totalItemsProcessed: number;
  totalYieldsExecuted: number;
  averageChunkDurationMs: number;
  tasksCompleted: number;
}
