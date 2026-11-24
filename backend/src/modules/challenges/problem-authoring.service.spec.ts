import { Test, TestingModule } from '@nestjs/testing';
import { ProblemAuthoringService } from './problem-authoring.service';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { DifficultyCalibratorService } from './difficulty-calibrator.service';
import { TestGeneratorService } from '../ai/test-generator.service';
import { PrismaService } from '../../prisma/prisma.service';
import { XpService } from '../xp/xp.service';
import { Difficulty } from '@prisma/client';

describe('ProblemAuthoringService & Property-Based Fuzzing', () => {
  let service: ProblemAuthoringService;
  let controller: ChallengesController;

  const mockPrismaService = {
    challenge: {
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: 'mock-challenge-uuid-1234',
          ...args.data,
          createdAt: new Date(),
        }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockXpService = {
    addXp: jest.fn().mockResolvedValue({ success: true, newTotal: 150 }),
  };

  const mockChallengesService = {
    getActiveChallenges: jest.fn().mockResolvedValue([]),
    getUserChallenges: jest.fn().mockResolvedValue([]),
  };

  const mockDifficultyCalibrator = {
    getDifficultyMetrics: jest.fn().mockResolvedValue({}),
    recordSubmissionAndCalibrate: jest.fn().mockResolvedValue({}),
  };

  const mockTestGenerator = {
    synthesizeAndVerifyTestSuite: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChallengesController],
      providers: [
        ProblemAuthoringService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: XpService, useValue: mockXpService },
        { provide: ChallengesService, useValue: mockChallengesService },
        { provide: DifficultyCalibratorService, useValue: mockDifficultyCalibrator },
        { provide: TestGeneratorService, useValue: mockTestGenerator },
      ],
    }).compile();

    service = module.get<ProblemAuthoringService>(ProblemAuthoringService);
    controller = module.get<ChallengesController>(ChallengesController);
  });

  describe('1. 1,000-Case Property-Based Fuzzing Pipeline', () => {
    it('should generate 1,000 edge-case inputs covering empty strings, negative numbers, extreme arrays, and unicode', () => {
      const cases = service.generateEdgeCases(undefined, undefined, 1000);

      expect(cases.length).toBe(1000);

      const categories = new Set(cases.map((c) => c.category));
      expect(categories.has('EMPTY_STRING')).toBe(true);
      expect(categories.has('NEGATIVE_NUMBER')).toBe(true);
      expect(categories.has('EXTREME_ARRAY')).toBe(true);
      expect(categories.has('MAX_INT')).toBe(true);
      expect(categories.has('UNICODE')).toBe(true);
      expect(categories.has('RANDOM_FUZZ')).toBe(true);
    });

    it('should successfully fuzz and pass a robust reference solution across 1,000 inputs', async () => {
      // Robust reference solution handling arrays, numbers, strings, and empty collections
      const robustSolution = `
        function solve(input) {
          if (Array.isArray(input)) {
            return input.length === 0 ? 0 : input.reduce((acc, curr) => acc + (typeof curr === 'number' ? curr : 0), 0);
          }
          if (typeof input === 'string') {
            return input.trim().length;
          }
          if (typeof input === 'number') {
            return input < 0 ? Math.abs(input) : input * 2;
          }
          return 0;
        }
      `;

      const result = await service.executePropertyFuzzing(robustSolution, undefined, undefined, 1000);

      expect(result.totalCasesExecuted).toBe(1000);
      expect(result.passedCases).toBe(1000);
      expect(result.failedCases).toBe(0);
      expect(result.timedOutCases).toBe(0);
      expect(result.firstFailure).toBeUndefined();
      expect(result.edgeCaseCoverage.emptyStringsTested).toBe(true);
      expect(result.edgeCaseCoverage.negativeNumbersTested).toBe(true);
      expect(result.edgeCaseCoverage.extremeArraysTested).toBe(true);
      expect(result.edgeCaseCoverage.boundaryNumbersTested).toBe(true);
      expect(result.edgeCaseCoverage.unicodeTested).toBe(true);
    });
  });

  describe('2. Buggy Reference Code & Error Detection', () => {
    it('should detect and reject buggy reference solution that crashes on negative numbers', async () => {
      const buggySolution = `
        function solve(input) {
          if (typeof input === 'number' && input < 0) {
            throw new Error("Negative numbers strictly forbidden!");
          }
          return input;
        }
      `;

      const result = await service.executePropertyFuzzing(buggySolution, undefined, undefined, 200);

      expect(result.failedCases).toBeGreaterThan(0);
      expect(result.firstFailure).toBeDefined();
      expect(result.firstFailure?.category).toBe('NEGATIVE_NUMBER');
      expect(result.firstFailure?.error).toContain('Negative numbers strictly forbidden');
    });

    it('should detect and reject buggy reference solution that fails on empty arrays', async () => {
      const buggySolution = `
        function solve(arr) {
          if (Array.isArray(arr) && arr.length === 0) {
            throw new Error("Empty array causes crash");
          }
          return arr;
        }
      `;

      const result = await service.executePropertyFuzzing(buggySolution, undefined, undefined, 100);

      expect(result.failedCases).toBeGreaterThan(0);
      expect(result.firstFailure?.error).toContain('Empty array causes crash');
    });

    it('should report syntax errors gracefully without crashing the service', async () => {
      const invalidCode = `function solve(arr) { return arr.; // syntax error `;

      const result = await service.executePropertyFuzzing(invalidCode, undefined, undefined, 100);

      expect(result.failedCases).toBe(1);
      expect(result.firstFailure?.error).toContain('Syntax Error');
    });
  });

  describe('3. CPU Timeout & Infinite Loop Prevention (1,000ms guardrail)', () => {
    it('should catch infinite loops and enforce the 1,000ms CPU execution limit', async () => {
      const infiniteLoopCode = `
        function solve(arr) {
          while (true) {
            // Infinite loop simulating non-terminating community code
          }
        }
      `;

      const result = await service.executePropertyFuzzing(infiniteLoopCode, undefined, undefined, 10);

      expect(result.failedCases).toBeGreaterThan(0);
      expect(result.timedOutCases).toBeGreaterThan(0);
      expect(result.firstFailure?.error).toContain('timed out');
    }, 15000);
  });

  describe('4. Problem Quality Scoring Engine', () => {
    it('should calculate high quality score for complete description with constraints and examples', () => {
      const submission = {
        title: 'Two Sum Variant with Negative Numbers',
        description: `
          # Problem Description
          Given an array of integers and a target sum, find two distinct indices whose sum equals target.
          
          ## Constraints
          - -10^9 <= nums[i] <= 10^9
          - 2 <= nums.length <= 10^5
          - Exactly one valid answer exists.
          
          ## Example 1
          \`\`\`typescript
          Input: nums = [2, 7, 11, 15], target = 9
          Output: [0, 1]
          \`\`\`
        `,
        referenceSolution: 'function solve(nums, target) { return [0, 1]; }',
        authorId: 'author-user-42',
      };

      const fuzzResult = {
        totalCasesExecuted: 1000,
        passedCases: 1000,
        failedCases: 0,
        timedOutCases: 0,
        memoryExceededCases: 0,
        executionTimeMs: 45,
        edgeCaseCoverage: {
          emptyStringsTested: true,
          negativeNumbersTested: true,
          extremeArraysTested: true,
          boundaryNumbersTested: true,
          unicodeTested: true,
        },
      };

      const score = service.scoreProblemQuality(submission, fuzzResult);

      expect(score.overallScore).toBeGreaterThanOrEqual(75);
      expect(score.testCoveragePercentage).toBe(100);
      expect(score.descriptionClarityScore).toBeGreaterThanOrEqual(70);
      expect(score.problemNoveltyIndex).toBeGreaterThanOrEqual(50);
      expect(score.isApproved).toBe(true);
      expect(score.rejectionReasons.length).toBe(0);
    });

    it('should reject submission with poor description clarity and missing constraints', () => {
      const poorSubmission = {
        title: 'Add numbers',
        description: 'Just add numbers please.',
        referenceSolution: 'function solve(a, b) { return a + b; }',
        authorId: 'author-user-42',
      };

      const fuzzResult = {
        totalCasesExecuted: 1000,
        passedCases: 1000,
        failedCases: 0,
        timedOutCases: 0,
        memoryExceededCases: 0,
        executionTimeMs: 40,
        edgeCaseCoverage: {
          emptyStringsTested: true,
          negativeNumbersTested: true,
          extremeArraysTested: true,
          boundaryNumbersTested: true,
          unicodeTested: true,
        },
      };

      const score = service.scoreProblemQuality(poorSubmission, fuzzResult);

      expect(score.isApproved).toBe(false);
      expect(score.rejectionReasons.some((r) => r.includes('Description clarity'))).toBe(true);
    });
  });

  describe('5. Auto-Publishing to Challenge Catalog', () => {
    it('should approve and auto-publish a valid community problem to the catalog', async () => {
      const submission = {
        title: 'Reverse Words in String',
        description: `
          # Problem Description
          Given an input string s, reverse the order of the words.
          
          ## Constraints
          - 1 <= s.length <= 10^4
          - s contains English letters, digits, and spaces.
          
          ## Example 1
          Input: "the sky is blue"
          Output: "blue is sky the"
        `,
        referenceSolution: `
          function solve(s) {
            if (typeof s !== 'string') return "";
            return s.trim().split(/\\s+/).reverse().join(" ");
          }
        `,
        authorId: 'author-dev-99',
        difficulty: Difficulty.MEDIUM,
      };

      const record = await service.submitProblem(submission);

      expect(record.status).toBe('PUBLISHED');
      expect(record.publishedChallengeId).toBeDefined();
      expect(record.qualityScore.isApproved).toBe(true);
      expect(mockPrismaService.challenge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Reverse Words in String',
            difficulty: Difficulty.MEDIUM,
          }),
        }),
      );
    });

    it('should reject and NOT publish when reference solution fails fuzzing', async () => {
      const failingSubmission = {
        title: 'Divisible By Three Checker',
        description: `
          # Problem Description
          Check if a number is divisible by 3.
          
          ## Constraints
          - -10^6 <= n <= 10^6
          
          ## Example 1
          Input: 9 -> Output: true
        `,
        // Buggy: throws error on negative numbers
        referenceSolution: `
          function solve(n) {
            if (n < 0) throw new Error("Negative numbers not supported");
            return n % 3 === 0;
          }
        `,
        authorId: 'author-dev-99',
      };

      const record = await service.submitProblem(failingSubmission);

      expect(record.status).toBe('REJECTED');
      expect(record.qualityScore.isApproved).toBe(false);
      expect(record.publishedChallengeId).toBeUndefined();
      expect(record.qualityScore.rejectionReasons.length).toBeGreaterThan(0);
    });
  });

  describe('6. Author XP Royalties Distribution', () => {
    it('should award XP royalty to problem author when problem is used in official battle', async () => {
      // 1. Submit and publish problem
      const record = await service.submitProblem({
        title: 'Matrix Diagonal Sum',
        description: `
          # Problem Description
          Given a square matrix mat, return the sum of the matrix diagonals.
          
          ## Constraints
          - 1 <= mat.length <= 100
          
          ## Example 1
          Input: [[1, 2], [3, 4]] -> Output: 10
        `,
        referenceSolution: `
          function solve(mat) {
            if (!Array.isArray(mat)) return 0;
            return mat.reduce((acc, row) => acc + (Array.isArray(row) ? row.length : 0), 0);
          }
        `,
        authorId: 'author-master-007',
      });

      // 2. Award author royalty
      const royalty = await service.awardAuthorRoyalty(record.id, 'battle-match-999', 50);

      expect(royalty.success).toBe(true);
      expect(royalty.authorId).toBe('author-master-007');
      expect(royalty.amount).toBe(50);
      expect(royalty.totalRoyaltiesEarned).toBe(50);

      expect(mockXpService.addXp).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'author-master-007',
          amount: 50,
          source: 'CHALLENGE_ROYALTY',
        }),
      );

      // Verify problem record metrics incremented
      const updated = service.getAuthoredProblem(record.id);
      expect(updated?.usageCount).toBe(1);
      expect(updated?.royaltiesAwarded).toBe(50);
    });

    it('should allow awardAuthorRoyalty lookup via publishedChallengeId', async () => {
      const record = await service.submitProblem({
        title: 'Count Vowels In String',
        description: `
          # Problem Description
          Given an input string s, count all vowels (a, e, i, o, u) case-insensitively.
          Ensure that special characters and non-vowels are ignored properly.
          
          ## Constraints
          - 0 <= s.length <= 10000
          - String may contain spaces, punctuation, and unicode characters.
          
          ## Example 1
          Input: "code" -> Output: 2
          
          ## Example 2
          Input: "AEIOU" -> Output: 5
        `,
        referenceSolution: `
          function solve(s) {
            if (typeof s !== 'string') return 0;
            return (s.match(/[aeiou]/gi) || []).length;
          }
        `,
        authorId: 'author-user-888',
      });

      expect(record.publishedChallengeId).toBeDefined();

      const royalty = await service.awardAuthorRoyalty(
        record.publishedChallengeId!,
        'battle-session-456',
        75,
      );

      expect(royalty.success).toBe(true);
      expect(royalty.amount).toBe(75);
    });
  });

  describe('7. Controller Endpoints Integration', () => {
    it('should preview fuzzing via POST author/fuzz-preview', async () => {
      const preview = await controller.previewProblemFuzzing({
        referenceSolution: 'function solve(x) { return typeof x === "number" ? x * 2 : 0; }',
        count: 50,
      });

      expect(preview.totalCasesExecuted).toBe(50);
      expect(preview.passedCases).toBe(50);
      expect(preview.failedCases).toBe(0);
    });

    it('should submit authored problem via POST author/submit and return record', async () => {
      const result = await controller.submitAuthoredProblem(
        { user: { id: 'req-author-id-123' } },
        {
          title: 'Valid Palindrome Checker',
          description: `
            # Problem Description
            Check if string is palindrome ignoring cases.
            ## Constraints
            - 1 <= s.length <= 1000
            ## Example
            "aba" -> true
          `,
          referenceSolution: `
            function solve(s) {
              if (typeof s !== 'string') return true;
              const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
              return clean === clean.split('').reverse().join('');
            }
          `,
          authorId: 'req-author-id-123',
        },
      );

      expect(result.id).toBeDefined();
      expect(result.status).toBe('PUBLISHED');
      expect(result.authorId).toBe('req-author-id-123');
    });

    it('should list authored problems via GET author/problems', async () => {
      const list = await controller.listAuthoredProblems();
      expect(Array.isArray(list)).toBe(true);
    });
  });
});

