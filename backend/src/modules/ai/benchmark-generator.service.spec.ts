import { BenchmarkGeneratorService } from './benchmark-generator.service';
import { ExecutionService } from '../battles/execution.service';

describe('BenchmarkGeneratorService', () => {
  let service: BenchmarkGeneratorService;
  let executionService: ExecutionService;

  beforeEach(() => {
    executionService = new ExecutionService();
    service = new BenchmarkGeneratorService(undefined, executionService);
  });

  describe('analyzeConstraints', () => {
    it('analyzes sorting algorithm constraints with O(N log N) optimal bound and N=10^5', () => {
      const desc = 'Given an array of integers, sort the array in ascending order. Constraints: 1 <= N <= 10^5, Time limit: 1000ms.';
      const constraints = service.analyzeConstraints(desc);

      expect(constraints.domain).toBe('SORTING');
      expect(constraints.maxN).toBe(100_000);
      expect(constraints.timeLimitMs).toBe(1000);
      expect(constraints.optimalComplexity).toBe('O(N log N)');
    });

    it('analyzes graph shortest path problem constraints with dense graph connectivity', () => {
      const desc = 'Find the shortest path in a weighted directed graph using Dijkstra. V <= 10^4, E <= 10^5.';
      const constraints = service.analyzeConstraints(desc);

      expect(constraints.domain).toBe('GRAPH');
      expect(constraints.optimalComplexity).toBe('O(N log N)');
    });

    it('analyzes dynamic programming constraints with small N and O(N) optimal bound', () => {
      const desc = 'Compute the Nth Fibonacci number where N <= 40.';
      const constraints = service.analyzeConstraints(desc);

      expect(constraints.domain).toBe('DYNAMIC_PROGRAMMING');
      expect(constraints.maxN).toBe(40);
      expect(constraints.optimalComplexity).toBe('O(N)');
    });
  });

  describe('generateAdversarialSuite', () => {
    it('generates extreme adversarial datasets that trigger worst-case execution paths for QuickSort', () => {
      const constraints = service.analyzeConstraints('Sort the array. 1 <= N <= 10^5');
      const suite = service.generateAdversarialSuite('challenge-sort-1', constraints);

      expect(suite.challengeId).toBe('challenge-sort-1');
      expect(suite.testCases.length).toBeGreaterThanOrEqual(3);

      const reverseCase = suite.testCases.find((c) => c.name.includes('Reverse-Sorted'));
      expect(reverseCase).toBeDefined();
      expect(reverseCase!.inputScaleN).toBe(100_000);
      expect(Array.isArray(reverseCase!.inputData)).toBe(true);
      expect((reverseCase!.inputData as number[])[0]).toBe(100_000);
      expect((reverseCase!.inputData as number[])[99_999]).toBe(1);

      const identicalCase = suite.testCases.find((c) => c.name.includes('All-Identical'));
      expect(identicalCase).toBeDefined();

      const sawtoothCase = suite.testCases.find((c) => c.name.includes('Saw-tooth'));
      expect(sawtoothCase).toBeDefined();
    });

    it('generates degenerate skewed linear trees for recursion stress-testing', () => {
      const constraints = service.analyzeConstraints('Given a binary tree, compute lowest common ancestor. N <= 10^5');
      const suite = service.generateAdversarialSuite('challenge-tree-1', constraints);

      const treeCase = suite.testCases.find((c) => c.domain === 'TREE');
      expect(treeCase).toBeDefined();
      expect((treeCase!.inputData as { type: string }).type).toBe('SKEWED_LINE');
    });

    it('validates inputs against problem schema constraints without generating invalid payloads', () => {
      const constraints = service.analyzeConstraints('Sort numbers', {
        minN: 5,
        maxN: 200,
        timeLimitMs: 500,
      });
      const suite = service.generateAdversarialSuite('challenge-schema-check', constraints);

      expect(suite.totalCases).toBeGreaterThan(0);
      for (const tc of suite.testCases) {
        expect(tc.caseId).toBeDefined();
        expect(tc.inputScaleN).toBeGreaterThanOrEqual(constraints.minN);
        expect(tc.inputScaleN).toBeLessThanOrEqual(100_000);
      }
    });
  });

  describe('evaluateAlgorithmAgainstBenchmarks', () => {
    it('accurately fails sub-optimal O(N^2) algorithms on N=10^5 inputs', async () => {
      const constraints = service.analyzeConstraints('Sort the numbers. 1 <= N <= 10^5');

      // Sub-optimal nested loops O(N^2) bubble sort algorithm
      const quadraticCode = `
        function bubbleSort(arr: number[]): number[] {
          for (let i = 0; i < arr.length; i++) {
            for (let j = 0; j < arr.length - i - 1; j++) {
              if (arr[j] > arr[j + 1]) {
                const temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
              }
            }
          }
          return arr;
        }
      `;

      const result = await service.evaluateAlgorithmAgainstBenchmarks('challenge-sort-1', quadraticCode, constraints);

      expect(result.passed).toBe(false);
      expect(result.verdict).toMatch(/REJECTED_COMPLEXITY|TIME_LIMIT_EXCEEDED/);
      expect(result.detectedComplexity).toBe('O(N^2)');
      expect(result.failedCases.length).toBeGreaterThan(0);
      expect(result.failedCases[0].reason).toContain('Rejected');
    });

    it('passes optimal O(N log N) sorting algorithms on adversarial inputs', async () => {
      const constraints = service.analyzeConstraints('Sort the numbers. 1 <= N <= 10^5');

      // Optimal O(N log N) mergesort / native sort algorithm
      const optimalCode = `
        function sortArray(arr: number[]): number[] {
          return arr.slice().sort((a, b) => a - b);
        }
      `;

      const result = await service.evaluateAlgorithmAgainstBenchmarks('challenge-sort-2', optimalCode, constraints);

      expect(result.passed).toBe(true);
      expect(result.verdict).toBe('ACCEPTED');
      expect(result.detectedComplexity).toBe('O(N log N)');
      expect(result.failedCases.length).toBe(0);
    });

    it('rejects unmemoized exponential recursion on Fibonacci N=40 inputs', async () => {
      const constraints = service.analyzeConstraints('Compute the Nth Fibonacci number where N <= 40');

      // Unmemoized exponential recursion fib(n-1) + fib(n-2)
      const exponentialCode = `
        function fib(n: number): number {
          if (n <= 1) return n;
          return fib(n - 1) + fib(n - 2);
        }
      `;

      const result = await service.evaluateAlgorithmAgainstBenchmarks('challenge-dp-1', exponentialCode, constraints);

      expect(result.passed).toBe(false);
      expect(result.verdict).toMatch(/TIME_LIMIT_EXCEEDED|REJECTED_COMPLEXITY/);
      expect(result.detectedComplexity).toBe('O(2^N)');
    });
  });

  describe('storeChallengeBenchmark and getChallengeBenchmark', () => {
    it('persists and retrieves benchmark suites from memory fallback store', async () => {
      const constraints = service.analyzeConstraints('Sort array N <= 10^5');
      const suite = service.generateAdversarialSuite('challenge-persist-1', constraints);

      const storeResult = await service.storeChallengeBenchmark(suite);
      expect(storeResult.success).toBe(true);

      const retrieved = await service.getChallengeBenchmark('challenge-persist-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.challengeId).toBe('challenge-persist-1');
      expect(retrieved!.testCases.length).toBe(suite.testCases.length);
    });
  });
});

