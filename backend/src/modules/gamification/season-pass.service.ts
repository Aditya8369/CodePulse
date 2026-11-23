import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import {
  DAILY_MATCH_THRESHOLD,
  MAX_SEASON_PASS_LEVEL,
  SeasonPassReward,
  XpMatrixCalculator,
} from './xp-matrix';

export interface UserSeasonPassState {
  userId: string;
  seasonId: string;
  totalXp: number;
  currentLevel: number;
  isVip: boolean;
  dailyMatchesPlayed: number;
  lastMatchDate: string; // YYYY-MM-DD
  claimedRewards: Set<string>; // Set of `${level}:${tier}`
}

export interface MatchXpAwardResult {
  userId: string;
  rawXp: number;
  actualXp: number;
  decayPenaltyPercentage: number;
  newTotalXp: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  unlockedRewards: SeasonPassReward[];
}

export interface ClaimRewardResult {
  userId: string;
  level: number;
  tier: 'FREE' | 'VIP';
  reward: SeasonPassReward;
  claimedAt: string;
}

@Injectable()
export class SeasonPassService {
  private readonly logger = new Logger(SeasonPassService.name);

  // In-memory user state stores
  private readonly userStates = new Map<string, UserSeasonPassState>();
  private readonly rewardCatalog = XpMatrixCalculator.generateRewardCatalogue();

  // Admin tuning configurations
  private antiGrindThreshold = DAILY_MATCH_THRESHOLD;
  private seasonalXpMultiplier = 1.0;

  // Active claim locks to prevent concurrent race conditions
  private readonly activeClaimLocks = new Set<string>();

  /**
   * Retrieves or creates a user's season pass progression profile.
   */
  getOrCreateUserState(userId: string, isVip = false): UserSeasonPassState {
    const today = new Date().toISOString().split('T')[0];
    let state = this.userStates.get(userId);

    if (!state) {
      state = {
        userId,
        seasonId: 'season-2026-s1',
        totalXp: 0,
        currentLevel: 1,
        isVip,
        dailyMatchesPlayed: 0,
        lastMatchDate: today,
        claimedRewards: new Set<string>(),
      };
      this.userStates.set(userId, state);
    } else if (state.lastMatchDate !== today) {
      // Reset daily match counter on day boundary
      state.dailyMatchesPlayed = 0;
      state.lastMatchDate = today;
    }

    return state;
  }

  /**
   * Awards match XP with anti-grind diminishing returns and level progression.
   */
  awardMatchXp(
    userId: string,
    params: {
      difficulty: string;
      isVictory: boolean;
      accuracyScore: number;
      streakBonus?: number;
      isVip?: boolean;
    },
  ): MatchXpAwardResult {
    const state = this.getOrCreateUserState(userId, params.isVip);
    state.dailyMatchesPlayed++;

    const rawXp = Math.round(
      XpMatrixCalculator.calculateBaseXp(
        params.difficulty,
        params.isVictory,
        params.accuracyScore,
        params.streakBonus || 0,
      ) * this.seasonalXpMultiplier,
    );

    const actualXp = XpMatrixCalculator.applyAntiGrindDecay(
      rawXp,
      state.dailyMatchesPlayed,
      this.antiGrindThreshold,
    );

    const decayPenaltyPercentage = rawXp > 0
      ? Number((((rawXp - actualXp) / rawXp) * 100).toFixed(1))
      : 0;

    const previousLevel = state.currentLevel;
    state.totalXp += actualXp;
    state.currentLevel = XpMatrixCalculator.xpToLevel(state.totalXp);
    const leveledUp = state.currentLevel > previousLevel;

    // Identify newly unlocked milestone rewards
    const unlockedRewards = this.rewardCatalog.filter((r) => {
      const isEligibleTier = r.tier === 'FREE' || state.isVip;
      return isEligibleTier && r.level > previousLevel && r.level <= state.currentLevel;
    });

    return {
      userId,
      rawXp,
      actualXp,
      decayPenaltyPercentage,
      newTotalXp: state.totalXp,
      previousLevel,
      newLevel: state.currentLevel,
      leveledUp,
      unlockedRewards,
    };
  }

  /**
   * Atomically claims a milestone reward preventing double-claim concurrency race conditions.
   */
  async claimMilestoneReward(
    userId: string,
    level: number,
    tier: 'FREE' | 'VIP',
  ): Promise<ClaimRewardResult> {
    const claimKey = `${userId}:${level}:${tier}`;

    // Mutex lock check
    if (this.activeClaimLocks.has(claimKey)) {
      throw new ConflictException(`Concurrent claim operation already in progress for level ${level} (${tier})`);
    }

    this.activeClaimLocks.add(claimKey);
    try {
      const state = this.getOrCreateUserState(userId);

      if (level > state.currentLevel) {
        throw new BadRequestException(`Cannot claim reward for level ${level}; user is at level ${state.currentLevel}`);
      }

      if (tier === 'VIP' && !state.isVip) {
        throw new BadRequestException('VIP Pass required to claim VIP tier rewards');
      }

      const rewardKey = `${level}:${tier}`;
      if (state.claimedRewards.has(rewardKey)) {
        throw new ConflictException(`Milestone reward level ${level} (${tier}) has already been claimed.`);
      }

      const reward = this.rewardCatalog.find((r) => r.level === level && r.tier === tier);
      if (!reward) {
        throw new BadRequestException(`No reward configured for level ${level} (${tier})`);
      }

      // Atomic commit
      state.claimedRewards.add(rewardKey);

      return {
        userId,
        level,
        tier,
        reward,
        claimedAt: new Date().toISOString(),
      };
    } finally {
      this.activeClaimLocks.delete(claimKey);
    }
  }

  /**
   * Admin configuration tuning.
   */
  updateSeasonConfig(multiplier: number, antiGrindThreshold: number): void {
    this.seasonalXpMultiplier = multiplier;
    this.antiGrindThreshold = antiGrindThreshold;
    this.logger.log(`Season Pass config updated: Multiplier=${multiplier}, AntiGrindThreshold=${antiGrindThreshold}`);
  }

  /**
   * Mathematically verifies progression curve monotonicity across simulated player profiles.
   */
  simulateProgression(playerCount = 10000): { minLevel: number; maxLevel: number; verifiedMonotonic: boolean } {
    let verifiedMonotonic = true;
    let minLevel = 100;
    let maxLevel = 1;

    for (let i = 0; i < playerCount; i++) {
      const randomXp = Math.floor(Math.random() * 50000);
      const lvl1 = XpMatrixCalculator.xpToLevel(randomXp);
      const lvl2 = XpMatrixCalculator.xpToLevel(randomXp + 500);

      if (lvl2 < lvl1) {
        verifiedMonotonic = false;
        break;
      }

      minLevel = Math.min(minLevel, lvl1);
      maxLevel = Math.max(maxLevel, lvl2);
    }

    return { minLevel, maxLevel, verifiedMonotonic };
  }
}
