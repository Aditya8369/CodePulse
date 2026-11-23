import { Test, TestingModule } from '@nestjs/testing';
import { PlagiarismService } from './plagiarism.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PlagiarismService', () => {
  let service: PlagiarismService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      battle: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      battleSubmission: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'sub-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlagiarismService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<PlagiarismService>(PlagiarismService);
  });

  describe('AST Normalization & Tokenization', () => {
    it('should strip comments and whitespace correctly', () => {
      const code = `
        // This is a single line comment
        function add(a, b) {
          /* Multiline comment */
          return a + b;
        }
      `;
      const tokens = service.normalizeAndTokenize(code, 'typescript');
      expect(tokens).toContain('function');
      expect(tokens).toContain('return');
      expect(tokens).toContain('+');
      expect(tokens.join(' ')).not.toContain('This is a single line');
      expect(tokens.join(' ')).not.toContain('Multiline comment');
    });

    it('should normalize identifiers into canonical IDs ensuring renaming invariance', () => {
      const code1 = `
        function binarySearch(arr, target) {
          let left = 0;
          let right = arr.length - 1;
          while (left <= right) {
            let mid = Math.floor((left + right) / 2);
            if (arr[mid] === target) return mid;
            if (arr[mid] < target) left = mid + 1;
            else right = mid - 1;
          }
          return -1;
        }
      `;

      const code2 = `
        // Renamed function and variable parameters with extra comments
        function searchTarget(nums, val) {
          let startIdx = 0;
          let endIdx = nums.length - 1;
          while (startIdx <= endIdx) {
            let center = Math.floor((startIdx + endIdx) / 2);
            if (nums[center] === val) return center;
            if (nums[center] < val) startIdx = center + 1;
            else endIdx = center - 1;
          }
          return -1;
        }
      `;

      const tokens1 = service.normalizeAndTokenize(code1, 'typescript');
      const tokens2 = service.normalizeAndTokenize(code2, 'typescript');

      expect(tokens1).toEqual(tokens2);
    });

    it('should normalize python comments and docstrings', () => {
      const pyCode = `
        def factorial(n):
          """Compute factorial recursively"""
          # Base condition
          if n <= 1:
            return 1
          return n * factorial(n - 1)
      `;
      const tokens = service.normalizeAndTokenize(pyCode, 'python');
      expect(tokens).toContain('def');
      expect(tokens).toContain('if');
      expect(tokens).toContain('return');
      expect(tokens.join(' ')).not.toContain('Compute factorial');
      expect(tokens.join(' ')).not.toContain('Base condition');
    });
  });

  describe('Winnowing Fingerprinting Algorithm', () => {
    it('should generate bounded deterministic fingerprints', () => {
      const tokens = ['function', 'ID_0', '(', 'ID_1', ')', '{', 'return', 'ID_1', '+', '__NUM__', ';', '}'];
      const fingerprints1 = service.computeWinnowingFingerprints(tokens, 4, 3);
      const fingerprints2 = service.computeWinnowingFingerprints(tokens, 4, 3);

      expect(fingerprints1.length).toBeGreaterThan(0);
      expect(fingerprints1).toEqual(fingerprints2);
    });

    it('should handle small token sequences without crashing', () => {
      const tokens = ['return', '__NUM__'];
      const fingerprints = service.computeWinnowingFingerprints(tokens, 5, 4);
      expect(fingerprints.length).toBe(1);
    });
  });

  describe('Similarity Calculation', () => {
    it('should return > 85% similarity for plagiarized / renamed implementations', () => {
      const original = `
        function bubbleSort(list) {
          for (let i = 0; i < list.length; i++) {
            for (let j = 0; j < list.length - i - 1; j++) {
              if (list[j] > list[j + 1]) {
                let temp = list[j];
                list[j] = list[j + 1];
                list[j + 1] = temp;
              }
            }
          }
          return list;
        }
      `;

      const copied = `
        // Renamed variable identifiers and altered layout
        function sortElements(items) {
          for (let step = 0; step < items.length; step++) {
            for (let idx = 0; idx < items.length - step - 1; idx++) {
              if (items[idx] > items[idx + 1]) {
                let swap = items[idx];
                items[idx] = items[idx + 1];
                items[idx + 1] = swap;
              }
            }
          }
          return items;
        }
      `;

      const tokensA = service.normalizeAndTokenize(original);
      const tokensB = service.normalizeAndTokenize(copied);
      const sim = service.calculateSimilarity(tokensA, tokensB);

      expect(sim.similarityScore).toBeGreaterThanOrEqual(85.0);
    });

    it('should identify copied solutions even after renaming all variables and reordering functions (#1068)', () => {
      const original = `
        function gcd(a, b) {
          while (b !== 0) {
            let t = b;
            b = a % b;
            a = t;
          }
          return a;
        }

        function lcm(x, y) {
          return (x * y) / gcd(x, y);
        }
      `;

      const copiedAndReordered = `
        // Reordered helper functions, renamed parameters and variables
        function lcmSolution(valOne, valTwo) {
          return (valOne * valTwo) / helperGcd(valOne, valTwo);
        }

        function helperGcd(firstNum, secondNum) {
          while (secondNum !== 0) {
            let tempVar = secondNum;
            secondNum = firstNum % secondNum;
            firstNum = tempVar;
          }
          return firstNum;
        }
      `;

      const tokensA = service.normalizeAndTokenize(original);
      const tokensB = service.normalizeAndTokenize(copiedAndReordered);
      const sim = service.calculateSimilarity(tokensA, tokensB);

      expect(sim.similarityScore).toBeGreaterThanOrEqual(85.0);
    });

    it('should return low similarity for genuinely different algorithms', () => {
      const quickSort = `
        function quickSort(arr) {
          if (arr.length <= 1) return arr;
          const pivot = arr[arr.length - 1];
          const left = [];
          const right = [];
          for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] < pivot) left.push(arr[i]);
            else right.push(arr[i]);
          }
          return [...quickSort(left), pivot, ...quickSort(right)];
        }
      `;

      const fibonacci = `
        function fibonacci(n) {
          if (n <= 0) return 0;
          if (n === 1) return 1;
          let a = 0;
          let b = 1;
          for (let i = 2; i <= n; i++) {
            let c = a + b;
            a = b;
            b = c;
          }
          return b;
        }
      `;

      const tokensA = service.normalizeAndTokenize(quickSort);
      const tokensB = service.normalizeAndTokenize(fibonacci);
      const sim = service.calculateSimilarity(tokensA, tokensB);

      expect(sim.similarityScore).toBeLessThan(40.0);
    });
  });

  describe('Multi-Source Analysis & Elo Nullification Recommendation', () => {
    const solutionCode = `
      function twoSum(nums, target) {
        const map = new Map();
        for (let i = 0; i < nums.length; i++) {
          const complement = target - nums[i];
          if (map.has(complement)) {
            return [map.get(complement), i];
          }
          map.set(nums[i], i);
        }
        return [];
      }
    `;

    it('should flag match against opponent and recommend nullifying Elo', async () => {
      const opponentCode = `
        // Copied directly from opponent with minor variable renaming
        function findTwoIndices(values, goal) {
          const lookup = new Map();
          for (let idx = 0; idx < values.length; idx++) {
            const diff = goal - values[idx];
            if (lookup.has(diff)) {
              return [lookup.get(diff), idx];
            }
            lookup.set(values[idx], idx);
          }
          return [];
        }
      `;

      const report = await service.analyzeBattleSubmission({
        battleId: 'battle-101',
        userId: 'user-a',
        code: solutionCode,
        opponentCode,
        opponentUserId: 'user-b',
      });

      expect(report.flagged).toBe(true);
      expect(report.similarityScore).toBeGreaterThanOrEqual(85.0);
      expect(report.matchedSource).toBe('OPPONENT');
      expect(report.matchedUserId).toBe('user-b');
      expect(report.nullifyEloRecommended).toBe(true);
      expect(prismaService.battle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'battle-101' },
          data: expect.objectContaining({
            flaggedForPlagiarism: true,
          }),
        }),
      );
    });

    it('should detect match against historical submission database', async () => {
      prismaService.battleSubmission.findMany.mockResolvedValueOnce([
        {
          id: 'hist-sub-99',
          battleId: 'battle-older',
          userId: 'veteran-user',
          code: solutionCode,
          language: 'typescript',
          flagged: false,
        },
      ]);

      const candidateCode = `
        function twoSumRenamed(array, sumVal) {
          const cache = new Map();
          for (let index = 0; index < array.length; index++) {
            const remainder = sumVal - array[index];
            if (cache.has(remainder)) {
              return [cache.get(remainder), index];
            }
            cache.set(array[index], index);
          }
          return [];
        }
      `;

      const report = await service.analyzeBattleSubmission({
        battleId: 'battle-202',
        userId: 'newbie-user',
        code: candidateCode,
      });

      expect(report.flagged).toBe(true);
      expect(report.matchedSource).toBe('HISTORICAL');
      expect(report.matchedUserId).toBe('veteran-user');
      expect(report.matchedSubmissionId).toBe('hist-sub-99');
    });

    it('should not flag original clean solution below threshold', async () => {
      const independentCode = `
        function findPair(list, targetVal) {
          let l = 0;
          let r = list.length - 1;
          while (l < r) {
            const curr = list[l] + list[r];
            if (curr === targetVal) return [l, r];
            if (curr < targetVal) l++;
            else r--;
          }
          return [];
        }
      `;

      const report = await service.analyzeBattleSubmission({
        battleId: 'battle-303',
        userId: 'user-clean',
        code: independentCode,
        opponentCode: solutionCode,
      });

      expect(report.flagged).toBe(false);
      expect(report.nullifyEloRecommended).toBe(false);
      expect(report.similarityScore).toBeLessThan(85.0);
    });
  });

  describe('Line Diff Overlay', () => {
    it('should generate line-by-line diff overlays for administrative review', () => {
      const codeA = 'let a = 1;\nlet b = 2;\nreturn a + b;';
      const codeB = 'let a = 1;\nlet b = 99;\nreturn a + b;';

      const overlay = service.generateDiffOverlay(codeA, codeB);
      expect(overlay.length).toBe(3);
      expect(overlay[0].isMatched).toBe(true);
      expect(overlay[1].isMatched).toBe(false);
      expect(overlay[2].isMatched).toBe(true);
    });
  });
});
