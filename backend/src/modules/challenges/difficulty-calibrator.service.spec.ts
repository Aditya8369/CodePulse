import { Difficulty } from '@prisma/client';
import {
  DifficultyCalibratorService,
  Glicko2State,
  PlayerMatch,
} from './difficulty-calibrator.service';
import { NotFoundException } from '@nestjs/common';

describe('DifficultyCalibratorService (Dynamic Glicko-2 Problem Difficulty & Pass-Rate Calibrator)', () => {
  let service: DifficultyCalibratorService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      challenge: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      battleRating: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new DifficultyCalibratorService(mockPrisma);
  });

  describe('Glicko-2 Scale Conversions & Mathematics', () => {
    it('converts between standard rating (1500) and Glicko-2 mu (0)', () => {
      expect(service.toGlicko2Rating(1500)).toBeCloseTo(0.0, 5);
      expect(service.toStandardRating(0.0)).toBeCloseTo(1500.0, 5);

      const r = 1850;
      const mu = service.toGlicko2Rating(r);
      expect(service.toStandardRating(mu)).toBeCloseTo(r, 5);
    });

    it('converts between standard RD (350) and Glicko-2 phi', () => {
      const rd = 350;
      const phi = service.toGlicko2Rd(rd);
      expect(phi).toBeCloseTo(350 / 173.7178, 5);
      expect(service.toStandardRd(phi)).toBeCloseTo(rd, 5);
    });

    it('calculates g(phi) discount function properly', () => {
      // When RD is 0 (phi = 0), g(0) = 1
      expect(service.g(0.0)).toBe(1.0);

      // Higher phi reduces g(phi) below 1.0
      const gPhi = service.g(service.toGlicko2Rd(350));
      expect(gPhi).toBeLessThan(1.0);
      expect(gPhi).toBeGreaterThan(0.5);
    });

    it('computes expected outcome E(mu, muJ, phiJ)', () => {
      const mu = service.toGlicko2Rating(1500);
      const muJ = service.toGlicko2Rating(1500);
      const phiJ = service.toGlicko2Rd(200);

      // Equal ratings yield a 50% win probability
      expect(service.expectedOutcome(mu, muJ, phiJ)).toBeCloseTo(0.5, 4);

      // If Problem (1800) is harder than Player (1200), Problem's win probability is > 50%
      const hardMu = service.toGlicko2Rating(1800);
      const weakMu = service.toGlicko2Rating(1200);
      expect(service.expectedOutcome(hardMu, weakMu, phiJ)).toBeGreaterThan(0.7);

      // If Problem (1100) is easier than Player (1900), Problem's win probability is < 50%
      const easyMu = service.toGlicko2Rating(1100);
      const strongMu = service.toGlicko2Rating(1900);
      expect(service.expectedOutcome(easyMu, strongMu, phiJ)).toBeLessThan(0.3);
    });
  });

  describe('Dynamic Difficulty Calibration Behavior', () => {
    it('decreases problem difficulty rating when a low-ranked player solves it', () => {
      // Baseline problem rated 1500 with RD 200
      const problem: Glicko2State = {
        rating: 1500.0,
        rd: 200.0,
        volatility: 0.06,
      };

      // Low-ranked player (Elo 1000) passes/solves the problem
      const matches: PlayerMatch[] = [
        {
          playerId: 'low-rank-user',
          playerRating: 1000.0,
          playerRd: 150.0,
          passed: true, // Player solved => Problem lost
        },
      ];

      const updated = service.calculateGlicko2Update(problem, matches);

      // Problem difficulty must decrease because an unexpectedly weak player solved it
      expect(updated.rating).toBeLessThan(problem.rating);
      // Rating deviation must decrease as new evidence is incorporated
      expect(updated.rd).toBeLessThan(problem.rd);
    });

    it('increases problem difficulty rating when high-ranked players fail it', () => {
      const problem: Glicko2State = {
        rating: 1500.0,
        rd: 200.0,
        volatility: 0.06,
      };

      // High-ranked player (Elo 2100 Grandmaster) fails to solve the problem
      const matches: PlayerMatch[] = [
        {
          playerId: 'grandmaster-user',
          playerRating: 2100.0,
          playerRd: 100.0,
          passed: false, // Player failed => Problem won
        },
      ];

      const updated = service.calculateGlicko2Update(problem, matches);

      // Problem difficulty must increase because a top player failed it
      expect(updated.rating).toBeGreaterThan(problem.rating);
      expect(updated.rd).toBeLessThan(problem.rd);
    });

    it('stabilizes problem rating deviation (RD) downward over multiple matches', () => {
      let state: Glicko2State = {
        rating: 1500.0,
        rd: 350.0, // High initial uncertainty
        volatility: 0.06,
      };

      const initialRd = state.rd;

      // Simulate 5 matches against varying opponents
      const batch: PlayerMatch[] = [
        { playerId: 'p1', playerRating: 1400, passed: true },
        { playerId: 'p2', playerRating: 1550, passed: false },
        { playerId: 'p3', playerRating: 1600, passed: false },
        { playerId: 'p4', playerRating: 1450, passed: true },
        { playerId: 'p5', playerRating: 1500, passed: true },
      ];

      state = service.calculateGlicko2Update(state, batch);

      // Uncertainty should drop substantially after 5 matches
      expect(state.rd).toBeLessThan(initialRd);
      expect(state.rd).toBeLessThan(250.0);
    });

    it('respects minimum RD floor (MIN_RD = 50) to prevent rating freeze', () => {
      let state: Glicko2State = {
        rating: 1600.0,
        rd: 55.0,
        volatility: 0.06,
      };

      // Feed 20 matches to drive RD down
      const largeBatch: PlayerMatch[] = Array.from({ length: 20 }, (_, i) => ({
        playerId: `p-${i}`,
        playerRating: 1600,
        playerRd: 100,
        passed: i % 2 === 0,
      }));

      state = service.calculateGlicko2Update(state, largeBatch);

      expect(state.rd).toBeGreaterThanOrEqual(DifficultyCalibratorService.MIN_RD);
    });

    it('handles inactivity rating period (empty matches) with slight RD increase', () => {
      const state: Glicko2State = {
        rating: 1650.0,
        rd: 120.0,
        volatility: 0.06,
      };

      const updated = service.calculateGlicko2Update(state, []);

      // Rating remains identical
      expect(updated.rating).toBe(state.rating);
      // RD expands slightly due to lack of recent data
      expect(updated.rd).toBeGreaterThan(state.rd);
    });
  });

  describe('Objective Difficulty Label Calibration', () => {
    it('maps ratings < 1200 to Easy', () => {
      const res1 = service.getDifficultyFromRating(950);
      expect(res1.difficulty).toBe(Difficulty.EASY);
      expect(res1.label).toBe('Easy');

      const res2 = service.getDifficultyFromRating(1199.9);
      expect(res2.difficulty).toBe(Difficulty.EASY);
    });

    it('maps ratings 1200 - 1700 to Medium', () => {
      const res1 = service.getDifficultyFromRating(1200);
      expect(res1.difficulty).toBe(Difficulty.MEDIUM);
      expect(res1.label).toBe('Medium');

      const res2 = service.getDifficultyFromRating(1500);
      expect(res2.difficulty).toBe(Difficulty.MEDIUM);

      const res3 = service.getDifficultyFromRating(1699.9);
      expect(res3.difficulty).toBe(Difficulty.MEDIUM);
    });

    it('maps ratings 1700 - 2200 to Hard', () => {
      const res1 = service.getDifficultyFromRating(1700);
      expect(res1.difficulty).toBe(Difficulty.HARD);
      expect(res1.label).toBe('Hard');

      const res2 = service.getDifficultyFromRating(2199.9);
      expect(res2.difficulty).toBe(Difficulty.HARD);
    });

    it('maps ratings >= 2200 to Grandmaster Challenge (LEGENDARY)', () => {
      const res1 = service.getDifficultyFromRating(2200);
      expect(res1.difficulty).toBe(Difficulty.LEGENDARY);
      expect(res1.label).toBe('Grandmaster Challenge');

      const res2 = service.getDifficultyFromRating(2650);
      expect(res2.difficulty).toBe(Difficulty.LEGENDARY);
      expect(res2.label).toBe('Grandmaster Challenge');
    });
  });

  describe('Database Integration & Workflows', () => {
    it('records a submission, recalibrates challenge rating, and updates pass rate', async () => {
      const mockChallenge = {
        id: 'chal-101',
        title: 'Two Sum Variant',
        difficultyRating: 1500.0,
        ratingDeviation: 350.0,
        volatility: 0.06,
        difficulty: Difficulty.MEDIUM,
        passRate: 0.0,
        totalAttempts: 0,
        solvedAttempts: 0,
      };

      mockPrisma.challenge.findUnique.mockResolvedValue(mockChallenge);
      mockPrisma.battleRating.findUnique.mockResolvedValue({ elo: 1300 });
      mockPrisma.challenge.update.mockResolvedValue({});

      const result = await service.recordSubmissionAndCalibrate({
        challengeId: 'chal-101',
        userId: 'user-abc',
        passed: true,
      });

      expect(mockPrisma.challenge.findUnique).toHaveBeenCalledWith({
        where: { id: 'chal-101' },
      });
      expect(mockPrisma.challenge.update).toHaveBeenCalled();

      // Verified updated stats
      expect(result.totalAttempts).toBe(1);
      expect(result.solvedAttempts).toBe(1);
      expect(result.passRate).toBe(1.0);
      expect(result.rating).toBeLessThan(1500); // 1300 solved a 1500 problem -> rating drops
    });

    it('throws NotFoundException when challenge does not exist', async () => {
      mockPrisma.challenge.findUnique.mockResolvedValue(null);

      await expect(
        service.recordSubmissionAndCalibrate({
          challengeId: 'non-existent',
          userId: 'u1',
          passed: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('executes runNightlyCalibration across challenges and updates pass rates', async () => {
      const mockChallenges = [
        {
          id: 'c1',
          title: 'Graph Traversal',
          difficultyRating: 1500.0,
          ratingDeviation: 350.0,
          volatility: 0.06,
          difficulty: Difficulty.MEDIUM,
          submissions: [
            { userId: 'u1', passed: true, createdAt: new Date() },
            { userId: 'u2', passed: false, createdAt: new Date() },
          ],
          users: [
            { userId: 'u3', isCompleted: true, completedAt: new Date() },
          ],
        },
        {
          id: 'c2',
          title: 'Simple Array Sum',
          difficultyRating: 1250.0,
          ratingDeviation: 200.0,
          volatility: 0.06,
          difficulty: Difficulty.MEDIUM,
          submissions: [],
          users: [],
        },
      ];

      mockPrisma.challenge.findMany.mockResolvedValue(mockChallenges);
      mockPrisma.battleRating.findMany.mockResolvedValue([
        { userId: 'u1', elo: 1400 },
        { userId: 'u2', elo: 1600 },
        { userId: 'u3', elo: 1500 },
      ]);
      mockPrisma.challenge.update.mockResolvedValue({});

      const summary = await service.runNightlyCalibration();

      expect(summary.totalChallenges).toBe(2);
      expect(summary.calibratedCount).toBe(1); // c1 had matches, c2 had decay step
      expect(summary.results[0].challengeId).toBe('c1');
      expect(summary.results[0].totalAttempts).toBe(3); // u1, u2, u3
      expect(summary.results[0].passRate).toBeCloseTo(2 / 3, 2);
    });

    it('retrieves detailed challenge difficulty metrics', async () => {
      mockPrisma.challenge.findUnique.mockResolvedValue({
        id: 'c-metrics',
        title: 'Binary Tree Inversion',
        difficultyRating: 1150.0,
        ratingDeviation: 120.0,
        volatility: 0.059,
        difficulty: Difficulty.EASY,
        passRate: 0.824,
        totalAttempts: 100,
        solvedAttempts: 82,
        lastCalibratedAt: new Date('2026-11-23T00:00:00Z'),
      });

      const metrics = await service.getDifficultyMetrics('c-metrics');

      expect(metrics.challengeId).toBe('c-metrics');
      expect(metrics.difficultyLabel).toBe('Easy');
      expect(metrics.difficulty).toBe(Difficulty.EASY);
      expect(metrics.passRatePercent).toBe('82.4%');
      expect(metrics.totalAttempts).toBe(100);
      expect(metrics.solvedAttempts).toBe(82);
    });
  });
});
