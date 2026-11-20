import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  PredictionMarketService,
  SPOILER_LOCK_WINDOW_MS,
} from './prediction-market.service';

describe('PredictionMarketService (Parimutuel Odds, Spoiler Lock & PulseBits Payouts)', () => {
  let service: PredictionMarketService;

  beforeEach(() => {
    service = new PredictionMarketService();
  });

  it('recalculates parimutuel odds dynamically as pool balances shift and distributes atomic payouts upon server-judge verification', async () => {
    const startMs = 1_000_000;
    const pool = service.createPredictionPool({
      battleId: 'finals-match-1',
      category: 'MATCH_WINNER',
      outcomes: {
        playerA: 'Itssonia7',
        playerB: 'rival_dev',
      },
      matchStartedAtMs: startMs,
    });

    expect(pool.odds.playerA).toBe(2.0);
    expect(pool.odds.playerB).toBe(2.0);

    // Spectator 1 bets 300 PulseBits on playerA; Spectator 2 bets 100 PulseBits on playerB
    // Total pool = 400 -> playerA odds = 400/300 = 1.33, playerB odds = 400/100 = 4.00
    await service.placePrediction({
      battleId: 'finals-match-1',
      userId: 'spec-1',
      outcomeKey: 'playerA',
      stakeBits: 300,
      nowMs: startMs + 15_000,
    });
    const secondBet = await service.placePrediction({
      battleId: 'finals-match-1',
      userId: 'spec-2',
      outcomeKey: 'playerB',
      stakeBits: 100,
      nowMs: startMs + 30_000,
    });

    expect(secondBet.pool.totalPoolBits).toBe(400);
    expect(secondBet.pool.odds.playerA).toBe(1.33);
    expect(secondBet.pool.odds.playerB).toBe(4.0);
    expect(service.getWalletBalance('spec-1')).toBe(700);
    expect(service.getWalletBalance('spec-2')).toBe(900);

    // Unverified resolution must be rejected
    await expect(
      service.resolveMarket({
        battleId: 'finals-match-1',
        winningOutcome: 'playerA',
        verifiedByJudge: false,
      }),
    ).rejects.toThrow(ForbiddenException);

    // Server-judge verified resolution awards full 400 PulseBits pool to spec-1
    const settled = await service.resolveMarket({
      battleId: 'finals-match-1',
      winningOutcome: 'playerA',
      verifiedByJudge: true,
    });

    expect(settled.payouts).toHaveLength(1);
    expect(settled.payouts[0].payoutBits).toBe(400);
    expect(service.getWalletBalance('spec-1')).toBe(1100);
    expect(service.getWalletBalance('spec-2')).toBe(900);
  });

  it('locks predictions automatically 120s into match start or on first code execution, and blocks real-cash conversion', async () => {
    const startMs = 2_000_000;
    service.createPredictionPool({
      battleId: 'finals-match-2',
      outcomes: { fast: '< 60s Solve', slow: '>= 60s Solve' },
      matchStartedAtMs: startMs,
    });

    // Betting at +121 seconds is automatically locked against spoiler predictions
    await expect(
      service.placePrediction({
        battleId: 'finals-match-2',
        userId: 'spec-late',
        outcomeKey: 'fast',
        stakeBits: 100,
        nowMs: startMs + SPOILER_LOCK_WINDOW_MS + 1000,
      }),
    ).rejects.toThrow(BadRequestException);

    // Regulatory guardrail blocks any fiat/cash withdrawal operation
    expect(() => service.assertVirtualTokenGuardrail('withdraw_fiat_usd')).toThrow(
      ForbiddenException,
    );
  });
});
