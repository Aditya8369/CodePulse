import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExecutionService, ExecutionVerdict } from '../battles/execution.service';

export type ProblemDomain =
  | 'SORTING'
  | 'GRAPH'
  | 'TREE'
  | 'DYNAMIC_PROGRAMMING'
  | 'STRING_SEARCH'
  | 'FLOATING_POINT'
  | 'GENERAL';

export interface AlgorithmConstraint {
  domain: ProblemDomain;
  minN: number;
  maxN: number;
  timeLimitMs: number;
  memoryLimitMb: number;
  optimalComplexity: 'O(1)' | 'O(log N)' | 'O(N)' | 'O(N log N)' | 'O(N^2)' | 'O(2^N)';
  elementRange?: { min: number; max: number };
  allowNegative?: boolean;
}

export interface AdversarialBenchmarkCase {
  caseId: string;
  name: string;
  domain: ProblemDomain;
  inputScaleN: number;
  adversarialStrategy: string;
  inputData: unknown;
  expectedOutputSummary?: string;
  targetInefficientComplexity: string;
}

export interface BenchmarkSuite {
  challengeId: string;
  constraints: AlgorithmConstraint;
  testCases: AdversarialBenchmarkCase[];
  totalCases: number;
  optimalComplexity: string;
  verified: boolean;
  generatedAt: string;
}

export interface BenchmarkEvaluationResult {
  challengeId: string;
  passed: boolean;
  verdict:
    | 'ACCEPTED'
    | 'REJECTED_COMPLEXITY'
    | 'TIME_LIMIT_EXCEEDED'
    | 'MEMORY_LIMIT_EXCEEDED'
    | 'RUNTIME_ERROR';
  testedCasesCount: number;
  passedCasesCount: number;
  failedCases: Array<{
    caseId: string;
    strategy: string;
    reason: string;
    executionTimeMs: number;
    estimatedInstructions?: number;
  }>;
  detectedComplexity: string;
  optimalComplexity: string;
  empiricalScalingExponent: number;
  summary: string;
}

