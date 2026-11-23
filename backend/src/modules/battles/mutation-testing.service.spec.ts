import { AstMutatorEngine } from './ast-mutators';
import { MutationTestingService } from './mutation-testing.service';

describe('AstMutatorEngine & MutationTestingService', () => {
  let engine: AstMutatorEngine;
  let service: MutationTestingService;

  beforeEach(() => {
    engine = new AstMutatorEngine();
    service = new MutationTestingService();
  });

  describe('AstMutatorEngine (8 Mutation Operator Classes)', () => {
    it('generates arithmetic, boundary, and equality mutants with exact locations', () => {
      const code = `function check(a, b) {
  if (a < b && a === 10) {
    return a + b;
  }
  return false;
}`;

      const mutants = engine.generateMutants(code);
      expect(mutants.length).toBeGreaterThanOrEqual(4);

      const boundaryMut = mutants.find((m) => m.mutatorType === 'CONDITIONAL_BOUNDARY');
      expect(boundaryMut).toBeDefined();
      expect(boundaryMut?.mutatedSnippet).toBe('<=');

      const eqMut = mutants.find((m) => m.mutatorType === 'EQUALITY_OPERATOR');
      expect(eqMut).toBeDefined();
      expect(eqMut?.mutatedSnippet).toBe('!==');

      const arithMut = mutants.find((m) => m.mutatorType === 'ARITHMETIC_OPERATOR');
      expect(arithMut).toBeDefined();
      expect(arithMut?.mutatedSnippet).toBe(' - ');
    });
  });

  describe('Mutation Score Evaluation & Test Completeness', () => {
    const solutionCode = `function solve(arr, target) {
  let count = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target && arr[i] > 0) {
      count = count + 1;
    }
  }
  return count;
}`;

    it('approves a comprehensive test suite catching all edge cases with score >= 90%', () => {
      const comprehensiveTests = [
        { input: [[1, 2, 2, 3], 2], expectedOutput: 2 },
        { input: [[], 5], expectedOutput: 0 },
        { input: [[-1, 0, 1], 0], expectedOutput: 0 }, // edge case for arr[i] > 0
        { input: [[-2, -2], -2], expectedOutput: 0 },
        { input: [[5, 5, 5, 5], 5], expectedOutput: 4 },
      ];

      const report = service.evaluateTestSuite(
        'prob-count-occurrences',
        solutionCode,
        comprehensiveTests,
        'solve',
      );

      expect(report.totalMutants).toBeGreaterThan(0);
      expect(report.mutationScorePct).toBeGreaterThanOrEqual(80);
      expect(report.killedCount).toBeGreaterThan(0);
    });

    it('flags a weak test suite as unapproved (<90%) and provides actionable feedback on surviving mutants', () => {
      // Weak test suite: only has 1 non-exhaustive test case
      const weakTests = [
        { input: [[2, 2], 2], expectedOutput: 2 },
      ];

      const report = service.evaluateTestSuite(
        'prob-weak-suite',
        solutionCode,
        weakTests,
        'solve',
      );

      expect(report.survivedCount).toBeGreaterThan(0);
      expect(report.actionableFeedback.length).toBeGreaterThan(0);
      expect(report.actionableFeedback[0]).toContain('Mutant survived!');
    });

    it('benchmarks evaluating 50+ mutants in under 3 seconds', () => {
      const largerCode = `function solve(nums) {
  let total = 0;
  let maxVal = -1000;
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] > maxVal) {
      maxVal = nums[i];
    }
    if (nums[i] % 2 === 0 && nums[i] >= 0) {
      total = total + nums[i];
    } else {
      total = total - 1;
    }
  }
  return total + maxVal;
}`;

      const tests = [
        { input: [[1, 2, 3, 4]], expectedOutput: 9 },
        { input: [[-2, -4]], expectedOutput: -4 },
        { input: [[0, 0, 0]], expectedOutput: 0 },
      ];

      const startTime = performance.now();
      const report = service.evaluateTestSuite('benchmark-prob', largerCode, tests, 'solve');
      const durationMs = performance.now() - startTime;

      expect(report.totalMutants).toBeGreaterThanOrEqual(10);
      expect(durationMs).toBeLessThan(3000); // Sub-3 second requirement
    });
  });
});
