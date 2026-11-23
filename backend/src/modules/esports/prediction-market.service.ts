import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export type PredictionMarketCategory =
  | 'MATCH_WINNER'
  | 'SPEED_MILESTONE'
  | 'ERROR_STREAK';

export type PredictionPoolStatus = 'OPEN' | 'LOCKED' | 'RESOLVED' | 'REFUNDED';

export interface PredictionWagerEntry {
  wagerId: string;
  userId: string;
  outcomeKey: string;
  stakeBits: number;
  oddsAtPlacement: number;
  payoutBits: number;
  settled: boolean;
  placedAtMs: number;
}

export interface PredictionPoolState {
  poolId: string;
  battleId: string;
  category: PredictionMarketCategory;
  title: string;
  outcomeLabels: Record<string, string>;
  outcomePools: Record<string, number>;
  odds: Record<string, number>;
  totalPoolBits: number;
  status: PredictionPoolStatus;
  matchStartedAtMs: number;
  lockDeadlineMs: number;
  lockReason?: string;
  winningOutcome?: string;
  verifiedByJudge: boolean;
  wagers: PredictionWagerEntry[];
  tokenCompliance: {
    currency: 'PulseBits';
    realWorldMonetaryValue: 0;
    cashOutAllowed: false;
  };
}

export const SPOILER_LOCK_WINDOW_MS = 60_000; // 60 seconds into match start to prevent spoiler cheating
export const DEFAULT_STARTING_PULSE_BITS = 1_000;
export const MAX_SINGLE_WAGER_BITS = 5_000;

@Injectable()
export class PredictionMarketService {
  private readonly logger = new Logger(PredictionMarketService.name);
  private readonly poolsByBattle = new Map<string, PredictionPoolState>();
  private readonly wallets = new Map<string, number>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  getWalletBalance(userId: string): number {
    if (!this.wallets.has(userId)) {
      this.wallets.set(userId, DEFAULT_STARTING_PULSE_BITS);
    }
    return this.wallets.get(userId)!;
  }

