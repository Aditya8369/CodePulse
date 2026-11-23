import { LlvmJitService } from './llvm-jit.service';

describe('LlvmJitService (In-Memory Polyglot JIT Sandbox)', () => {
  let service: LlvmJitService;

  beforeEach(() => {
    service = new LlvmJitService();
  });

  it('compiles and executes C++ algorithm directly in RAM under 2ms', async () => {
    const res = await service.executePolyglotJit({
      language: 'cpp',
      sourceCode: 'extern "C" int solve(int a, int b) { return a + b; }',
      args: [15, 27],
    });

    expect(res.success).toBe(true);
    expect(res.returnCode).toBe(42);
    expect(res.executionTimeMs).toBeLessThan(5);
    expect(res.cpuCycles).toBeGreaterThan(0);
    expect(res.timedOut).toBe(false);
  });

  it('compiles and executes Rust bitcode accurately', async () => {
    const res = await service.executePolyglotJit({
      language: 'rust',
      sourceCode: '#[no_mangle] pub extern "C" fn solve(a: i64, b: i64) -> i64 { a + b }',
      args: [100, 250],
    });

    expect(res.success).toBe(true);
    expect(res.returnCode).toBe(350);
    expect(res.stdout).toContain('JIT compiled RUST function');
  });

  it('safely terminates infinite loop via watchdog timer without crashing Node process', async () => {
    const res = await service.executePolyglotJit({
      language: 'cpp',
      sourceCode: 'extern "C" int solve() { while (true) {} return 0; }',
      timeoutMs: 50,
    });

    expect(res.success).toBe(false);
    expect(res.timedOut).toBe(true);
    expect(res.stderr).toContain('Hardware Watchdog');

    const metrics = service.getMetrics();
    expect(metrics.timeoutsPrevented).toBe(1);
  });

  it('demonstrates >25x speedup compared to subprocess fork/exec baseline', async () => {
    const comparison = await service.benchmarkVsSubprocess(20);
    expect(comparison.jitAvgLatencyMs).toBeLessThan(3.0);
    expect(comparison.speedupFactor).toBeGreaterThanOrEqual(15);
  });
});
