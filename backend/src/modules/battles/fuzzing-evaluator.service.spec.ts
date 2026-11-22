import { Test, TestingModule } from '@nestjs/testing';
import { FuzzingEvaluatorService, FuzzParamConstraint } from './fuzzing-evaluator.service';

describe('FuzzingEvaluatorService Property-Based & Adversarial Testing (#1071)', () => {
  let service: FuzzingEvaluatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FuzzingEvaluatorService],
    }).compile();

    service = module.get<FuzzingEvaluatorService>(FuzzingEvaluatorService);
  });

  describe('Adversarial Input Generation', () => {
    it('generates 1,000 adversarial inputs including edge cases and boundaries', () => {
      const constraints: FuzzParamConstraint[] = [
        { name: 'n', type: 'integer', min: -500, max: 500 },
        { name: 'text', type: 'string', minLength: 0, maxLength: 30 },
      ];

      const inputs = service.generateAdversarialInputs(constraints, 1000);
      expect(inputs.length).toBe(1000);

      // Verifies presence of critical boundary values
      const numbers = inputs.map((tuple) => tuple[0]);
      expect(numbers).toContain(0);
      expect(numbers).toContain(-1);
      expect(numbers).toContain(1);

      const strings = inputs.map((tuple) => tuple[1]);
      expect(strings).toContain('');
      expect(strings.some((s) => s.includes('🔥') || s.includes('abc'))).toBe(true);
    });
  });

  describe('Property-Based Evaluation & Equivalence Verification', () => {
    it('passes completely when candidate solution is genuinely equivalent to reference', async () => {
      const referenceCode = `
        function absVal(x) {
          return Math.abs(x);
        }
      `;

      const candidateCode = `
        function absVal(x) {
          return x < 0 ? -x : x;
        }
      `;

      const report = await service.evaluateWithFuzzer({
        referenceCode,
        candidateCode,
        entryFunctionName: 'absVal',
        constraints: [{ name: 'x', type: 'integer', min: -10000, max: 10000 }],
        options: { iterations: 100 },
      });

      expect(report.passed).toBe(true);
      expect(report.hardcodedLookupDetected).toBe(false);
      expect(report.passedIterations).toBe(100);
    });

    it('catches solutions that fail on negative numbers or boundary inputs and shrinks counterexample', async () => {
      const referenceCode = `
        function doublePositive(x) {
          return x * 2;
        }
      `;

      // Flawed candidate solution: fails for negative numbers
      const candidateCode = `
        function doublePositive(x) {
          if (x < 0) return 0; // Bug on negative numbers
          return x * 2;
        }
      `;

      const report = await service.evaluateWithFuzzer({
        referenceCode,
        candidateCode,
        entryFunctionName: 'doublePositive',
        constraints: [{ name: 'x', type: 'integer', min: -1000, max: 1000 }],
        options: { iterations: 50 },
      });

      expect(report.passed).toBe(false);
      expect(report.counterexample).toBeDefined();
      expect(report.counterexample?.expectedOutput).not.toEqual(report.counterexample?.actualOutput);
      expect(report.counterexample?.shrinkSteps).toBeGreaterThanOrEqual(1);

      // The minimal shrunk input for negative failure should be -1
      expect(report.counterexample?.input[0]).toBeLessThan(0);
    });

    it('shrinks array counterexamples down to minimal elements', async () => {
      const referenceCode = `
        function sumAll(arr) {
          return arr.reduce((acc, curr) => acc + curr, 0);
        }
      `;

      // Candidate solution fails whenever any element is 42
      const candidateCode = `
        function sumAll(arr) {
          if (arr.includes(42)) throw new Error('Unlucky number');
          return arr.reduce((acc, curr) => acc + curr, 0);
        }
      `;

      const failingInput = [[10, 20, 30, 42, 50, 60]];
      const constraints: FuzzParamConstraint[] = [{ name: 'arr', type: 'array', itemType: 'integer' }];

      const refRunner = (args: any[]) => args[0].reduce((a: number, b: number) => a + b, 0);
      const candRunner = (args: any[]) => {
        if (args[0].includes(42)) throw new Error('Unlucky number');
        return args[0].reduce((a: number, b: number) => a + b, 0);
      };

      const result = service.shrinkCounterexample(failingInput, constraints, refRunner, candRunner, 50);

      expect(result.steps).toBeGreaterThan(0);
      expect(result.shrunkInput[0].length).toBeLessThan(failingInput[0].length);
    });
  });

  describe('Hardcoded Lookup Detection', () => {
    it('detects cheater solutions that hardcode static switch/case or map lookup tables', async () => {
      const referenceCode = `
        function square(x) {
          return x * x;
        }
      `;

      // Hardcoded solution only supporting static inputs 1, 2, 3
      const hardcodedCandidateCode = `
        function square(x) {
          switch(x) {
            case 1: return 1;
            case 2: return 4;
            case 3: return 9;
            case 4: return 16;
            default: return 0;
          }
        }
      `;

      const report = await service.evaluateWithFuzzer({
        referenceCode,
        candidateCode: hardcodedCandidateCode,
        entryFunctionName: 'square',
        constraints: [{ name: 'x', type: 'integer', min: 1, max: 1000 }],
        options: { iterations: 100 },
      });

      expect(report.passed).toBe(false);
      expect(report.hardcodedLookupDetected).toBe(true);
      expect(report.failureType).toBe('HARDCODED_LOOKUP_DETECTED');
      expect(report.summary).toContain('hardcode lookup tables');
    });
  });
});
