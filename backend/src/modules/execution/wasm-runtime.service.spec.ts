import { Test, TestingModule } from '@nestjs/testing';
import { WasmRuntimeService } from './wasm-runtime.service';
import { ExecutionController } from './execution.controller';

describe('WasmRuntimeService & Execution Sandbox', () => {
  let service: WasmRuntimeService;
  let controller: ExecutionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [WasmRuntimeService],
    }).compile();

    service = module.get<WasmRuntimeService>(WasmRuntimeService);
    controller = module.get<ExecutionController>(ExecutionController);
  });

  describe('Sub-5ms Execution Startup Time', () => {
    it('executes a basic algorithm with startup latency under 5ms', async () => {
      const result = await service.execute({
        code: 'int main() { printf("Hello WebAssembly Sandbox"); return 0; }',
        language: 'c',
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello WebAssembly Sandbox');
      expect(result.startupTimeMs).toBeLessThan(5.0); // Sub-5ms cold-start requirement
      expect(result.killedByFuelLimit).toBe(false);
      expect(result.memoryTrapped).toBe(false);
    });

    it('benchmarks cold starts across multiple samples and satisfies sub-5ms criterion', async () => {
      const benchmark = await service.benchmarkColdStart(10);
      expect(benchmark.samples).toBe(10);
      expect(benchmark.sub5msMet).toBe(true);
      expect(benchmark.averageStartupTimeMs).toBeLessThan(5.0);
    });
  });

  describe('Fuel Consumption & Infinite Loop Prevention', () => {
    it('terminates infinite loops deterministically via fuel consumption without hanging threads', async () => {
      const loopCode = `
        void infinite_loop() {
          while(1) {
            // endless loop
          }
        }
      `;

      const result = await service.execute({
        code: loopCode,
        language: 'c',
        fuelLimit: 500_000, // Small fuel limit for quick exhaustion
      });

      expect(result.killedByFuelLimit).toBe(true);
      expect(result.exitCode).toBe(137); // SIGKILL equivalent
      expect(result.error).toContain('fuel limit');
      expect(result.stderr).toContain('Instruction fuel limit');
    });

    it('tracks fuel consumed accurately for terminating programs', async () => {
      const result = await service.execute({
        code: 'int add() { return 42; }',
        language: 'c',
        fuelLimit: 1_000_000,
      });

      expect(result.killedByFuelLimit).toBe(false);
      expect(result.fuelConsumed).toBeGreaterThan(0);
      expect(result.fuelConsumed).toBeLessThanOrEqual(result.fuelLimit);
    });
  });

  describe('Memory Isolation & Host Memory Protection', () => {
    it('traps out-of-bounds memory access without corrupting host memory', async () => {
      const segfaultCode = `
        void bad_memory_access() {
          int* ptr = (int*)0x7fffffff; // Out-of-bounds pointer
          *ptr = 1337;
        }
      `;

      const result = await service.execute({
        code: segfaultCode,
        language: 'c',
        memoryLimitPages: 1, // 64 KB memory limit
      });

      expect(result.memoryTrapped).toBe(true);
      expect(result.exitCode).toBe(139); // SIGSEGV equivalent
      expect(result.error).toContain('out of bounds');
    });

    it('enforces configured memory limit pages', async () => {
      const result = await service.execute({
        code: 'int main() { printf("Memory test"); return 0; }',
        language: 'c',
        memoryLimitPages: 2, // 128 KB
      });

      expect(result.memoryPages).toBe(1);
      expect(result.memoryPeakBytes).toBe(65536);
    });
  });

  describe('WASI Polyfills for Stdin, Stdout, and Stderr', () => {
    it('captures WASI stdout output accurately', async () => {
      const result = await service.execute({
        code: 'int main() { printf("TwoSum([2, 7, 11, 15], target=9) -> [0, 1]"); return 0; }',
        language: 'c',
      });

      expect(result.stdout).toContain('TwoSum([2, 7, 11, 15], target=9) -> [0, 1]');
      expect(result.stderr).toBe('');
    });

    it('handles input from stdin buffer cleanly', async () => {
      const result = await service.execute({
        code: 'int main() { read_stdin(); return 0; }',
        language: 'c',
        stdin: 'test-stdin-payload-123',
      });

      expect(result.stdout).toContain('Echo: test-stdin-payload-123');
    });
  });

  describe('ExecutionController Endpoints', () => {
    it('executes wasm via controller POST /api/execution/wasm/run', async () => {
      const response = await controller.executeWasm({
        code: 'int main() { printf("Controller test"); return 0; }',
        language: 'c',
      });

      expect(response.exitCode).toBe(0);
      expect(response.stdout).toContain('Controller test');
      expect(response.startupTimeMs).toBeLessThan(5.0);
    });

    it('returns benchmark stats via controller GET /api/execution/wasm/benchmark', async () => {
      const benchmark = await controller.benchmarkColdStart('5');
      expect(benchmark.samples).toBe(5);
      expect(benchmark.sub5msMet).toBe(true);
    });

    it('returns sandbox health via controller GET /api/execution/wasm/health', () => {
      const health = controller.getSandboxHealth();
      expect(health.status).toBe('ready');
      expect(health.wasiSupported).toBe(true);
    });
  });
});

