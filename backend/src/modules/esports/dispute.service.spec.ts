import { DisputeService } from './dispute.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DisputeService (Match Dispute Adjudication Engine #456)', () => {
  let service: DisputeService;
  let mockPrisma: any;
  let mockScylla: any;

  beforeEach(() => {
    mockPrisma = {
      battle: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'battle-123',
          challengerId: 'player-alice',
          opponentId: 'player-bob',
          winnerId: 'player-bob',
          status: 'COMPLETED',
        }),
        update: jest.fn().mockResolvedValue({ id: 'battle-123' }),
      },
      matchDispute: {
        create: jest.fn(async ({ data }: any) => ({
          id: 'dispute-001',
          ...data,
          snapshots: [data.snapshots.create],
        })),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'dispute-001',
            battleId: 'battle-123',
            filerId: 'player-alice',
            status: 'PENDING',
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'dispute-001',
          battleId: 'battle-123',
          filerId: 'player-alice',
          accusedId: 'player-bob',
          status: 'PENDING',
        }),
        update: jest.fn(async ({ data }: any) => ({
          id: 'dispute-001',
          ...data,
        })),
      },
      disputeSnapshot: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'snap-001',
          disputeId: 'dispute-001',
          battleId: 'battle-123',
          capturedAt: new Date(),
          keystrokeTimeline: [
            {
              frameIndex: 0,
              timestamp: '2026-11-18T12:00:00.000Z',
              relativeOffsetMs: 0,
              playerId: 'player-bob',
              delta: 'paste suspicious code block',
            },
            {
              frameIndex: 1,
              timestamp: '2026-11-18T12:00:01.000Z',
              relativeOffsetMs: 1000,
              playerId: 'player-bob',
              delta: 'eval all tests pass',
            },
          ],
          testCasesStdout: 'All 15 tests passed in 2ms',
          testCasesStderr: '',
          networkRttTelemetry: { avgRtt: 15, jitter: 1 },
          tabFocusLogs: [{ event: 'blur', durationMs: 4000 }],
          finalCodeState: 'function solution() { return true; }',
        }),
      },
      battleRating: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'player-bob' }),
      },
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
    };

    mockScylla = {
      getKeystrokesRange: jest.fn().mockResolvedValue([
        {
          timestamp: new Date('2026-11-18T12:00:00Z'),
          playerId: 'player-bob',
          delta: 'console.log(1)',
          cursorPosition: 10,
        },
      ]),
    };

    service = new DisputeService(
      mockPrisma as unknown as PrismaService,
      mockScylla as any,
    );
  });

  describe('Filing Match Disputes & Automated Snapshot Capture', () => {
    it('creates dispute and automatically captures full forensic snapshot', async () => {
      const result = await service.fileDispute({
        battleId: 'battle-123',
        filerId: 'player-alice',
        reason: 'Opponent used external solver script and switched tabs',
        evidenceUrl: 'https://cdn.codepulse.io/evidence/dispute-1.png',
        testCasesStdout: 'Tests executed',
        finalCodeState: 'function solve() {}',
      });

      expect(result.id).toBe('dispute-001');
      expect(mockPrisma.matchDispute.create).toHaveBeenCalled();
      expect(mockScylla.getKeystrokesRange).toHaveBeenCalledWith({
        battleId: 'battle-123',
        limit: 5000,
      });
    });
  });

  describe('Time-Travel State Playback & Frame Scrubbing', () => {
    it('retrieves frame-by-frame snapshot enabling time-travel scrubbing', async () => {
      const timeTravel = await service.getTimeTravelSnapshot('dispute-001');

      expect(timeTravel.disputeId).toBe('dispute-001');
      expect(timeTravel.totalFrames).toBe(2);
      expect(timeTravel.frames[0]).toMatchObject({
        frameIndex: 0,
        playerId: 'player-bob',
        delta: 'paste suspicious code block',
      });
      expect(timeTravel.tabFocusLogs).toBeDefined();
    });
  });

  describe('Moderator Adjudication Actions & Elo Rating Rollbacks', () => {
    it('NULLIFY_MATCH: resets winner and restores player Elo ratings', async () => {
      const resolution = await service.resolveDispute({
        disputeId: 'dispute-001',
        adminId: 'moderator-99',
        verdict: 'NULLIFY_MATCH',
        adminNotes: 'Network de-sync confirmed; match voided',
      });

      expect(resolution.status).toBe('RESOLVED');
      expect(resolution.adminVerdict).toBe('NULLIFY_MATCH');
      expect(mockPrisma.battle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            winnerId: null,
          }),
        }),
      );
      expect(mockPrisma.battleRating.updateMany).toHaveBeenCalled();
    });

    it('AWARD_WIN_TO_VICTIM: transfers victory and updates ratings atomically', async () => {
      const resolution = await service.resolveDispute({
        disputeId: 'dispute-001',
        adminId: 'moderator-99',
        verdict: 'AWARD_WIN_TO_VICTIM',
        adminNotes: 'Opponent disqualified for multi-client cheating',
      });

      expect(resolution.adminVerdict).toBe('AWARD_WIN_TO_VICTIM');
      expect(mockPrisma.battle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            winnerId: 'player-alice',
          }),
        }),
      );
      expect(mockPrisma.battleRating.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'player-alice' },
          data: { elo: { increment: 25 } },
        }),
      );
    });

    it('BAN_CHEATER: flags accused player as banned in settings', async () => {
      await service.resolveDispute({
        disputeId: 'dispute-001',
        adminId: 'moderator-99',
        verdict: 'BAN_CHEATER',
        adminNotes: 'Persistent cheating detected',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'player-bob' },
          data: expect.objectContaining({
            isOnline: false,
          }),
        }),
      );
    });

    it('DISMISS_WITH_PENALTY: penalizes frivolous dispute filers', async () => {
      const resolution = await service.resolveDispute({
        disputeId: 'dispute-001',
        adminId: 'moderator-99',
        verdict: 'DISMISS_WITH_PENALTY',
        adminNotes: 'Spam dispute without evidence',
      });

      expect(resolution.status).toBe('DISMISSED');
      expect(mockPrisma.battleRating.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'player-alice' },
          data: { elo: { decrement: 15 } },
        }),
      );
    });
  });
});

