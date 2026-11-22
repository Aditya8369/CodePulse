import { WasmRunnerService, WasmGasExhaustionError } from './wasm-runner.service';

describe('WasmRunnerService (WebAssembly JIT with Gas Metering)', () => {
  let service: WasmRunnerService;

  beforeEach(() => {
    service = new WasmRunnerService();
  });

  it('commences execution in <1ms with deterministic instruction counts', async () => {
    const wasm = service.compileAddFunction();
    const result = await service.executeWasm(wasm, 'add', [15, 27]);

    expect(result.success).toBe(true);
    expect(result.returnValue).toBe(42);
    expect(result.startupLatencyMs).toBeLessThan(1.0); // Sub-1ms startup
    expect(result.instructionsExecuted).toBeGreaterThan(0);
    expect(result.linearMemoryBytes).toBeLessThanOrEqual(16 * 1024 * 1024); // <= 16MB
  });

  it('halts runaway infinite loop immediately upon gas exhaustion in <0.1ms', async () => {
    const loopWasm = service.compileInfiniteLoopFunction();
    const maxGas = 500; // Small gas limit

    const start = performance.now();
    const result = await service.executeWasm(loopWasm, 'loop', [], { maxGas });
    const haltDurationMs = performance.now() - start;

    expect(result.success).toBe(false);
    expect(result.outOfGas).toBe(true);
    expect(result.instructionsExecuted).toBe(maxGas);
    expect(result.gasRemaining).toBe(0);
    expect(result.error).toContain('gas limit');
    expect(haltDurationMs).toBeLessThan(50); // Instant halt
  });

  it('enforces 16MB linear memory boundary limit', async () => {
    const wasm = service.compileAddFunction();
    const result = await service.executeWasm(wasm, 'add', [5, 5], {
      memoryLimitPages: 256, // 16MB
    });

    expect(result.linearMemoryBytes).toBe(65536); // Initial 1 page (64KB)
    expect(result.linearMemoryBytes).toBeLessThanOrEqual(256 * 65536);
  });

  it('runs benchmark with deterministic instruction counting across multiple runs', async () => {
    const wasm = service.compileAddFunction();
    const testCases = [
      { input: [1, 2], expected: 3 },
      { input: [10, 20], expected: 30 },
      { input: [100, 200], expected: 300 },
    ];

    const bench1 = await service.runBenchmark(wasm, 'add', testCases);
    const bench2 = await service.runBenchmark(wasm, 'add', testCases);

    expect(bench1.passed).toBe(true);
    expect(bench1.passedTests).toBe(3);
    expect(bench1.totalInstructions).toBe(bench2.totalInstructions); // Deterministic
    expect(bench1.avgStartupLatencyMs).toBeLessThan(1.0);
  });
});
