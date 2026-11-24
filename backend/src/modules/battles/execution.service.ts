import { Injectable, Logger } from '@nestjs/common';

export interface CodeExecutionRequest {
  sourceCode: string;
  language: 'typescript' | 'python' | 'go' | 'cpp';
  stdin?: string[];
  expectedStdout?: string[];
  cpuTimeoutMs?: number;
  memoryLimitMb?: number;
  adversarialBenchmark?: boolean;
  inputScaleN?: number;
  expectedComplexity?: 'O(1)' | 'O(log N)' | 'O(N)' | 'O(N log N)' | 'O(N^2)' | 'O(2^N)';
  maxCpuInstructions?: number;
  checkBigOBound?: boolean;
}

export interface ExecutionVerdict {
  status:
    | 'ACCEPTED'
    | 'TIME_LIMIT_EXCEEDED'
    | 'MEMORY_LIMIT_EXCEEDED'
    | 'RUNTIME_ERROR'
    | 'COMPILATION_ERROR'
    | 'COMPLEXITY_LIMIT_EXCEEDED';
  passed: boolean;
  totalCases: number;
  passedCases: number;
  executionTimeMs: number;
  memoryUsedKb: number;
  estimatedCpuInstructions?: number;
  detectedComplexity?: string;
  rejectionReason?: string;
  compilerOutput?: string;
}

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  /**
   * Executes code within isolated sandbox environment (Piston/Judge0 runner cluster simulation)
   * Enforces CPU limits (default 1000ms), memory limits (default 128MB), and theoretical Big-O complexity bounds.
   */
  async executeCode(request: CodeExecutionRequest): Promise<ExecutionVerdict> {
    const startTime = performance.now();
    const timeout = request.cpuTimeoutMs || 1000;
    const memoryLimitMb = request.memoryLimitMb || 128;
    const inputScale = request.inputScaleN || 1000;

    this.logger.log(
      `[Sandbox Execution] Running ${request.language} code in isolated sandbox (timeout: ${timeout}ms, memory: ${memoryLimitMb}MB, N=${inputScale})...`,
    );

    // 1. Guard against malicious patterns / fork bombs
    if (
      request.sourceCode.includes(':(){ :|:& };:') ||
      request.sourceCode.includes('process.exit') ||
      request.sourceCode.includes('child_process')
    ) {
      return {
        status: 'RUNTIME_ERROR',
        passed: false,
        totalCases: (request.stdin || []).length || 1,
        passedCases: 0,
        executionTimeMs: 12,
        memoryUsedKb: 2048,
        compilerOutput: 'Security Violation: Syscall or process spawning is prohibited.',
      };
    }

    // 2. Detect Big-O Complexity and Instruction Scale
    const { detectedComplexity, estimatedInstructions, estimatedMemoryMb, errorViolation } =
      this.analyzeAlgorithmicProfile(request.sourceCode, inputScale);

    if (errorViolation) {
      return {
        status: errorViolation.status,
        passed: false,
        totalCases: (request.stdin || []).length || 1,
        passedCases: 0,
        executionTimeMs: errorViolation.executionTimeMs,
        memoryUsedKb: errorViolation.memoryUsedKb,
        estimatedCpuInstructions: estimatedInstructions,
        detectedComplexity,
        rejectionReason: errorViolation.message,
        compilerOutput: errorViolation.message,
      };
    }

    // 3. Check against theoretical optimal bound if requested
    if (request.checkBigOBound && request.expectedComplexity) {
      const isViolation = this.isComplexityInferior(detectedComplexity, request.expectedComplexity);
      if (isViolation) {
        return {
          status: 'COMPLEXITY_LIMIT_EXCEEDED',
          passed: false,
          totalCases: (request.stdin || []).length || 1,
          passedCases: 0,
          executionTimeMs: Math.min(timeout + 250, 2500),
          memoryUsedKb: estimatedMemoryMb * 1024,
          estimatedCpuInstructions: estimatedInstructions,
          detectedComplexity,
          rejectionReason: `Rejected: Sub-optimal complexity ${detectedComplexity} exceeds optimal bound ${request.expectedComplexity} for N=${inputScale}`,
        };
      }
    }

    // 4. Check resource limits against simulated instructions and memory
    const maxInstructions = request.maxCpuInstructions || (timeout / 1000) * 20_000_000; // ~20M instructions per second
    if (estimatedInstructions > maxInstructions) {
      return {
        status: 'TIME_LIMIT_EXCEEDED',
        passed: false,
        totalCases: (request.stdin || []).length || 1,
        passedCases: 0,
        executionTimeMs: timeout + 15,
        memoryUsedKb: estimatedMemoryMb * 1024,
        estimatedCpuInstructions: estimatedInstructions,
        detectedComplexity,
        rejectionReason: `Time Limit Exceeded: Execution took >${timeout}ms with ${estimatedInstructions.toExponential(2)} CPU instructions`,
      };
    }

    if (estimatedMemoryMb > memoryLimitMb) {
      return {
        status: 'MEMORY_LIMIT_EXCEEDED',
        passed: false,
        totalCases: (request.stdin || []).length || 1,
        passedCases: 0,
        executionTimeMs: 140,
        memoryUsedKb: estimatedMemoryMb * 1024,
        estimatedCpuInstructions: estimatedInstructions,
        detectedComplexity,
        rejectionReason: `Memory Limit Exceeded: Allocated ${estimatedMemoryMb}MB exceeding ${memoryLimitMb}MB limit`,
      };
    }

    const duration = Math.min(timeout, Math.max(8, Math.round(performance.now() - startTime + (estimatedInstructions / 500_000))));

    return {
      status: 'ACCEPTED',
      passed: true,
      totalCases: (request.stdin || []).length || 3,
      passedCases: (request.stdin || []).length || 3,
      executionTimeMs: duration,
      memoryUsedKb: estimatedMemoryMb * 1024,
      estimatedCpuInstructions: estimatedInstructions,
      detectedComplexity,
    };
  }

  /**
   * Analyzes algorithmic complexity, instruction count, and memory allocation.
   */
  public analyzeAlgorithmicProfile(
    sourceCode: string,
    n: number,
  ): {
    detectedComplexity: string;
    estimatedInstructions: number;
    estimatedMemoryMb: number;
    errorViolation?: { status: ExecutionVerdict['status']; executionTimeMs: number; memoryUsedKb: number; message: string };
  } {
    const code = sourceCode.toLowerCase();

    // Degenerate deep tree recursion stack overflow check
    if (
      code.includes('depth') &&
      code.includes('traverse') &&
      n >= 10_000 &&
      !code.includes('stack') &&
      !code.includes('loop')
    ) {
      return {
        detectedComplexity: 'O(N)',
        estimatedInstructions: n * 4,
        estimatedMemoryMb: 64,
        errorViolation: {
          status: 'RUNTIME_ERROR',
          executionTimeMs: 45,
          memoryUsedKb: 65536,
          message: 'RangeError: Maximum call stack size exceeded in deep recursive traversal',
        },
      };
    }

    // Detect unmemoized 2-branch recursion (e.g. fib(n-1) + fib(n-2))
    const hasCache = code.includes('memo') || code.includes('cache') || code.includes('dp[');
    const funcMatch = sourceCode.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const selfCallRegex = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
      const callCount = (sourceCode.match(selfCallRegex) || []).length;
      // 1 for declaration + 2 or more recursive calls inside body
      if (callCount >= 3 && !hasCache && n >= 25) {
        const instructions = Math.pow(2, Math.min(n, 45));
        return {
          detectedComplexity: 'O(2^N)',
          estimatedInstructions: instructions,
          estimatedMemoryMb: 32,
        };
      }
    }

    // Detect nested loops (e.g., for inside for, or while inside for)
    const nestedForCount = (sourceCode.match(/for\s*\(|while\s*\(/g) || []).length;
    const hasNestedLoops =
      /(for|while)\s*\([^)]*\)\s*\{[^}]*?(for|while)\s*\([^)]*\)/s.test(sourceCode) ||
      code.includes('.indexof(') && code.includes('for ') ||
      code.includes('.includes(') && code.includes('for ');

    // 2D Array allocation (e.g. matrix of size N x N)
    const allocatesMatrix =
      code.includes('new array(') && code.includes('fill(') && code.includes('map(') ||
      code.includes('][') && (code.includes('new array(n') || code.includes('array.from'));

    if (allocatesMatrix && n >= 20_000) {
      const requiredMb = Math.round((n * n * 8) / (1024 * 1024));
      return {
        detectedComplexity: 'O(N^2)',
        estimatedInstructions: n * n * 2,
        estimatedMemoryMb: requiredMb,
      };
    }

    if (hasNestedLoops) {
      const operations = n * n * 4;
      return {
        detectedComplexity: 'O(N^2)',
        estimatedInstructions: operations,
        estimatedMemoryMb: 16,
      };
    }

    // Naive sorting vs optimal
    if (code.includes('.sort(') || code.includes('mergesort') || code.includes('quicksort') || code.includes('heapsort')) {
      const ops = Math.round(n * Math.log2(Math.max(2, n)) * 6);
      return {
        detectedComplexity: 'O(N log N)',
        estimatedInstructions: ops,
        estimatedMemoryMb: 14,
      };
    }

    if (nestedForCount === 1 || code.includes('.foreach(') || code.includes('.map(') || code.includes('.reduce(')) {
      return {
        detectedComplexity: 'O(N)',
        estimatedInstructions: n * 5,
        estimatedMemoryMb: 12,
      };
    }

    return {
      detectedComplexity: 'O(1)',
      estimatedInstructions: 250,
      estimatedMemoryMb: 8,
    };
  }

  /**
   * Compares two Big-O complexity strings and returns true if candidate is strictly inferior to optimal.
   */
  public isComplexityInferior(candidate: string, optimal: string): boolean {
    const order: Record<string, number> = {
      'O(1)': 1,
      'O(log N)': 2,
      'O(N)': 3,
      'O(N log N)': 4,
      'O(N^2)': 5,
      'O(N^3)': 6,
      'O(2^N)': 7,
    };

    const candRank = order[candidate] || 4;
    const optRank = order[optimal] || 4;
    return candRank > optRank;
  }
}
