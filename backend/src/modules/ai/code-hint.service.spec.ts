import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CodeHintService } from './code-hint.service';

describe('CodeHintService - Progressive AI Code Hint Engine with Time-Decay XP Penalty (#367)', () => {
  let service: CodeHintService;
  let prismaService: any;

  const mockBattle = {
    id: 'battle-uuid-101',
    challengerId: 'player-alice',
    opponentId: 'player-bob',
    category: 'Algorithms',
    status: 'ACTIVE',
    hintHistory: [],
    challengerXpPenalty: 0,
    opponentXpPenalty: 0,
  };

  beforeEach(async () => {
    prismaService = {
      battle: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockBattle.id) {
            return Promise.resolve({ ...mockBattle });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          return Promise.resolve({ ...mockBattle, ...data });
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeHintService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<CodeHintService>(CodeHintService);
    service.resetCooldowns();
  });

  describe('Progressive Hint Tiers', () => {
    it('should generate Tier 1 Conceptual Direction with 10% base penalty and no code blocks', async () => {
      const response = await service.requestHint({
        battleId: mockBattle.id,
        userId: 'player-alice',
        tier: 1,
        problemTitle: 'Two Sum II',
        problemDescription: 'Find two numbers that add up to target in sorted array',
        currentCode: 'function twoSum(nums, target) {}',
        elapsedSeconds: 60,
        totalMatchSeconds: 1200,
      });

      expect(response.tier).toBe(1);
      expect(response.tierName).toBe('Conceptual Direction');
      expect(response.basePenaltyPercent).toBe(0.1);
      expect(response.hintMarkdown).toContain('Tier 1: Conceptual Direction');
      expect(response.hintMarkdown).toContain('Two Pointers');
      // Must not leak code blocks
      expect(response.hintMarkdown).not.toContain('```javascript');
      expect(response.hintMarkdown).not.toContain('```python');
      expect(response.guardrailStatus).toBe('PASS');
    });

    it('should generate Tier 2 Pseudocode Scaffold with 25% base penalty', async () => {
      const response = await service.requestHint({
        battleId: mockBattle.id,
        userId: 'player-alice',
        tier: 2,
        problemTitle: 'Sliding Window Maximum',
        problemDescription: 'Find max in every sliding window of size k',
        currentCode: 'function maxSlidingWindow() {}',
        elapsedSeconds: 120,
        totalMatchSeconds: 1200,
      });

      expect(response.tier).toBe(2);
      expect(response.tierName).toBe('Pseudocode Scaffold');
      expect(response.basePenaltyPercent).toBe(0.25);
      expect(response.hintMarkdown).toContain('Tier 2: Pseudocode Scaffold');
      expect(response.hintMarkdown).toContain('ALGORITHM Scaffold');
      expect(response.hintMarkdown).toContain('WHILE');
      expect(response.guardrailStatus).toBe('PASS');
    });

    it('should generate Tier 3 Specific Edge-Case Advice with 40% base penalty', async () => {
      const response = await service.requestHint({
        battleId: mockBattle.id,
        userId: 'player-alice',
        tier: 3,
        problemTitle: 'Binary Search Edge Cases',
        problemDescription: 'Find target element in sorted array',
        currentCode: 'function search(nums) { return -1; }',
        elapsedSeconds: 300,
        totalMatchSeconds: 1200,
      });

      expect(response.tier).toBe(3);
      expect(response.tierName).toBe('Specific Edge-Case Advice');
      expect(response.basePenaltyPercent).toBe(0.4);
      expect(response.hintMarkdown).toContain('Tier 3: Specific Edge-Case Advice');
      expect(response.hintMarkdown).toContain('Boundary Off-By-One');
      expect(response.hintMarkdown).toContain('Empty / Minimal Input');
      expect(response.guardrailStatus).toBe('PASS');
    });

    it('should reject invalid hint tiers', async () => {
      await expect(
        service.requestHint({
          battleId: mockBattle.id,
          userId: 'player-alice',
          tier: 4 as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Time-Decay XP Penalty Calculation', () => {
    it('should apply full base penalty early in the match and decayed penalty late in the match', () => {
      // Early in match: elapsed = 0s
      const early = service.calculatePenalty(1, 0, 1200);
      expect(early.basePercent).toBe(0.1);
      expect(early.timeDecayedPercent).toBe(0.1); // decay multiplier = 1.0

      // Late in match: elapsed = 1200s (at duration end)
      const late = service.calculatePenalty(1, 1200, 1200);
      expect(late.basePercent).toBe(0.1);
      expect(late.timeDecayedPercent).toBe(0.06); // decay multiplier = 0.6 (60% floor)
      expect(late.estimatedXpDeduction).toBe(9); // 150 * 0.06 = 9 XP
    });

    it('should calculate net XP accurately across multiple hint records with cap', () => {
      const hints = [
        {
          userId: 'player-alice',
          tier: 1,
          requestedAt: new Date().toISOString(),
          penaltyPercentage: 0.1,
          hintSummary: 'Tier 1',
        },
        {
          userId: 'player-alice',
          tier: 2,
          requestedAt: new Date().toISOString(),
          penaltyPercentage: 0.2,
          hintSummary: 'Tier 2',
        },
      ];

      const netResult = service.calculateNetXp(150, hints);
      expect(netResult.totalPenaltyPercent).toBe(0.3);
      expect(netResult.totalDeduction).toBe(45); // 150 * 0.3 = 45 XP deduction
      expect(netResult.netXp).toBe(105); // 150 - 45 = 105 XP
    });

    it('should cap cumulative XP penalty at 75% maximum', () => {
      const heavyHints = [
        { userId: 'u1', tier: 3, requestedAt: '', penaltyPercentage: 0.4, hintSummary: '' },
        { userId: 'u1', tier: 3, requestedAt: '', penaltyPercentage: 0.4, hintSummary: '' },
      ];

      const result = service.calculateNetXp(150, heavyHints);
      expect(result.totalPenaltyPercent).toBe(0.75);
      expect(result.netXp).toBe(38); // 150 - 112 = 38
    });
  });

  describe('Rate Limiting (2 Minutes Cooldown)', () => {
    it('should throw BadRequestException when requesting hints within 2 minutes', async () => {
      // First request succeeds
      await service.requestHint({
        battleId: mockBattle.id,
        userId: 'player-bob',
        tier: 1,
      });

      // Immediate second request within 120 seconds must fail
      await expect(
        service.requestHint({
          battleId: mockBattle.id,
          userId: 'player-bob',
          tier: 2,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.requestHint({
          battleId: mockBattle.id,
          userId: 'player-bob',
          tier: 2,
        }),
      ).rejects.toThrow(/Hint rate-limit active/);
    });

    it('should allow different players in the same battle to request hints independently', async () => {
      await service.requestHint({
        battleId: mockBattle.id,
        userId: 'player-alice',
        tier: 1,
      });

      // player-bob can still request because rate limit is per (battleId, userId)
      const bobHint = await service.requestHint({
        battleId: mockBattle.id,
        userId: 'player-bob',
        tier: 1,
      });

      expect(bobHint.userId).toBe('player-bob');
    });
  });

  describe('Solution Leak Prevention & Guardrails', () => {
    it('should detect and filter complete function solutions from generated text', () => {
      const leakedSolution = `
        Here is the conceptual idea.
        function solveTwoSum(nums, target) {
          const map = new Map();
          for (let i = 0; i < nums.length; i++) {
            const diff = target - nums[i];
            if (map.has(diff)) return [map.get(diff), i];
            map.set(nums[i], i);
          }
          return [];
        }
      `;

      const result = service.sanitizeHintOutput(leakedSolution, 2);
      expect(result.guardrailStatus).toBe('FILTERED');
      expect(result.cleanedMarkdown).toContain('SOLUTION CODE BLOCKED BY AI GUARDRAILS');
      expect(result.cleanedMarkdown).not.toContain('function solveTwoSum');
    });

    it('should block leaked Rust and Go code solutions (#1073)', () => {
      const leakedRust = `
        pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
          vec![0, 1]
        }
      `;
      const rustResult = service.sanitizeHintOutput(leakedRust, 2);
      expect(rustResult.guardrailStatus).toBe('FILTERED');
      expect(rustResult.cleanedMarkdown).toContain('SOLUTION CODE BLOCKED BY AI GUARDRAILS');

      const leakedGo = `
        func TwoSum(nums []int, target int) []int {
          return []int{0, 1}
        }
      `;
      const goResult = service.sanitizeHintOutput(leakedGo, 2);
      expect(goResult.guardrailStatus).toBe('FILTERED');
      expect(goResult.cleanedMarkdown).toContain('SOLUTION CODE BLOCKED BY AI GUARDRAILS');
    });

    it('should calculate time-decayed ELO penalty alongside XP (#1073)', () => {
      const penaltyEarly = service.calculatePenalty(1, 0, 1200);
      expect(penaltyEarly.estimatedEloPenalty).toBeGreaterThan(0);

      const penaltyLate = service.calculatePenalty(1, 1200, 1200);
      expect(penaltyLate.estimatedEloPenalty).toBeLessThanOrEqual(penaltyEarly.estimatedEloPenalty);
    });

    it('should pass clean markdown without filtering', () => {
      const cleanHint = '### Strategy: Use two pointers at ends of sorted array.';
      const result = service.sanitizeHintOutput(cleanHint, 1);
      expect(result.guardrailStatus).toBe('PASS');
      expect(result.cleanedMarkdown).toBe(cleanHint);
    });
  });

  describe('Match Conclusion XP Adjustment', () => {
    it('should adjust winner XP atomically based on accumulated battle hint penalty', async () => {
      prismaService.battle.findUnique.mockResolvedValueOnce({
        ...mockBattle,
        winnerId: 'player-alice',
        challengerXpPenalty: 0.2, // 20% penalty
        hintHistory: [
          { userId: 'player-alice', tier: 1, requestedAt: '', penaltyPercentage: 0.2, hintSummary: '' },
        ],
      });

      const outcome = await service.applyHintPenaltiesAtMatchFinish(
        mockBattle.id,
        'player-alice',
        150,
      );

      expect(outcome.penaltyApplied).toBe(30); // 150 * 0.2 = 30 XP
      expect(outcome.finalWinnerXp).toBe(120); // 150 - 30 = 120 XP
      expect(outcome.hintsUsedCount).toBe(1);
    });
  });
});