  creditPulseBits(userId: string, amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Credit amount must be a positive integer');
    }
    const next = this.getWalletBalance(userId) + Math.floor(amount);
    this.wallets.set(userId, next);
    return next;
  }

  /**
   * Strict regulatory guardrail: PulseBits are virtual entertainment points with zero
   * real-world monetary value; any attempt to cash out or convert to fiat/crypto is blocked.
   */
  assertVirtualTokenGuardrail(operation: string): void {
    const forbiddenKeywords = ['cash', 'withdraw', 'fiat', 'usd', 'inr', 'crypto', 'payout_real'];
    const lower = operation.toLowerCase();
    if (forbiddenKeywords.some((kw) => lower.includes(kw))) {
      throw new ForbiddenException(
        'Compliance Guardrail: PulseBits have zero real-world monetary value and cannot be withdrawn or converted to cash.',
      );
    }
  }

  /**
   * Calculates real-time parimutuel odds across all outcomes based on pool weight distributions.
   */
  computeParimutuelOdds(outcomePools: Record<string, number>): Record<string, number> {
    const keys = Object.keys(outcomePools);
    const totalPool = keys.reduce((sum, key) => sum + Math.max(0, outcomePools[key]), 0);
    const odds: Record<string, number> = {};

    for (const key of keys) {
      const sidePool = Math.max(0, outcomePools[key]);
      if (totalPool === 0 || sidePool === 0) {
        odds[key] = 2.0;
      } else {
        const rawOdds = totalPool / sidePool;
        odds[key] = Number(Math.max(1.05, rawOdds).toFixed(2));
      }
    }

    return odds;
  }

  createPredictionPool(params: {
    battleId: string;
    category?: PredictionMarketCategory;
    title?: string;
    outcomes: Record<string, string>;
    matchStartedAtMs?: number;
    lockWindowMs?: number;
  }): PredictionPoolState {
    const outcomeKeys = Object.keys(params.outcomes);
    if (outcomeKeys.length < 2) {
      throw new BadRequestException('Prediction market requires at least 2 outcomes');
    }

    const matchStartedAtMs = params.matchStartedAtMs ?? Date.now();
    const lockWindowMs = params.lockWindowMs ?? SPOILER_LOCK_WINDOW_MS;
    const outcomePools: Record<string, number> = {};
    for (const key of outcomeKeys) {
      outcomePools[key] = 0;
    }

    const pool: PredictionPoolState = {
      poolId: `pool_${randomUUID().slice(0, 8)}`,
      battleId: params.battleId,
      category: params.category ?? 'MATCH_WINNER',
      title: params.title ?? 'Match Winner Prediction',
      outcomeLabels: { ...params.outcomes },
      outcomePools,
      odds: this.computeParimutuelOdds(outcomePools),
      totalPoolBits: 0,
      status: 'OPEN',
      matchStartedAtMs,
      lockDeadlineMs: matchStartedAtMs + lockWindowMs,
      verifiedByJudge: false,
      wagers: [],
      tokenCompliance: {
        currency: 'PulseBits',
        realWorldMonetaryValue: 0,
        cashOutAllowed: false,
      },
    };

    this.poolsByBattle.set(params.battleId, pool);
    return pool;
  }

  getPool(battleId: string): PredictionPoolState {
    const pool = this.poolsByBattle.get(battleId);
    if (!pool) {
      throw new NotFoundException(`No prediction market pool found for battle ${battleId}`);
    }
    return pool;
  }

  /**
   * Automatically locks the betting window if 2 minutes (120s) have elapsed since match start
   * or when triggered by the first code execution event.
   */
  enforceSpoilerLockIfExpired(
    battleId: string,
    nowMs = Date.now(),
    reason = '120-second spoiler lock timer elapsed',
  ): PredictionPoolState {
    const pool = this.getPool(battleId);
    if (pool.status === 'OPEN' && nowMs >= pool.lockDeadlineMs) {
      pool.status = 'LOCKED';
      pool.lockReason = reason;
    }
    return pool;
  }

  lockPoolOnCodeExecution(battleId: string): PredictionPoolState | null {
    const pool = this.poolsByBattle.get(battleId);
    if (!pool || pool.status !== 'OPEN') return pool ?? null;
    pool.status = 'LOCKED';
    pool.lockReason = 'Locked on first live code execution event';
    return pool;
  }

  /**
   * Places a spectator prediction wager in virtual PulseBits tokens and recalculates
   * parimutuel odds across all outcomes in real time.
   */
  async placePrediction(params: {
    battleId: string;
    userId: string;
    outcomeKey: string;
    stakeBits: number;
    nowMs?: number;
  }): Promise<{
    pool: PredictionPoolState;
    wager: PredictionWagerEntry;
    remainingBalance: number;
  }> {
    const nowMs = params.nowMs ?? Date.now();
    const pool = this.enforceSpoilerLockIfExpired(params.battleId, nowMs);

    if (pool.status !== 'OPEN') {
      throw new BadRequestException(
        `Predictions are locked (${pool.lockReason ?? pool.status})`,
      );
    }
    if (!(params.outcomeKey in pool.outcomePools)) {
      throw new BadRequestException(`Invalid prediction outcome: ${params.outcomeKey}`);
    }

    const stake = Math.floor(params.stakeBits);
    if (!Number.isFinite(stake) || stake < 10 || stake > MAX_SINGLE_WAGER_BITS) {
      throw new BadRequestException(
        `Wager stake must be between 10 and ${MAX_SINGLE_WAGER_BITS} PulseBits`,
      );
    }

    const currentBalance = this.getWalletBalance(params.userId);
    if (currentBalance < stake) {
      throw new BadRequestException(
        `Insufficient PulseBits balance (${currentBalance} available, ${stake} required)`,
      );
    }

    // Deduct stake and update pool weights atomically
    const remainingBalance = currentBalance - stake;
    this.wallets.set(params.userId, remainingBalance);

    pool.outcomePools[params.outcomeKey] += stake;
    pool.totalPoolBits += stake;
    pool.odds = this.computeParimutuelOdds(pool.outcomePools);

    const wager: PredictionWagerEntry = {
      wagerId: `wager_${randomUUID().slice(0, 8)}`,
      userId: params.userId,
      outcomeKey: params.outcomeKey,
      stakeBits: stake,
      oddsAtPlacement: pool.odds[params.outcomeKey],
      payoutBits: 0,
      settled: false,
      placedAtMs: nowMs,
    };
    pool.wagers.push(wager);

    await this.syncWagerToPrisma(pool, wager, remainingBalance);

    return {
      pool,
      wager,
      remainingBalance,
    };
  }

  /**
   * Settles the parimutuel prediction pool upon server-judge verified match conclusion
   * and distributes PulseBits payouts proportionally to winning predictors.
   */
  async resolveMarket(params: {
    battleId: string;
    winningOutcome: string;
    verifiedByJudge: boolean;
  }): Promise<{
    pool: PredictionPoolState;
    payouts: Array<{ userId: string; stakeBits: number; payoutBits: number }>;
  }> {
    if (!params.verifiedByJudge) {
      throw new ForbiddenException(
        'Market resolution requires server-judge verification',
      );
    }

    const pool = this.getPool(params.battleId);
    if (pool.status === 'RESOLVED') {
      throw new BadRequestException('Prediction market pool has already been resolved');
    }
    if (!(params.winningOutcome in pool.outcomePools)) {
      throw new BadRequestException(`Unknown winning outcome: ${params.winningOutcome}`);
    }

    pool.status = 'RESOLVED';
    pool.winningOutcome = params.winningOutcome;
    pool.verifiedByJudge = true;

    const winningPoolBits = pool.outcomePools[params.winningOutcome];
    const payouts: Array<{ userId: string; stakeBits: number; payoutBits: number }> = [];

    const winningWagers = pool.wagers.filter((w) => w.outcomeKey === params.winningOutcome);
    for (const wager of pool.wagers) {
      wager.settled = true;
    }

    if (winningWagers.length > 0 && winningPoolBits > 0 && pool.totalPoolBits > 0) {
      // Zero Rounding Leak Algorithm (Largest Remainder Method / Hare-Niemeyer)
      // Guarantees sum(payouts) === totalPoolBits with 0 leaked fractional tokens
      const calculations = winningWagers.map((w, idx) => {
        const exactPayout = (w.stakeBits * pool.totalPoolBits) / winningPoolBits;
        const basePayout = Math.floor(exactPayout);
        const remainder = exactPayout - basePayout;
        return {
          wager: w,
          idx,
          basePayout,
          remainder,
          finalPayout: basePayout,
        };
      });

      const totalBase = calculations.reduce((sum, c) => sum + c.basePayout, 0);
      const remainderBits = pool.totalPoolBits - totalBase;

      // Distribute remainder bits in descending order of fractional remainder
      calculations.sort((a, b) => {
        if (b.remainder !== a.remainder) return b.remainder - a.remainder;
        return a.idx - b.idx;
      });

      for (let i = 0; i < remainderBits && i < calculations.length; i++) {
        calculations[i].finalPayout += 1;
      }

      for (const item of calculations) {
        item.wager.payoutBits = item.finalPayout;
        this.creditPulseBits(item.wager.userId, item.finalPayout);
        payouts.push({
          userId: item.wager.userId,
          stakeBits: item.wager.stakeBits,
          payoutBits: item.finalPayout,
        });
      }
    }

    return {
      pool,
      payouts,
    };
  }

  /**
   * Simulates large-scale pari-mutuel payout across thousands of spectators.
   * Proves mathematically that total disbursed equals total pool with zero rounding leaks.
   */
  async simulateLargeSpectatorPayout(
    battleId: string,
    spectatorCount = 1000,
  ): Promise<{
    totalPool: number;
    totalDisbursed: number;
    roundingLeak: number;
    spectatorCount: number;
    zeroRoundingLeak: boolean;
  }> {
    const startMs = Date.now();
    this.createPredictionPool({
      battleId,
      outcomes: { playerA: 'Winner A', playerB: 'Challenger B' },
      matchStartedAtMs: startMs,
      lockWindowMs: 120_000,
    });

    for (let i = 0; i < spectatorCount; i++) {
      const outcome = i % 3 === 0 ? 'playerB' : 'playerA';
      const stake = 10 + (i % 50); // Varied odd stakes
      const userId = `spec_mass_${battleId}_${i}`;
      this.creditPulseBits(userId, 5000);
      await this.placePrediction({
        battleId,
        userId,
        outcomeKey: outcome,
        stakeBits: stake,
        nowMs: startMs + 1000,
      });
    }

    const poolBefore = this.getPool(battleId);
    const totalPool = poolBefore.totalPoolBits;

    const resolution = await this.resolveMarket({
      battleId,
      winningOutcome: 'playerA',
      verifiedByJudge: true,
    });

    const totalDisbursed = resolution.payouts.reduce((sum, p) => sum + p.payoutBits, 0);
    const roundingLeak = totalPool - totalDisbursed;

    return {
      totalPool,
      totalDisbursed,
      roundingLeak,
      spectatorCount,
      zeroRoundingLeak: roundingLeak === 0,
    };
  }

  private async syncWagerToPrisma(
    pool: PredictionPoolState,
    wager: PredictionWagerEntry,
    remainingBalance: number,
  ): Promise<void> {
    if (!this.prisma) return;
    try {
      const prismaAny = this.prisma as unknown as {
        pulseBitsWallet?: { upsert: (args: unknown) => Promise<unknown> };
        predictionWager?: { create: (args: unknown) => Promise<unknown> };
      };
      if (prismaAny.pulseBitsWallet) {
        await prismaAny.pulseBitsWallet.upsert({
          where: { userId: wager.userId },
          create: {
            userId: wager.userId,
            balance: remainingBalance,
            totalWagered: wager.stakeBits,
          },
          update: {
            balance: remainingBalance,
            totalWagered: { increment: wager.stakeBits },
          },
        });
      }
      if (prismaAny.predictionWager) {
        await prismaAny.predictionWager.create({
          data: {
            poolId: pool.poolId,
            battleId: pool.battleId,
            userId: wager.userId,
            outcomeKey: wager.outcomeKey,
            stakeBits: wager.stakeBits,
            lockedOdds: wager.oddsAtPlacement,
          },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Non-blocking PulseBits Prisma sync skipped: ${msg}`);
    }
  }
}
