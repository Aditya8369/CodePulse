import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventLoopWatchdogService } from './event-loop-watchdog.service';
import {
  ShardedTaskOptions,
  ShardedTaskProgress,
  TaskPriority,
  TaskSharderMetrics,
} from './event-loop.types';

export interface AstProfilingNode {
  id: string;
  kind: string;
  tokens: string[];
  depth: number;
  children: AstProfilingNode[];
}

export interface AstProfilingReport {
  totalNodesAnalyzed: number;
  totalTokensParsed: number;
  maxTreeDepth: number;
  cyclomaticComplexityEstimate: number;
  yieldCount: number;
  durationMs: number;
}

@Injectable()
export class TaskSharderService implements OnModuleDestroy {
  private readonly logger = new Logger(TaskSharderService.name);

  private totalTasksScheduled = 0;
  private totalItemsProcessed = 0;
  private totalYieldsExecuted = 0;
  private tasksCompleted = 0;
  private totalChunkDurationMs = 0;
  private chunkCount = 0;

  // AIMD (Additive Increase, Multiplicative Decrease) dynamic chunk sizing
  private currentDynamicChunkSize = 100;
  private readonly minChunkSize = 10;
  private readonly maxChunkSize = 1000;

  constructor(private readonly watchdog?: EventLoopWatchdogService) {}

  public onModuleDestroy(): void {
    // cleanup
  }

  /**
   * Cooperatively yields control back to Node.js event loop using setImmediate.
   * Allows queued I/O, GC, and timer callbacks to execute without starvation.
   */
  public async yieldToEventLoop(): Promise<void> {
    this.totalYieldsExecuted++;
    return new Promise((resolve) => {
      setImmediate(resolve);
    });
  }

  /**
   * Adapts chunk size based on current event-loop lag:
   * - If lag > 15ms: Multiplicative decrease (halves chunk size) to relieve event-loop pressure
   * - If lag < 5ms: Additive increase (+10 items) to maximize throughput
   */
  public adaptChunkSize(): number {
    if (this.watchdog) {
      const lag = this.watchdog.getCurrentLagMs();
      if (lag >= 15) {
        this.currentDynamicChunkSize = Math.max(
          this.minChunkSize,
          Math.floor(this.currentDynamicChunkSize / 2),
        );
        this.logger.debug(
          `[TaskSharder AIMD] Lag ${lag}ms >= 15ms: halved chunk size to ${this.currentDynamicChunkSize}`,
        );
      } else if (lag < 5) {
        this.currentDynamicChunkSize = Math.min(
          this.maxChunkSize,
          this.currentDynamicChunkSize + 10,
        );
      }
    }
    return this.currentDynamicChunkSize;
  }

  /**
   * Executes a heavy batch task sharded across event-loop ticks.
   * Respects maximum execution budget (default 4ms) per chunk to keep lag < 15ms.
   */
  public async processSharded<T, R>(
    items: T[],
    processor: (item: T, index: number) => R | Promise<R>,
    options?: ShardedTaskOptions,
  ): Promise<R[]> {
    const taskId = options?.taskId ?? `task-${Math.random().toString(36).substring(2, 8)}`;
    const baseChunkSize = options?.chunkSize ?? this.adaptChunkSize();
    const maxChunkDurationMs = options?.maxChunkDurationMs ?? 4; // 4ms budget per tick

    this.totalTasksScheduled++;
    const results: R[] = new Array<R>(items.length);
    const total = items.length;

    let sliceStart = performance.now();
    let processedInSlice = 0;
    let effectiveChunkSize = baseChunkSize;

    for (let i = 0; i < total; i++) {
      results[i] = await processor(items[i], i);
      processedInSlice++;
      this.totalItemsProcessed++;

      const elapsed = performance.now() - sliceStart;

      // Yield when slice budget is exhausted or chunk limit reached
      if (processedInSlice >= effectiveChunkSize || elapsed >= maxChunkDurationMs) {
        this.totalChunkDurationMs += elapsed;
        this.chunkCount++;

        await this.yieldToEventLoop();

        // Re-evaluate dynamic AIMD chunk sizing for subsequent slice
        effectiveChunkSize = this.adaptChunkSize();
        sliceStart = performance.now();
        processedInSlice = 0;
      }
    }

    this.tasksCompleted++;
    return results;
  }

  /**
   * Cooperatively profiles large AST token trees without blocking the event loop.
   */
  public async profileAstTreeSharded(
    root: AstProfilingNode,
    maxBudgetPerTickMs = 4,
  ): Promise<AstProfilingReport> {
    const start = performance.now();
    let totalNodes = 0;
    let totalTokens = 0;
    let maxDepth = 0;
    let complexity = 1;
    let yields = 0;

    const stack: Array<{ node: AstProfilingNode; depth: number }> = [{ node: root, depth: 1 }];
    let sliceStart = performance.now();

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) break;

      totalNodes++;
      totalTokens += current.node.tokens.length;
      if (current.depth > maxDepth) {
        maxDepth = current.depth;
      }

      // Check cyclomatic branch constructs
      if (
        current.node.kind === 'IfStatement' ||
        current.node.kind === 'ForStatement' ||
        current.node.kind === 'WhileStatement' ||
        current.node.kind === 'CaseClause' ||
        current.node.kind === 'CatchClause'
      ) {
        complexity++;
      }

      for (const child of current.node.children) {
        stack.push({ node: child, depth: current.depth + 1 });
      }

      // Time-slicing check
      if (performance.now() - sliceStart >= maxBudgetPerTickMs) {
        await this.yieldToEventLoop();
        yields++;
        sliceStart = performance.now();
      }
    }

    const duration = Math.round((performance.now() - start) * 100) / 100;

    return {
      totalNodesAnalyzed: totalNodes,
      totalTokensParsed: totalTokens,
      maxTreeDepth: maxDepth,
      cyclomaticComplexityEstimate: complexity,
      yieldCount: yields,
      durationMs: duration,
    };
  }

  /**
   * Splits an array of items into distinct chunk arrays.
   */
  public partitionChunks<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  public getMetrics(): TaskSharderMetrics {
    const avgChunk = this.chunkCount > 0 ? this.totalChunkDurationMs / this.chunkCount : 0;
    return {
      totalTasksScheduled: this.totalTasksScheduled,
      totalItemsProcessed: this.totalItemsProcessed,
      totalYieldsExecuted: this.totalYieldsExecuted,
      averageChunkDurationMs: Math.round(avgChunk * 100) / 100,
      tasksCompleted: this.tasksCompleted,
    };
  }
}
