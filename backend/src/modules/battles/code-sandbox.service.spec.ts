import { CodeSandboxService } from './code-sandbox.service';
import { BattlesFirecrackerPoolService } from './firecracker-pool.service';

describe('CodeSandboxService with Firecracker MicroVM Isolation', () => {
  let pool: BattlesFirecrackerPoolService;
  let sandbox: CodeSandboxService;

  beforeEach(() => {
    pool = new BattlesFirecrackerPoolService();
    pool.onModuleInit();
    sandbox = new CodeSandboxService(pool);
  });

  afterEach(() => {
    pool.onModuleDestroy();
  });

  it('runs valid algorithm solution inside microVM sandbox and passes test cases', async () => {
    const code = `
      function twoSum(nums, target) {
        const map = new Map();
        for (let i = 0; i < nums.length; i++) {
          const comp = target - nums[i];
          if (map.has(comp)) return [map.get(comp), i];
          map.set(nums[i], i);
        }
        return [];
      }
    `;

    const result = await sandbox.runBenchmark(
      'twoSum',
      code,
      [
        { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
        { input: [[3, 2, 4], 6], expected: [1, 2] },
      ],
      'javascript',
    );

    expect(result.passed).toBe(true);
    expect(result.passedTests).toBe(2);
    expect(result.memoryKb).toBeGreaterThan(0);
    expect(result.userCpuTimeMs).toBeGreaterThan(0);
  });

  it('catches and neutralizes Seccomp-BPF exploit attempts gracefully without host disruption', async () => {
    const exploitCode = `
      function exploit() {
        const net = require("net");
        const client = net.connect({ port: 80 });
      }
    `;

    const result = await sandbox.runBenchmark('exploit', exploitCode, [], 'javascript');
    expect(result.passed).toBe(false);
    expect(result.seccompViolation).toBe(true);
    expect(result.error).toContain('Seccomp-BPF Guard');
  });

  it('maintains warm pool of microVM memory snapshots with rapid resume latency', async () => {
    expect(pool.getWarmPoolSize('javascript')).toBe(BattlesFirecrackerPoolService.POOL_TARGET_SIZE);
    const { vm, resumeTimeMs } = await pool.acquireVm('javascript');
    expect(vm).toBeDefined();
    expect(resumeTimeMs).toBeLessThanOrEqual(BattlesFirecrackerPoolService.RESUME_LATENCY_MAX_MS);
  });
});
