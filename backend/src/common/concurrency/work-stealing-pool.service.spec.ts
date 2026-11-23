import { ABORT, ChaseLevDeque, EMPTY } from './chase-lev-deque';
import { WorkStealingPoolService } from './work-stealing-pool.service';
import { TestCasePayload } from './work-stealing.types';

describe('ChaseLevDeque & WorkStealingPoolService', () => {
  describe('ChaseLevDeque (Lock-Free Work Stealing)', () => {
    let deque: ChaseLevDeque<string>;

    beforeEach(() => {
      deque = new ChaseLevDeque<string>(4);
    });

    it('should push to bottom and pop from bottom in LIFO order (owner)', () => {
      deque.pushBottom('task-1');
      deque.pushBottom('task-2');
      deque.pushBottom('task-3');

      expect(deque.size()).toBe(3);
      expect(deque.popBottom()).toBe('task-3'); // LIFO
      expect(deque.popBottom()).toBe('task-2');
      expect(deque.popBottom()).toBe('task-1');
      expect(deque.popBottom()).toBe(EMPTY);
      expect(deque.isEmpty()).toBe(true);
    });

    it('should allow thieves to steal from top in FIFO order', () => {
      deque.pushBottom('task-A');
      deque.pushBottom('task-B');
      deque.pushBottom('task-C');

      expect(deque.stealTop()).toBe('task-A'); // FIFO steal
      expect(deque.stealTop()).toBe('task-B');

      // Owner pops the remaining element from bottom
      expect(deque.popBottom()).toBe('task-C');
      expect(deque.popBottom()).toBe(EMPTY);
    });

    it('should automatically resize circular buffer when capacity is exceeded', () => {
      // Initial capacity is 4
      for (let i = 0; i < 20; i++) {
        deque.pushBottom(`item-${i}`);
      }

      expect(deque.size()).toBe(20);
      for (let i = 19; i >= 0; i--) {
        expect(deque.popBottom()).toBe(`item-${i}`);
      }
      expect(deque.popBottom()).toBe(EMPTY);
    });

    it('should return EMPTY when stealing from an empty deque', () => {
      expect(deque.stealTop()).toBe(EMPTY);
    });
  });

  describe('WorkStealingPoolService (Parallel Test Evaluation)', () => {
    let pool: WorkStealingPoolService;

    beforeEach(() => {
      pool = new WorkStealingPoolService({ workerCount: 4, initialDequeCapacity: 128 });
    });

    afterEach(() => {
      pool.onModuleDestroy();
    });

    it('should initialize pool with specified worker count and zero metrics', () => {
      expect(pool.workerCount).toBe(4);
      const metrics = pool.getMetrics();
      expect(metrics.totalWorkers).toBe(4);
      expect(metrics.totalTasksSubmitted).toBe(0);
      expect(metrics.totalTasksCompleted).toBe(0);
    });

    it('should steal tasks across idle workers when load is heavily skewed onto one worker', async () => {
      // Skew all 40 tasks onto Worker 0
      for (let i = 0; i < 40; i++) {
        pool.submitTask(`heavy-task-${i}`, i, () => i * 2, 0);
      }

      const processed = await pool.drainAndProcessAll();
      expect(processed).toBe(40);

      const metrics = pool.getMetrics();
      expect(metrics.totalTasksCompleted).toBe(40);
      expect(metrics.totalStealsExecuted).toBeGreaterThan(0); // Other workers stole tasks!

      // Verify other workers (1, 2, 3) participated via work-stealing
      const thiefWorkers = metrics.workers.filter(
        (w) => w.workerId !== 0 && w.tasksStolenFromOthers > 0,
      );
      expect(thiefWorkers.length).toBeGreaterThanOrEqual(1);
    });

    it('should evaluate batch algorithmic test cases cleanly', async () => {
      const testCases: TestCasePayload[] = [
        {
          testId: 'tc-1',
          submissionId: 'sub-99',
          input: '5\n1 2 3 4 5',
          expectedOutput: '15',
          timeLimitMs: 1000,
          memoryLimitMb: 256,
        },
        {
          testId: 'tc-2',
          submissionId: 'sub-99',
          input: '3\n10 20 30',
          expectedOutput: '60',
          timeLimitMs: 1000,
          memoryLimitMb: 256,
        },
      ];

      const results = await pool.evaluateBatchTestCases(testCases, async (tc) => {
        return tc.input.includes('\n');
      });

      expect(results.length).toBe(2);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(true);
      expect(results[0].executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
