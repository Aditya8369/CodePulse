import { Test, TestingModule } from '@nestjs/testing';
import { EvaluatorService, BattlePerformanceMetrics } from './evaluator.service';
import { BattlesGateway } from './battles.gateway';
import { MetricsService } from '../metrics/metrics.service';

describe('EvaluatorService & Sudden Death Tiebreaker Gateway Suite (#318)', () => {
  let evaluatorService: EvaluatorService;
  let gateway: BattlesGateway;
  let mockServer: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluatorService,
        BattlesGateway,
        {
          provide: MetricsService,
          useValue: {
            socketConnected: jest.fn(),
            socketDisconnected: jest.fn(),
          },
        },
      ],
    }).compile();

    evaluatorService = module.get<EvaluatorService>(EvaluatorService);
    gateway = module.get<BattlesGateway>(BattlesGateway);

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    gateway.server = mockServer;
  });

  afterEach(() => {
    evaluatorService.clear();
    gateway.onModuleDestroy();
  });

  describe('Composite Tiebreaker Score Engine', () => {
    it('calculates composite tiebreaker score accurately according to specification', () => {
      const metrics: BattlePerformanceMetrics = {
        userId: 'dev-1',
        testsPassed: 5,
        totalTests: 5,
        executionTimeMs: 200,
        memoryKb: 1024,
        codeLength: 300,
      };

      const breakdown = evaluatorService.calculateCompositeScore(metrics);

      // (5 * 1000) = 5000
      expect(breakdown.testsPassedScore).toBe(5000);
      // Speed bonus: 500 - (200 * 0.5) = 400
      expect(breakdown.executionSpeedBonus).toBe(400);
      // Memory penalty: 1024 * 0.1 = 102.4 -> 102
      expect(breakdown.memoryPenalty).toBe(102);
      // Code length penalty: 300 * 0.05 = 15
      expect(breakdown.codeLengthPenalty).toBe(15);
      // Total: 5000 + 400 - 102 - 15 = 5283
      expect(breakdown.totalScore).toBe(5283);
    });

    it('resolves tie on test cases mathematically using execution efficiency metrics', () => {
      // Both passed 5 test cases, but Player 1 has faster runtime and lower memory
      const p1: BattlePerformanceMetrics = {
        userId: 'alice',
        testsPassed: 5,
        totalTests: 5,
        executionTimeMs: 150,
        memoryKb: 512,
        codeLength: 250,
      };

      const p2: BattlePerformanceMetrics = {
        userId: 'bob',
        testsPassed: 5,
        totalTests: 5,
        executionTimeMs: 600,
        memoryKb: 2048,
        codeLength: 500,
      };

      const result = evaluatorService.evaluateTiebreaker(p1, p2);

      expect(result.isDraw).toBe(false);
      expect(result.winnerId).toBe('alice');
      expect(result.reason).toBe('COMPOSITE_SCORE');
      expect(result.suddenDeathRequired).toBe(false);
      expect(result.scores['alice'].totalScore).toBeGreaterThan(result.scores['bob'].totalScore);
    });

    it('identifies exact draws and flags sudden death requirement', () => {
      // Identical performance metrics
      const p1: BattlePerformanceMetrics = {
        userId: 'alice',
        testsPassed: 4,
        totalTests: 5,
        executionTimeMs: 300,
        memoryKb: 1000,
        codeLength: 200,
      };

      const p2: BattlePerformanceMetrics = {
        userId: 'bob',
        testsPassed: 4,
        totalTests: 5,
        executionTimeMs: 300,
        memoryKb: 1000,
        codeLength: 200,
      };

      const result = evaluatorService.evaluateTiebreaker(p1, p2);

      expect(result.isDraw).toBe(true);
      expect(result.winnerId).toBeUndefined();
      expect(result.reason).toBe('EXACT_DRAW');
      expect(result.suddenDeathRequired).toBe(true);
    });
  });

  describe('Keystroke Velocity Evaluator', () => {
    it('accurately computes WPM, CPM, and burst velocity', () => {
      const battleId = 'btl-speed-1';
      const userId = 'typer-ace';
      const now = Date.now();

      // Simulate 100 keystrokes across 30 seconds
      for (let i = 0; i < 100; i++) {
        evaluatorService.recordKeystroke(battleId, userId, now - 30000 + i * 300);
      }

      const stats = evaluatorService.getKeystrokeVelocity(battleId, userId);
      expect(stats.totalKeystrokes).toBe(100);
      expect(stats.cpm).toBe(100);
      expect(stats.wpm).toBe(20); // 100 / 5 = 20 WPM
    });
  });

  describe('3-Minute Sudden Death Micro-Challenge Lifecycle', () => {
    it('initiates 180s sudden death session with a micro-puzzle', () => {
      const battleId = 'btl-sd-round';
      const session = evaluatorService.initiateSuddenDeath(battleId, 'sd-clamp-range');

      expect(session.battleId).toBe(battleId);
      expect(session.durationSeconds).toBe(180);
      expect(session.endsAt - session.startedAt).toBe(180000);
      expect(session.status).toBe('ACTIVE');
      expect(session.puzzle.puzzleId).toBe('sd-clamp-range');
      expect(session.puzzle.buggyCode).toContain('clamp');
    });

    it('rejects incorrect puzzle submissions', () => {
      const battleId = 'btl-sd-eval';
      evaluatorService.initiateSuddenDeath(battleId, 'sd-clamp-range');

      // Submit still-broken code
      const brokenCode = `function clamp(val, min, max) { return -999; }`;
      const res = evaluatorService.submitSuddenDeathSolution(battleId, 'user-wrong', brokenCode);

      expect(res.success).toBe(false);
      expect(res.isWinner).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('secures victory immediately for first valid submission and blocks subsequent submissions', () => {
      const battleId = 'btl-sd-winner';
      evaluatorService.initiateSuddenDeath(battleId, 'sd-clamp-range');

      // Valid fix for clamp(val, min, max)
      const validCode = `
        function clamp(val, min, max) {
          if (val < min) return min;
          if (val > max) return max;
          return val;
        }
      `;

      // Player 1 submits correct fix
      const p1Res = evaluatorService.submitSuddenDeathSolution(battleId, 'p1', validCode);

      expect(p1Res.success).toBe(true);
      expect(p1Res.isWinner).toBe(true);
      expect(p1Res.timingBreakdown?.winnerId).toBe('p1');
      expect(p1Res.timingBreakdown?.timeToSolveMs).toBeGreaterThanOrEqual(1);

      // Player 2 attempts submission after match is already completed
      const p2Res = evaluatorService.submitSuddenDeathSolution(battleId, 'p2', validCode);

      expect(p2Res.success).toBe(false);
      expect(p2Res.isWinner).toBe(false);
      expect(p2Res.error).toContain('Sudden death already won by p1');
    });

    it('enforces 180s expiration boundary on sudden death sessions', () => {
      const battleId = 'btl-sd-expired';
      const session = evaluatorService.initiateSuddenDeath(battleId, 'sd-clamp-range');

      // Fast forward past 180s
      session.endsAt = Date.now() - 5000;

      const validCode = `function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }`;
      const res = evaluatorService.submitSuddenDeathSolution(battleId, 'late-user', validCode);

      expect(res.success).toBe(false);
      expect(res.error).toContain('expired');
    });
  });

  describe('BattlesGateway WebSocket Events Suite', () => {
    it('evaluates tiebreaker and broadcasts battle:tiebreaker_resolved when mathematically won', async () => {
      const mockClient: any = { emit: jest.fn() };

      const res: any = await gateway.handleEvaluateTiebreaker(mockClient, {
        battleId: 'btl-gw-tie',
        player1: {
          userId: 'winner-p1',
          testsPassed: 5,
          totalTests: 5,
          executionTimeMs: 100,
          memoryKb: 500,
          codeLength: 200,
        },
        player2: {
          userId: 'loser-p2',
          testsPassed: 5,
          totalTests: 5,
          executionTimeMs: 900,
          memoryKb: 4000,
          codeLength: 800,
        },
      });

      expect(res.outcome).toBe('RESOLVED');
      expect(res.winnerId).toBe('winner-p1');
      expect(mockServer.to).toHaveBeenCalledWith('battle:btl-gw-tie');
      expect(mockServer.to).toHaveBeenCalledWith('spectator:btl-gw-tie');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'battle:tiebreaker_resolved',
        expect.objectContaining({ winnerId: 'winner-p1' }),
      );
    });

    it('evaluates tiebreaker on exact draw and broadcasts battle:sudden_death extending timer by 180s', async () => {
      const mockClient: any = { emit: jest.fn() };

      const identicalMetrics: BattlePerformanceMetrics = {
        userId: 'p1',
        testsPassed: 5,
        totalTests: 5,
        executionTimeMs: 250,
        memoryKb: 1000,
        codeLength: 300,
      };

      const res: any = await gateway.handleEvaluateTiebreaker(mockClient, {
        battleId: 'btl-gw-draw',
        player1: { ...identicalMetrics, userId: 'p1' },
        player2: { ...identicalMetrics, userId: 'p2' },
      });

      expect(res.outcome).toBe('SUDDEN_DEATH');
      expect(res.session.durationSeconds).toBe(180);
      expect(mockServer.to).toHaveBeenCalledWith('battle:btl-gw-draw');
      expect(mockServer.to).toHaveBeenCalledWith('spectator:btl-gw-draw');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'battle:sudden_death',
        expect.objectContaining({
          battleId: 'btl-gw-draw',
          durationSeconds: 180,
          puzzle: expect.objectContaining({ title: expect.any(String) }),
        }),
      );
    });

    it('handles battle:submit_sudden_death and broadcasts battle:sudden_death_winner with timing breakdown', () => {
      const mockClient: any = { emit: jest.fn() };
      const battleId = 'btl-gw-sd-solve';

      evaluatorService.initiateSuddenDeath(battleId, 'sd-clamp-range');

      const validCode = `
        function clamp(val, min, max) {
          if (val < min) return min;
          if (val > max) return max;
          return val;
        }
      `;

      const res: any = gateway.handleSubmitSuddenDeath(mockClient, {
        battleId,
        userId: 'champion-user',
        code: validCode,
      });

      expect(res.success).toBe(true);
      expect(res.isWinner).toBe(true);
      expect(res.winnerId).toBe('champion-user');
      expect(res.timingBreakdown?.timeToSolveMs).toBeDefined();

      expect(mockServer.to).toHaveBeenCalledWith(`battle:${battleId}`);
      expect(mockServer.to).toHaveBeenCalledWith(`spectator:${battleId}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        'battle:sudden_death_winner',
        expect.objectContaining({
          battleId,
          winnerId: 'champion-user',
          timingBreakdown: expect.objectContaining({ winnerId: 'champion-user' }),
        }),
      );
    });
  });
});
