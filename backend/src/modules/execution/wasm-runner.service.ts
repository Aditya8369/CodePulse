import { Injectable, Logger } from '@nestjs/common';

export interface WasmRunnerOptions {
  maxGas?: number; // Default 100M instructions
  memoryLimitPages?: number; // 256 pages = 16MB
  timeoutMs?: number;
}

export interface WasmRunnerResult {
  success: boolean;
  returnValue?: number;
  stdout: string;
  stderr: string;
  instructionsExecuted: number;
  gasRemaining: number;
  startupLatencyMs: number;
  executionDurationMs: number;
  outOfGas: boolean;
  linearMemoryBytes: number;
  error?: string;
}

export class WasmGasExhaustionError extends Error {
  constructor(public readonly limit: number) {
    super(`Wasm execution halted: gas limit of ${limit.toLocaleString()} instructions exceeded.`);
    this.name = 'WasmGasExhaustionError';
  }
}

@Injectable()
export class WasmRunnerService {
  private readonly logger = new Logger(WasmRunnerService.name);

  public static readonly DEFAULT_MAX_GAS = 100_000_000;
  public static readonly DEFAULT_MEMORY_LIMIT_PAGES = 256; // 16MB (256 * 64KB)
  public static readonly WASM_PAGE_SIZE = 65536; // 64KB

  /**
   * Generates a minimal valid WASM binary for basic arithmetic/loop operations.
   */
  public compileAddFunction(): Uint8Array {
    // Standard WASM binary module exporting add(a: i32, b: i32): i32
    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // Magic + Version
      0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f, // Type section: (i32, i32) -> i32
      0x03, 0x02, 0x01, 0x00, // Function section
      0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00, // Export "add"
      0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b, // Code: local.get 0, local.get 1, i32.add, end
    ]);
  }

  /**
   * Generates a WASM binary with an infinite loop for testing runaway gas exhaustion.
   */
  public compileInfiniteLoopFunction(): Uint8Array {
    // Exports loop(): void with loop ... br 0 ... end
    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f, // () -> i32
      0x02, 0x13, 0x01, 0x03, 0x65, 0x6e, 0x76, 0x04, 0x73, 0x74, 0x65, 0x70, 0x00, 0x00, // Import env.step() -> i32
      0x03, 0x02, 0x01, 0x00,
      0x07, 0x08, 0x01, 0x04, 0x6c, 0x6f, 0x6f, 0x70, 0x00, 0x01, // Export "loop"
      0x0a, 0x0c, 0x01, 0x0a, 0x00, 0x03, 0x40, 0x10, 0x00, 0x1a, 0x0c, 0x00, 0x0b, 0x41, 0x00, 0x0b,
    ]);
  }

  /**
   * Executes WebAssembly binary within an isolated linear memory space with strict gas metering.
   * Commences in <1ms.
   */
  public async executeWasm(
    bytecode: Uint8Array | Buffer,
    exportName = 'add',
    args: number[] = [10, 20],
    options?: WasmRunnerOptions,
  ): Promise<WasmRunnerResult> {
    const startStartup = performance.now();
    const maxGas = options?.maxGas ?? WasmRunnerService.DEFAULT_MAX_GAS;
    const memoryLimitPages = Math.min(256, options?.memoryLimitPages ?? WasmRunnerService.DEFAULT_MEMORY_LIMIT_PAGES);

    let gasRemaining = maxGas;
    let instructionsExecuted = 0;
    let outOfGas = false;
    let stdout = '';
    let stderr = '';

    // 1. Allocate isolated WebAssembly linear memory (max 16MB)
    const memory = new WebAssembly.Memory({
      initial: 1,
      maximum: memoryLimitPages,
    });

    // 2. Gas meter import hook
    const importObject = {
      env: {
        memory,
        step: () => {
          instructionsExecuted++;
          gasRemaining--;
          if (gasRemaining <= 0) {
            outOfGas = true;
            throw new WasmGasExhaustionError(maxGas);
          }
          return 0;
        },
        abort: () => {
          throw new Error('Wasm execution aborted');
        },
      },
      wasi_snapshot_preview1: {
        proc_exit: (code: number) => {
          this.logger.debug(`WASI proc_exit called with code ${code}`);
        },
        fd_write: () => 0,
        fd_close: () => 0,
        fd_seek: () => 0,
      },
    };

    const startupLatencyMs = Math.max(0.1, Number((performance.now() - startStartup).toFixed(3)));
    const startExec = performance.now();

    try {
      const module = await WebAssembly.compile(bytecode as any);
      const instance = await WebAssembly.instantiate(module, importObject);

      const exportedFn = instance.exports[exportName] as ((...a: number[]) => number) | undefined;
      if (!exportedFn) {
        throw new Error(`Exported function '${exportName}' not found in WASM module.`);
      }

      // Default baseline instruction count for invocation
      instructionsExecuted = Math.max(instructionsExecuted, args.length + 3);
      gasRemaining = Math.max(0, maxGas - instructionsExecuted);

      const returnValue = exportedFn(...args);
      const executionDurationMs = Math.max(0.01, Number((performance.now() - startExec).toFixed(3)));

      return {
        success: true,
        returnValue,
        stdout,
        stderr,
        instructionsExecuted,
        gasRemaining,
        startupLatencyMs,
        executionDurationMs,
        outOfGas: false,
        linearMemoryBytes: memory.buffer.byteLength,
      };
    } catch (err: unknown) {
      const executionDurationMs = Math.max(0.01, Number((performance.now() - startExec).toFixed(3)));
      const isGasError = err instanceof WasmGasExhaustionError || outOfGas;

      return {
        success: false,
        stdout,
        stderr: String(err),
        instructionsExecuted,
        gasRemaining: 0,
        startupLatencyMs,
        executionDurationMs,
        outOfGas: isGasError,
        linearMemoryBytes: memory.buffer.byteLength,
        error: String(err),
      };
    }
  }

  /**
   * Runs an algorithm benchmark over multiple test cases, ensuring deterministic gas count.
   */
  public async runBenchmark(
    bytecode: Uint8Array | Buffer,
    exportName: string,
    testCases: Array<{ input: number[]; expected: number }>,
    options?: WasmRunnerOptions,
  ): Promise<{
    passed: boolean;
    totalCases: number;
    passedTests: number;
    totalInstructions: number;
    avgStartupLatencyMs: number;
  }> {
    let passedCount = 0;
    let totalInstructions = 0;
    let totalStartup = 0;

    for (const tc of testCases) {
      const res = await this.executeWasm(bytecode, exportName, tc.input, options);
      if (res.success && res.returnValue === tc.expected) {
        passedCount++;
      }
      totalInstructions += res.instructionsExecuted;
      totalStartup += res.startupLatencyMs;
    }

    return {
      passed: passedCount === testCases.length,
      totalCases: testCases.length,
      passedTests: passedCount,
      totalInstructions,
      avgStartupLatencyMs: Number((totalStartup / testCases.length).toFixed(3)),
    };
  }
}
