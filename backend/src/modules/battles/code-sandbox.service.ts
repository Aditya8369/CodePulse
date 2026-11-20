import { Injectable, Logger } from '@nestjs/common';
import * as vm from 'vm';

export interface TestCase {
  input: any[];
  expected: any;
}

export interface BenchmarkResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  executionTimeMs: number;
  memoryKb: number;
  error?: string;
  testDetails: Array<{
    caseIndex: number;
    passed: boolean;
    expected: any;
    actual: any;
    durationMs: number;
  }>;
}

@Injectable()
export class CodeSandboxService {
  private readonly logger = new Logger(CodeSandboxService.name);

  /**
   * Executes user code in an isolated Node.js VM context with strict timeout (2000ms)
   */
  async runBenchmark(
    entryFunctionName: string,
    userCode: string,
    testCases: TestCase[]
  ): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const testDetails: BenchmarkResult['testDetails'] = [];

    try {
      // 1. Prepare sandbox context with stripped standard libraries for safety
      const sandboxContext = vm.createContext({
        console: {
          log: () => {},
          warn: () => {},
          error: () => {},
        },
        Math,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Date,
        Map,
        Set,
        performance,
      });

      // 2. Evaluate script
      const script = new vm.Script(`
        ${userCode}
        if (typeof ${entryFunctionName} !== 'function') {
          throw new Error('Function ${entryFunctionName} is not defined.');
        }
      `);

      script.runInContext(sandboxContext, { timeout: 2000 });

      let passedCount = 0;

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const caseStart = performance.now();

        const runnerScript = new vm.Script(`
          ${entryFunctionName}(...${JSON.stringify(tc.input)})
        `);

        const actual = runnerScript.runInContext(sandboxContext, { timeout: 1500 });
        const caseDuration = Number((performance.now() - caseStart).toFixed(2));
        const passed = JSON.stringify(actual) === JSON.stringify(tc.expected);

        if (passed) passedCount++;

        testDetails.push({
          caseIndex: i + 1,
          passed,
          expected: tc.expected,
          actual,
          durationMs: caseDuration,
        });
      }

      const totalTime = Number((performance.now() - startTime).toFixed(2));

      return {
        passed: passedCount === testCases.length,
        totalTests: testCases.length,
        passedTests: passedCount,
        executionTimeMs: totalTime,
        memoryKb: Math.round(process.memoryUsage().heapUsed / 1024),
        testDetails,
      };
    } catch (err: any) {
      this.logger.error(`Sandbox execution failed: ${err.message}`);
      return {
        passed: false,
        totalTests: testCases.length,
        passedTests: 0,
        executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
        memoryKb: 0,
        error: err.message,
        testDetails,
      };
    }
  }
}