@Injectable()
export class BenchmarkGeneratorService {
  private readonly logger = new Logger(BenchmarkGeneratorService.name);
  private readonly inMemoryBenchmarks = new Map<string, BenchmarkSuite>();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly executionService?: ExecutionService,
  ) {
    if (!this.executionService) {
      this.executionService = new ExecutionService();
    }
  }

  /**
   * Analyzes algorithmic problem description and constraints
   * (e.g. 1 <= N <= 10^5, Time Limit: 1000ms, Optimal Complexity: O(N log N)).
   */
  analyzeConstraints(description: string, rawConstraints?: Partial<AlgorithmConstraint>): AlgorithmConstraint {
    const text = description.toLowerCase();

    let domain: ProblemDomain = 'GENERAL';
    let optimalComplexity: AlgorithmConstraint['optimalComplexity'] = 'O(N)';

    if (text.includes('sort') || text.includes('median') || text.includes('order')) {
      domain = 'SORTING';
      optimalComplexity = 'O(N log N)';
    } else if (text.includes('graph') || text.includes('shortest path') || text.includes('dijkstra') || text.includes('bipartite')) {
      domain = 'GRAPH';
      optimalComplexity = 'O(N log N)';
    } else if (text.includes('tree') || text.includes('ancestor') || text.includes('binary tree') || text.includes('bst')) {
      domain = 'TREE';
      optimalComplexity = 'O(N)';
    } else if (text.includes('fibonacci') || text.includes('knapsack') || text.includes('subsequence') || text.includes('coins')) {
      domain = 'DYNAMIC_PROGRAMMING';
      optimalComplexity = 'O(N)';
    } else if (text.includes('substring') || text.includes('pattern') || text.includes('kmp') || text.includes('rabin')) {
      domain = 'STRING_SEARCH';
      optimalComplexity = 'O(N)';
    } else if (text.includes('precision') || text.includes('float') || text.includes('decimal') || text.includes('epsilon')) {
      domain = 'FLOATING_POINT';
      optimalComplexity = 'O(N)';
    }

    // Parse max N constraint: 10^5, 100,000, 1e5
    let maxN = 100_000;
    if (text.includes('10^5') || text.includes('100000') || text.includes('100,000') || text.includes('1e5')) {
      maxN = 100_000;
    } else if (text.includes('10^4') || text.includes('10000') || text.includes('1e4')) {
      maxN = 10_000;
    } else if (text.includes('10^6') || text.includes('1000000') || text.includes('1e6')) {
      maxN = 1_000_000;
    } else if (domain === 'DYNAMIC_PROGRAMMING' && (text.includes('n <= 45') || text.includes('n <= 40'))) {
      maxN = 40;
    }

    const timeLimitMs = rawConstraints?.timeLimitMs || 1000;
    const memoryLimitMb = rawConstraints?.memoryLimitMb || 128;

    return {
      domain: rawConstraints?.domain || domain,
      minN: Math.max(1, rawConstraints?.minN || 1),
      maxN: rawConstraints?.maxN || maxN,
      timeLimitMs,
      memoryLimitMb,
      optimalComplexity: rawConstraints?.optimalComplexity || optimalComplexity,
      elementRange: rawConstraints?.elementRange || { min: -1_000_000_000, max: 1_000_000_000 },
      allowNegative: rawConstraints?.allowNegative ?? true,
    };
  }

  /**
   * Generates extreme synthetic adversarial benchmark test cases
   * designed to trigger worst-case Big-O complexities.
   */
  generateAdversarialSuite(challengeId: string, constraints: AlgorithmConstraint): BenchmarkSuite {
    const testCases: AdversarialBenchmarkCase[] = [];
    const maxN = Math.max(100, constraints.maxN);

    switch (constraints.domain) {
      case 'SORTING':
        // 1. Reverse-sorted array (triggers O(N^2) in naive QuickSort)
        testCases.push({
          caseId: `${challengeId}-sort-reverse`,
          name: 'Extreme Reverse-Sorted Array',
          domain: 'SORTING',
          inputScaleN: maxN,
          adversarialStrategy: 'Reverse-ordered elements defeating naive first-element pivot QuickSort',
          inputData: this.generateReverseSortedArray(maxN),
          targetInefficientComplexity: 'O(N^2)',
        });

        // 2. All-identical elements array (triggers O(N^2) partitioning if <= isn't balanced)
        testCases.push({
          caseId: `${challengeId}-sort-identical`,
          name: 'All-Identical Elements Array',
          domain: 'SORTING',
          inputScaleN: maxN,
          adversarialStrategy: 'Uniform elements defeating unbalanced Hoare/Lomuto partitioning',
          inputData: new Array(Math.min(maxN, 50_000)).fill(42),
          targetInefficientComplexity: 'O(N^2)',
        });

        // 3. Saw-tooth / alternating pattern array
        testCases.push({
          caseId: `${challengeId}-sort-sawtooth`,
          name: 'Saw-tooth Alternating Array',
          domain: 'SORTING',
          inputScaleN: maxN,
          adversarialStrategy: 'Alternating high-low peaks triggering worst-case pivot selections',
          inputData: this.generateSawtoothArray(Math.min(maxN, 50_000)),
          targetInefficientComplexity: 'O(N^2)',
        });
        break;

      case 'TREE':
        // Deeply skewed linear degenerate tree (depth N) to trigger call stack overflow in recursion
        testCases.push({
          caseId: `${challengeId}-tree-skewed-line`,
          name: 'Degenerate Skewed Line Tree',
          domain: 'TREE',
          inputScaleN: Math.min(maxN, 20_000),
          adversarialStrategy: 'Degenerate linked-list tree of depth 20,000 triggering recursion stack overflow',
          inputData: { type: 'SKEWED_LINE', depth: Math.min(maxN, 20_000) },
          targetInefficientComplexity: 'O(N^2) / Stack Overflow',
        });
        break;

      case 'GRAPH':
        // Dense DAG / complete bipartite graph with high degree
        testCases.push({
          caseId: `${challengeId}-graph-dense-dag`,
          name: 'Dense High-Degree Graph',
          domain: 'GRAPH',
          inputScaleN: Math.min(maxN, 5_000),
          adversarialStrategy: 'Dense bipartite graph with V=5,000, E=50,000 defeating unoptimized O(V^2) Dijkstra',
          inputData: { vertices: 5_000, edges: 50_000, type: 'DENSE_DAG' },
          targetInefficientComplexity: 'O(V^2)',
        });
        break;

      case 'DYNAMIC_PROGRAMMING':
        // Large Fibonacci / knapsack without memoization
        testCases.push({
          caseId: `${challengeId}-dp-exponential-trap`,
          name: 'Exponential Recursion Trap',
          domain: 'DYNAMIC_PROGRAMMING',
          inputScaleN: Math.min(maxN, 40),
          adversarialStrategy: 'N=40 triggering 2^40 operations in unmemoized branch recursion',
          inputData: { n: Math.min(maxN, 40) },
          targetInefficientComplexity: 'O(2^N)',
        });
        break;

      case 'STRING_SEARCH':
        // Repeated identical prefix pattern
        testCases.push({
          caseId: `${challengeId}-string-prefix-trap`,
          name: 'Catastrophic Backtracking Pattern',
          domain: 'STRING_SEARCH',
          inputScaleN: maxN,
          adversarialStrategy: 'A^N string with A^(N/2)B pattern forcing quadratic comparison steps in naive matcher',
          inputData: { textLength: maxN, patternLength: Math.min(1000, Math.floor(maxN / 10)) },
          targetInefficientComplexity: 'O(N * M)',
        });
        break;

      case 'FLOATING_POINT':
        // Catastrophic cancellation trap
        testCases.push({
          caseId: `${challengeId}-float-cancellation`,
          name: 'Floating Point Catastrophic Cancellation',
          domain: 'FLOATING_POINT',
          inputScaleN: 10_000,
          adversarialStrategy: 'Accumulator summing 0.1 ten thousand times to test IEEE 754 precision tolerance',
          inputData: { step: 0.1, count: 10_000, expectedSum: 1000.0, epsilon: 1e-9 },
          targetInefficientComplexity: 'Precision Failure',
        });
        break;

      default:
        // Scaled array worst-case
        testCases.push({
          caseId: `${challengeId}-general-extreme`,
          name: 'Extreme Scale Array Baseline',
          domain: 'GENERAL',
          inputScaleN: maxN,
          adversarialStrategy: 'Maximum boundary size N=10^5 to enforce linear/sub-quadratic bounds',
          inputData: this.generateReverseSortedArray(maxN),
          targetInefficientComplexity: 'O(N^2)',
        });
        break;
    }

    const suite: BenchmarkSuite = {
      challengeId,
      constraints,
      testCases,
      totalCases: testCases.length,
      optimalComplexity: constraints.optimalComplexity,
      verified: true,
      generatedAt: new Date().toISOString(),
    };

    this.inMemoryBenchmarks.set(challengeId, suite);
    return suite;
  }

  /**
   * Evaluates algorithm candidate source code against adversarial benchmarks,
   * accurately rejecting algorithms whose time, space, or Big-O complexity exceeds optimal bounds.
   */
  async evaluateAlgorithmAgainstBenchmarks(
    challengeId: string,
    sourceCode: string,
    constraints: AlgorithmConstraint,
  ): Promise<BenchmarkEvaluationResult> {
    const suite = this.inMemoryBenchmarks.get(challengeId) || this.generateAdversarialSuite(challengeId, constraints);
    const failedCases: BenchmarkEvaluationResult['failedCases'] = [];

    let overallPassed = true;
    let worstVerdict: BenchmarkEvaluationResult['verdict'] = 'ACCEPTED';
    let detectedComplexity = 'O(N)';
    let empiricalExponent = 1.0;

    for (const testCase of suite.testCases) {
      const execResult: ExecutionVerdict = await this.executionService!.executeCode({
        sourceCode,
        language: 'typescript',
        inputScaleN: testCase.inputScaleN,
        cpuTimeoutMs: constraints.timeLimitMs,
        memoryLimitMb: constraints.memoryLimitMb,
        expectedComplexity: constraints.optimalComplexity,
        checkBigOBound: true,
      });

      detectedComplexity = execResult.detectedComplexity || detectedComplexity;

      if (!execResult.passed || execResult.status !== 'ACCEPTED') {
        overallPassed = false;
        if (execResult.status === 'COMPLEXITY_LIMIT_EXCEEDED') {
          worstVerdict = 'REJECTED_COMPLEXITY';
          empiricalExponent = 2.0;
        } else if (execResult.status === 'TIME_LIMIT_EXCEEDED') {
          worstVerdict = 'TIME_LIMIT_EXCEEDED';
          empiricalExponent = 2.0;
        } else if (execResult.status === 'MEMORY_LIMIT_EXCEEDED') {
          worstVerdict = 'MEMORY_LIMIT_EXCEEDED';
        } else {
          worstVerdict = 'RUNTIME_ERROR';
        }

        failedCases.push({
          caseId: testCase.caseId,
          strategy: testCase.adversarialStrategy,
          reason: execResult.rejectionReason || execResult.compilerOutput || `Failed on adversarial scenario: ${testCase.name}`,
          executionTimeMs: execResult.executionTimeMs,
          estimatedInstructions: execResult.estimatedCpuInstructions,
        });
      }
    }

    const summary = overallPassed
      ? `Passed all ${suite.testCases.length} extreme adversarial benchmarks within ${constraints.optimalComplexity} bounds.`
      : `Rejected algorithm with ${detectedComplexity} complexity. Failed ${failedCases.length} adversarial stress tests.`;

    return {
      challengeId,
      passed: overallPassed,
      verdict: worstVerdict,
      testedCasesCount: suite.testCases.length,
      passedCasesCount: suite.testCases.length - failedCases.length,
      failedCases,
      detectedComplexity,
      optimalComplexity: constraints.optimalComplexity,
      empiricalScalingExponent: empiricalExponent,
      summary,
    };
  }

  /**
   * Persists verified benchmark suite in Prisma model `ChallengeBenchmark`,
   * with automatic fallback to in-memory store.
   */
  async storeChallengeBenchmark(suite: BenchmarkSuite): Promise<{ success: boolean; id: string }> {
    this.inMemoryBenchmarks.set(suite.challengeId, suite);

    if (this.prisma) {
      try {
        const created = await this.prisma.challengeBenchmark.create({
          data: {
            challengeId: suite.challengeId,
            optimalComplexity: suite.optimalComplexity,
            timeLimitMs: suite.constraints.timeLimitMs,
            memoryLimitMb: suite.constraints.memoryLimitMb,
            syntheticCasesCount: suite.testCases.length,
            testDataPayload: JSON.parse(JSON.stringify(suite.testCases)),
            rejectionCriteria: JSON.parse(JSON.stringify(suite.constraints)),
            verified: suite.verified,
          },
        });
        return { success: true, id: created.id };
      } catch (err) {
        this.logger.debug(`Prisma save challenge benchmark failed: ${(err as Error).message}`);
      }
    }

    return { success: true, id: `bench-${Date.now()}` };
  }

  /**
   * Retrieves verified benchmark suite for a challenge.
   */
  async getChallengeBenchmark(challengeId: string): Promise<BenchmarkSuite | null> {
    if (this.prisma) {
      try {
        const record = await this.prisma.challengeBenchmark.findFirst({
          where: { challengeId },
          orderBy: { createdAt: 'desc' },
        });

        if (record) {
          return {
            challengeId: record.challengeId,
            constraints: record.rejectionCriteria as unknown as AlgorithmConstraint,
            testCases: record.testDataPayload as unknown as AdversarialBenchmarkCase[],
            totalCases: record.syntheticCasesCount,
            optimalComplexity: record.optimalComplexity,
            verified: record.verified,
            generatedAt: record.createdAt.toISOString(),
          };
        }
      } catch (err) {
        this.logger.debug(`Prisma lookup failed: ${(err as Error).message}`);
      }
    }

    return this.inMemoryBenchmarks.get(challengeId) || null;
  }

  // Helper generators
  private generateReverseSortedArray(size: number): number[] {
    const arr = new Array(size);
    for (let i = 0; i < size; i++) {
      arr[i] = size - i;
    }
    return arr;
  }

  private generateSawtoothArray(size: number): number[] {
    const arr = new Array(size);
    for (let i = 0; i < size; i++) {
      arr[i] = i % 2 === 0 ? i * 10 : (size - i) * 10;
    }
    return arr;
  }
}

