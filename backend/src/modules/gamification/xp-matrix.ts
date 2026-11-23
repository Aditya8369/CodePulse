export interface SeasonPassReward {
  level: number;
  tier: 'FREE' | 'VIP';
  rewardType: 'BADGE' | 'THEME' | 'TITLE' | 'PULSEBITS' | 'AVATAR_FRAME';
  rewardId: string;
  name: string;
  quantity?: number;
}

export const XP_DIFFICULTY_BASE: Record<string, number> = {
  EASY: 100,
  MEDIUM: 250,
  HARD: 500,
  EXPERT: 1000,
};

export const DAILY_MATCH_THRESHOLD = 10;
export const MAX_SEASON_PASS_LEVEL = 100;
export const PROGRESSION_SCALING_C = 0.5; // Level = floor(0.5 * sqrt(XP)) -> 100 levels requires 40,000 XP

export class XpMatrixCalculator {
  /**
   * Calculates raw base XP before anti-grind decay.
   */
  static calculateBaseXp(
    difficulty: string,
    isVictory: boolean,
    accuracyScore: number, // 0.0 to 1.0
    streakBonus = 0,
  ): number {
    const base = XP_DIFFICULTY_BASE[difficulty.toUpperCase()] || 150;
    const outcomeMultiplier = isVictory ? 1.5 : 0.6;
    const clampedAccuracy = Math.max(0.1, Math.min(1.0, accuracyScore));
    const streakMultiplier = 1.0 + Math.min(0.5, streakBonus * 0.05);

    return Math.round(base * outcomeMultiplier * clampedAccuracy * streakMultiplier);
  }

  /**
   * Anti-grind diminishing returns formula:
   * XP_actual = XP * (1 / (1 + (dailyMatches / threshold)^2))
   * Prevents botting and grinding trivial problems by smoothly decaying returns.
   */
  static applyAntiGrindDecay(baseXp: number, dailyMatchesPlayed: number, threshold = DAILY_MATCH_THRESHOLD): number {
    const ratio = dailyMatchesPlayed / threshold;
    const decayMultiplier = 1 / (1 + Math.pow(ratio, 2));
    return Math.max(5, Math.round(baseXp * decayMultiplier));
  }

  /**
   * Calculates Season Pass level given total accumulated seasonal XP.
   * Level(XP) = min(100, max(1, floor(c * sqrt(XP)) + 1))
   */
  static xpToLevel(totalXp: number, c = PROGRESSION_SCALING_C): number {
    if (totalXp <= 0) return 1;
    const rawLevel = Math.floor(c * Math.sqrt(totalXp)) + 1;
    return Math.min(MAX_SEASON_PASS_LEVEL, Math.max(1, rawLevel));
  }

  /**
   * Returns exact total XP required to reach a specific level.
   */
  static levelToXp(level: number, c = PROGRESSION_SCALING_C): number {
    if (level <= 1) return 0;
    const target = Math.min(MAX_SEASON_PASS_LEVEL, level) - 1;
    return Math.ceil(Math.pow(target / c, 2));
  }

  /**
   * Generates default milestone reward catalogue for 100 tiers (Free and VIP).
   */
  static generateRewardCatalogue(): SeasonPassReward[] {
    const rewards: SeasonPassReward[] = [];

    for (let lvl = 1; lvl <= MAX_SEASON_PASS_LEVEL; lvl++) {
      // Free track rewards (every 5 levels or currency)
      if (lvl % 5 === 0) {
        rewards.push({
          level: lvl,
          tier: 'FREE',
          rewardType: 'PULSEBITS',
          rewardId: `pb-free-${lvl}`,
          name: `${lvl * 20} PulseBits`,
          quantity: lvl * 20,
        });
      }
      if (lvl === 50) {
        rewards.push({
          level: lvl,
          tier: 'FREE',
          rewardType: 'TITLE',
          rewardId: 'title-mid-season-veteran',
          name: 'Mid-Season Veteran',
        });
      }
      if (lvl === 100) {
        rewards.push({
          level: lvl,
          tier: 'FREE',
          rewardType: 'BADGE',
          rewardId: 'badge-season-master',
          name: 'Season Grandmaster Badge',
        });
      }

      // VIP track rewards on every level
      if (lvl % 10 === 0) {
        rewards.push({
          level: lvl,
          tier: 'VIP',
          rewardType: 'THEME',
          rewardId: `theme-cyber-arena-${lvl}`,
          name: `Cyber Arena Glow Theme Tier ${lvl / 10}`,
        });
      } else {
        rewards.push({
          level: lvl,
          tier: 'VIP',
          rewardType: 'PULSEBITS',
          rewardId: `pb-vip-${lvl}`,
          name: `${lvl * 50} PulseBits VIP Bonus`,
          quantity: lvl * 50,
        });
      }
    }

    return rewards;
  }
}
