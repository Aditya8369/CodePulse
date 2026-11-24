import { CpuTaskWorkerPoolService } from './cpu-task-worker-pool.service';

describe('CpuTaskWorkerPoolService', () => {
  let pool: CpuTaskWorkerPoolService;

  beforeEach(() => {
    pool = new CpuTaskWorkerPoolService(4); // 4 threads for tests
  });

  afterEach(() => {
    pool.onModuleDestroy();
  });

  it('should initialize with correct thread count', () => {
    const stats = pool.getStats();
    expect(stats.threadCount).toBe(4);
    expect(stats.activeTasks).toBe(0);
    expect(stats.queueDepth).toBe(0);
  });

  it('should execute Monte Carlo simulation task concurrently', async () => {
    const result = await pool.executeTask<{ iterations: number }, { iterations: number; successRate: number }>(
      'MONTE_CARLO_SIMULATION',
      { iterations: 5000 },
    );

    expect(result.iterations).toBe(5000);
    expect(result.successRate).toBeGreaterThan(0.5);
    expect(pool.getStats().totalCompleted).toBe(1);
  });

  it('should detect cycles in graph structures', async () => {
    const result = await pool.executeTask<any, { totalCycles: number; cycles: string[][] }>(
      'JOHNSON_CYCLE_DETECTION',
      {
        nodes: ['A', 'B', 'C'],
        edges: [
          ['A', 'B'],
          ['B', 'A'],
          ['B', 'C'],
        ],
      },
    );

    expect(result.totalCycles).toBeGreaterThan(0);
  });

  it('should reject when task execution exceeds timeout deadline', async () => {
    // Custom task that sleeps longer than timeout
    const slowTaskPromise = pool.executeTask(
      'CUSTOM',
      () => new Promise((resolve) => setTimeout(resolve, 500)),
      100, // 100ms timeout
    );

    await expect(slowTaskPromise).rejects.toThrow('timed out after 100ms deadline');
    expect(pool.getStats().totalFailed).toBe(1);
  });
});
