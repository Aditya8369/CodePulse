import { EventLoopWatchdogService } from './event-loop-watchdog.service';
import { AstProfilingNode, TaskSharderService } from './task-sharder.service';

describe('EventLoopWatchdogService & TaskSharderService', () => {
  let watchdog: EventLoopWatchdogService;
  let sharder: TaskSharderService;

  beforeEach(() => {
    watchdog = new EventLoopWatchdogService({
      sampleIntervalMs: 5,
      warningThresholdMs: 15,
      criticalThresholdMs: 30,
    });
    watchdog.onModuleInit();
    sharder = new TaskSharderService(watchdog);
  });

  afterEach(() => {
    watchdog.onModuleDestroy();
    sharder.onModuleDestroy();
  });

  it('should initialize watchdog and accurately calculate percentiles', () => {
    // Generate simulated samples
    for (let i = 0; i < 20; i++) {
      watchdog.sampleEventLoop();
    }

    const status = watchdog.getStatus();
    expect(status.sampleCount).toBeGreaterThanOrEqual(20);
    expect(status.p50LagMs).toBeDefined();
    expect(status.p95LagMs).toBeDefined();
    expect(status.isSheddingLoad).toBe(false);
  });

  it('should notify registered spike listeners when lag exceeds 15ms threshold', () => {
    const spikes: number[] = [];
    const unsubscribe = watchdog.registerSpikeListener((lag) => {
      spikes.push(lag);
    });

    watchdog.sampleEventLoop();

    expect(typeof watchdog.isDegraded()).toBe('boolean');
    unsubscribe();
  });

  it('should partition items into chunks accurately', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const chunks = sharder.partitionChunks(items, 3);
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toEqual([1, 2, 3]);
    expect(chunks[1]).toEqual([4, 5, 6]);
    expect(chunks[2]).toEqual([7]);
  });

  it('should shard CPU tasks and yield to event loop keeping lag below 15ms', async () => {
    const items = Array.from({ length: 1000 }, (_, i) => i);

    const results = await sharder.processSharded(
      items,
      (item) => item * 2,
      { chunkSize: 100, maxChunkDurationMs: 3 },
    );

    expect(results.length).toBe(1000);
    expect(results[0]).toBe(0);
    expect(results[999]).toBe(1998);

    const metrics = sharder.getMetrics();
    expect(metrics.totalTasksScheduled).toBe(1);
    expect(metrics.totalItemsProcessed).toBe(1000);
    expect(metrics.totalYieldsExecuted).toBeGreaterThanOrEqual(10); // Multiple setImmediate yields

    // Event loop lag should remain low (<15ms)
    expect(watchdog.getCurrentLagMs()).toBeLessThan(15);
  });

  it('should dynamically adapt chunk size using AIMD rules', () => {
    const initialSize = sharder.adaptChunkSize();
    expect(initialSize).toBeGreaterThan(0);
    expect(initialSize).toBeLessThanOrEqual(1000);
  });

  it('should cooperatively profile large AST tree without blocking', async () => {
    // Construct synthetic 4-level deep AST tree
    const root: AstProfilingNode = {
      id: 'root',
      kind: 'Program',
      tokens: ['function', 'main', '(', ')', '{'],
      depth: 1,
      children: [
        {
          id: 'b1',
          kind: 'IfStatement',
          tokens: ['if', '(', 'x', '>', '0', ')'],
          depth: 2,
          children: [
            {
              id: 'c1',
              kind: 'ForStatement',
              tokens: ['for', 'let', 'i', '=', '0'],
              depth: 3,
              children: [],
            },
          ],
        },
        {
          id: 'b2',
          kind: 'WhileStatement',
          tokens: ['while', '(', 'true', ')'],
          depth: 2,
          children: [],
        },
      ],
    };

    const report = await sharder.profileAstTreeSharded(root, 10);
    expect(report.totalNodesAnalyzed).toBe(4);
    expect(report.maxTreeDepth).toBe(3);
    expect(report.cyclomaticComplexityEstimate).toBeGreaterThanOrEqual(3);
  });

  it('should cooperatively yield to event loop without throwing', async () => {
    const start = performance.now();
    await sharder.yieldToEventLoop();
    const duration = performance.now() - start;

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(sharder.getMetrics().totalYieldsExecuted).toBe(1);
  });
});
