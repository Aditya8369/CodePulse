import { Injectable, Logger } from '@nestjs/common';
import * as vm from 'vm';

export type FuzzType = 'integer' | 'number' | 'string' | 'boolean' | 'array';

export interface FuzzParamConstraint {
  name: string;
  type: FuzzType;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  itemType?: FuzzType;
  itemMin?: number;
  itemMax?: number;
  allowNegative?: boolean;
}

export interface FuzzTestOptions {
  iterations?: number;
  timeoutMs?: number;
  seed?: number;
  shrinkMaxSteps?: number;
}

export interface MinimalCounterexample {
  input: any[];
  expectedOutput: any;
  actualOutput: any;
  error?: string;
  shrunkFrom: any[];
  shrinkSteps: number;
}

export interface FuzzEvaluationReport {
  passed: boolean;
  totalIterations: number;
  passedIterations: number;
  failedAtIteration?: number;
  failureType?: 'OUTPUT_MISMATCH' | 'RUNTIME_EXCEPTION' | 'TIMEOUT' | 'HARDCODED_LOOKUP_DETECTED';
  counterexample?: MinimalCounterexample;
  hardcodedLookupDetected: boolean;
  executionTimeMs: number;
  summary: string;
}

@Injectable()
export class FuzzingEvaluatorService {
  private readonly logger = new Logger(FuzzingEvaluatorService.name);

  // Default number of random adversarial test inputs per evaluation (1,000 as per specification)
  public static readonly DEFAULT_ITERATIONS = 1000;

  /**
   * Property-Based Fuzz Testing Pipeline:
   * Executes candidate solution against a trusted reference implementation
   * across up to 1,000 generated adversarial inputs.
   * On failure, shrinks counterexample to minimal reproducible case.
   */
  public async evaluateWithFuzzer(params: {
    referenceCode: string;
    candidateCode: string;
    entryFunctionName: string;
    constraints: FuzzParamConstraint[];
    options?: FuzzTestOptions;
  }): Promise<FuzzEvaluationReport> {
    const startTime = Date.now();
    const iterations = params.options?.iterations ?? FuzzingEvaluatorService.DEFAULT_ITERATIONS;
    const timeoutMs = params.options?.timeoutMs ?? 500;
    const maxShrinkSteps = params.options?.shrinkMaxSteps ?? 100;

    // 1. Prepare sandboxed execution runners for both solutions
    const refRunner = this.createFunctionRunner(params.referenceCode, params.entryFunctionName, timeoutMs);
    const candidateRunner = this.createFunctionRunner(params.candidateCode, params.entryFunctionName, timeoutMs);

    // 2. Generate adversarial test inputs (boundary values first, followed by pseudo-random samples)
    const inputs = this.generateAdversarialInputs(params.constraints, iterations, params.options?.seed);

    let passedIterations = 0;
    let failingInput: any[] | null = null;
    let failureType: FuzzEvaluationReport['failureType'];
    let failingError: string | undefined;
    let failingExpected: any;
    let failingActual: any;

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      let expected: any;
      try {
        expected = refRunner(input);
      } catch (err: any) {
        // Skip inputs that reference solution cannot evaluate or constraint violations
        continue;
      }

      let actual: any;
      try {
        actual = candidateRunner(input);
      } catch (err: any) {
        failingInput = input;
        failureType = 'RUNTIME_EXCEPTION';
        failingError = err.message || 'Execution error';
        failingExpected = expected;
        failingActual = null;
        break;
      }

      if (!this.deepEqual(expected, actual)) {
        failingInput = input;
        failureType = 'OUTPUT_MISMATCH';
        failingExpected = expected;
        failingActual = actual;
        break;
      }

      passedIterations++;
    }

    const executionTimeMs = Date.now() - startTime;

    if (!failingInput) {
      return {
        passed: true,
        totalIterations: inputs.length,
        passedIterations: inputs.length,
        hardcodedLookupDetected: false,
        executionTimeMs,
        summary: `All ${inputs.length} adversarial property-based test cases passed successfully.`,
      };
    }

    // 3. Test Failure: Shrink counterexample to minimal human-readable case
    const shrinkResult = this.shrinkCounterexample(
      failingInput,
      params.constraints,
      refRunner,
      candidateRunner,
      maxShrinkSteps,
    );

    // 4. Detect whether the candidate solution is hardcoding a lookup table
    const hardcodedLookupDetected = this.detectHardcodedLookup(
      params.candidateCode,
      passedIterations,
      inputs.length,
    );

    if (hardcodedLookupDetected) {
      failureType = 'HARDCODED_LOOKUP_DETECTED';
    }

    const counterexample: MinimalCounterexample = {
      input: shrinkResult.shrunkInput,
      expectedOutput: shrinkResult.expectedOutput,
      actualOutput: shrinkResult.actualOutput,
      error: failingError,
      shrunkFrom: failingInput,
      shrinkSteps: shrinkResult.steps,
    };

    const summary = hardcodedLookupDetected
      ? `Failed at iteration ${passedIterations + 1}: Solution appears to hardcode lookup tables or passed static cases but failed randomized inputs. Minimal counterexample: ${JSON.stringify(counterexample.input)}`
      : `Property test failed at iteration ${passedIterations + 1}. Minimal counterexample found in ${shrinkResult.steps} shrink steps: input=${JSON.stringify(counterexample.input)}, expected=${JSON.stringify(counterexample.expectedOutput)}, actual=${JSON.stringify(counterexample.actualOutput)}.`;

    return {
      passed: false,
      totalIterations: inputs.length,
      passedIterations,
      failedAtIteration: passedIterations + 1,
      failureType,
      counterexample,
      hardcodedLookupDetected,
      executionTimeMs,
      summary,
    };
  }

  /**
   * Generates up to `count` adversarial and edge-case inputs within specified parameter constraints.
   * Prioritizes extreme boundaries (0, -1, MIN_SAFE_INTEGER, empty strings, Unicode, sparse arrays).
   */
  public generateAdversarialInputs(
    constraints: FuzzParamConstraint[],
    count = FuzzingEvaluatorService.DEFAULT_ITERATIONS,
    seed = 12345,
  ): any[][] {
    const inputs: any[][] = [];
    let currentSeed = seed;

    const pseudoRandom = () => {
      currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0;
      return currentSeed / 4294967296;
    };

    // 1. Generate boundary and edge-case inputs first
    const boundaryInputs = this.generateBoundaryInputs(constraints);
    for (const b of boundaryInputs) {
      inputs.push(b);
      if (inputs.length >= count) return inputs;
    }

    // 2. Generate randomized property-based inputs up to `count`
    while (inputs.length < count) {
      const tuple: any[] = [];
      for (const c of constraints) {
        tuple.push(this.generateRandomParam(c, pseudoRandom));
      }
      inputs.push(tuple);
    }

    return inputs;
  }

  /**
   * Shrinks a failing input tuple down to its minimal reproducible counterexample
   * using binary search and delta-debugging reduction.
   */
  public shrinkCounterexample(
    failingInput: any[],
    constraints: FuzzParamConstraint[],
    refRunner: (args: any[]) => any,
    candidateRunner: (args: any[]) => any,
    maxSteps = 100,
  ): {
    shrunkInput: any[];
    expectedOutput: any;
    actualOutput: any;
    steps: number;
  } {
    let currentInput = JSON.parse(JSON.stringify(failingInput));
    let steps = 0;

    const testFailure = (inp: any[]): { isFailing: boolean; expected: any; actual: any } => {
      try {
        const expected = refRunner(inp);
        try {
          const actual = candidateRunner(inp);
          if (!this.deepEqual(expected, actual)) {
            return { isFailing: true, expected, actual };
          }
          return { isFailing: false, expected, actual };
        } catch (err: any) {
          return { isFailing: true, expected, actual: null };
        }
      } catch {
        return { isFailing: false, expected: null, actual: null };
      }
    };

    let lastResult = testFailure(currentInput);

    for (let i = 0; i < constraints.length && steps < maxSteps; i++) {
      const constraint = constraints[i];
      let val = currentInput[i];

      if (constraint.type === 'integer' || constraint.type === 'number') {
        // Try shrinking towards 0
        const candidates = [0, 1, -1];
        for (const cand of candidates) {
          if (cand !== val && steps < maxSteps) {
            steps++;
            const testTuple = [...currentInput];
            testTuple[i] = cand;
            const res = testFailure(testTuple);
            if (res.isFailing) {
              currentInput = testTuple;
              val = cand;
              lastResult = res;
              break;
            }
          }
        }

        // Binary search reduction towards 0
        let currentNum = val;
        while (Math.abs(currentNum) > 1 && steps < maxSteps) {
          steps++;
          const reduced = Math.trunc(currentNum / 2);
          if (reduced === currentNum) break;
          const testTuple = [...currentInput];
          testTuple[i] = reduced;
          const res = testFailure(testTuple);
          if (res.isFailing) {
            currentInput = testTuple;
            currentNum = reduced;
            lastResult = res;
          } else {
            break;
          }
        }
      } else if (constraint.type === 'string' && typeof val === 'string') {
        // Try empty string
        if (val.length > 0 && steps < maxSteps) {
          steps++;
          const testTuple = [...currentInput];
          testTuple[i] = '';
          const res = testFailure(testTuple);
          if (res.isFailing) {
            currentInput = testTuple;
            lastResult = res;
            val = '';
          }
        }

        // Halve string length
        while (val.length > 1 && steps < maxSteps) {
          steps++;
          const half = val.slice(0, Math.floor(val.length / 2));
          const testTuple = [...currentInput];
          testTuple[i] = half;
          const res = testFailure(testTuple);
          if (res.isFailing) {
            currentInput = testTuple;
            lastResult = res;
            val = half;
          } else {
            break;
          }
        }
      } else if (constraint.type === 'array' && Array.isArray(val)) {
        // Try empty array
        if (val.length > 0 && steps < maxSteps) {
          steps++;
          const testTuple = [...currentInput];
          testTuple[i] = [];
          const res = testFailure(testTuple);
          if (res.isFailing) {
            currentInput = testTuple;
            lastResult = res;
            val = [];
          }
        }

        // Remove elements one by one or in halves
        while (val.length > 1 && steps < maxSteps) {
          steps++;
          const half = val.slice(0, Math.floor(val.length / 2));
          const testTuple = [...currentInput];
          testTuple[i] = half;
          const res = testFailure(testTuple);
          if (res.isFailing) {
            currentInput = testTuple;
            lastResult = res;
            val = half;
          } else {
            // Try single element array with the first element
            const single = [val[0]];
            const singleTuple = [...currentInput];
            singleTuple[i] = single;
            const singleRes = testFailure(singleTuple);
            if (singleRes.isFailing) {
              currentInput = singleTuple;
              lastResult = singleRes;
              val = single;
            }
            break;
          }
        }
      }
    }

    return {
      shrunkInput: currentInput,
      expectedOutput: lastResult.expected,
      actualOutput: lastResult.actual,
      steps,
    };
  }

  /**
   * Deterministically generates known edge cases and boundary inputs.
   */
  private generateBoundaryInputs(constraints: FuzzParamConstraint[]): any[][] {
    const boundariesPerParam: any[][] = constraints.map((c) => {
      switch (c.type) {
        case 'integer':
        case 'number': {
          const list: number[] = [0, 1, -1];
          if (c.min !== undefined) list.push(c.min, c.min + 1);
          if (c.max !== undefined) list.push(c.max, c.max - 1);
          if (c.allowNegative !== false) {
            list.push(-99999, -100);
          }
          list.push(100, 99999);
          return Array.from(new Set(list));
        }
        case 'string':
          return ['', ' ', '\0', '\n\t', 'abc', '🔥🚀', '0', '-1', 'a'.repeat(50)];
        case 'boolean':
          return [true, false];
        case 'array': {
          const itemMin = c.itemMin ?? -10;
          const itemMax = c.itemMax ?? 10;
          return [
            [],
            [0],
            [-1],
            [1],
            [itemMin, 0, itemMax],
            [2, 2, 2, 2],
            [1, 2, 3, 4, 5],
            [5, 4, 3, 2, 1],
          ];
        }
        default:
          return [null];
      }
    });

    const maxVariants = Math.max(...boundariesPerParam.map((b) => b.length));
    const result: any[][] = [];

    for (let i = 0; i < maxVariants; i++) {
      const tuple: any[] = [];
      for (let p = 0; p < constraints.length; p++) {
        const variants = boundariesPerParam[p];
        tuple.push(variants[i % variants.length]);
      }
      result.push(tuple);
    }

    return result;
  }

  /**
   * Generates a pseudo-random value adhering to constraint parameters.
   */
  private generateRandomParam(constraint: FuzzParamConstraint, rand: () => number): any {
    switch (constraint.type) {
      case 'integer': {
        const min = constraint.min ?? (constraint.allowNegative !== false ? -1000 : 0);
        const max = constraint.max ?? 1000;
        return Math.floor(rand() * (max - min + 1)) + min;
      }
      case 'number': {
        const min = constraint.min ?? (constraint.allowNegative !== false ? -1000 : 0);
        const max = constraint.max ?? 1000;
        return Number((rand() * (max - min) + min).toFixed(4));
      }
      case 'string': {
        const minLen = constraint.minLength ?? 0;
        const maxLen = constraint.maxLength ?? 20;
        const len = Math.floor(rand() * (maxLen - minLen + 1)) + minLen;
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-';
        let str = '';
        for (let i = 0; i < len; i++) {
          str += chars.charAt(Math.floor(rand() * chars.length));
        }
        return str;
      }
      case 'boolean':
        return rand() > 0.5;
      case 'array': {
        const minLen = constraint.minLength ?? 0;
        const maxLen = constraint.maxLength ?? 10;
        const len = Math.floor(rand() * (maxLen - minLen + 1)) + minLen;
        const arr: any[] = [];
        const itemConstraint: FuzzParamConstraint = {
          name: 'item',
          type: constraint.itemType || 'integer',
          min: constraint.itemMin ?? -100,
          max: constraint.itemMax ?? 100,
        };
        for (let i = 0; i < len; i++) {
          arr.push(this.generateRandomParam(itemConstraint, rand));
        }
        return arr;
      }
      default:
        return null;
    }
  }

  /**
   * Creates an isolated, sandboxed execution wrapper around an entry function.
   */
  private createFunctionRunner(
    sourceCode: string,
    funcName: string,
    timeoutMs = 500,
  ): (args: any[]) => any {
    const sandbox: Record<string, any> = {
      console: { log: () => {}, warn: () => {}, error: () => {} },
      Math,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
    };

    const context = vm.createContext(sandbox);

    // Run the solution source code in context
    const script = new vm.Script(sourceCode);
    script.runInContext(context, { timeout: timeoutMs });

    return (args: any[]) => {
      const callScript = new vm.Script(`${funcName}(...args)`);
      context.args = args;
      return callScript.runInContext(context, { timeout: timeoutMs });
    };
  }

  /**
   * Identifies candidate solutions that hardcode lookup tables (e.g. static switch/case
   * or mapping designed only to pass sample static test inputs).
   */
  private detectHardcodedLookup(
    code: string,
    passedCount: number,
    totalCount: number,
  ): boolean {
    // If solution passed very few tests and failed the rest
    const passRatio = totalCount > 0 ? passedCount / totalCount : 0;

    // Detect static lookup indicators in AST / code
    const hasSwitchHardcoding = (code.match(/case\s+[^:]+:/g) || []).length > 2;
    const hasMultipleExactIfs = (code.match(/if\s*\([^)]*===/g) || []).length > 3;
    const hasStaticMapTable = /{\s*(?:\d+|["'][^"']+["'])\s*:\s*(?:\d+|["'][^"']+["'])/.test(code);

    if (passRatio < 0.05 && (hasSwitchHardcoding || hasMultipleExactIfs || hasStaticMapTable)) {
      return true;
    }

    return false;
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  }
}
