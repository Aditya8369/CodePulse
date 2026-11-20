import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type BattlePassTrack = 'FREE' | 'ELITE';

export type BattlePassXpSource =
  | 'DAILY_CHALLENGE'
  | 'BATTLE_VICTORY'
  | 'CODE_REVIEW'
  | 'NSOC_PR_MERGE';

export type CosmeticCategory =
  | 'MONACO_THEME'
  | 'AVATAR_FRAME'
  | 'PROFILE_BANNER'
  | 'SFX_PACK';

export interface BattlePassRewardSpec {
  tier: number;
  track: BattlePassTrack;
  cosmeticCode: string;
  category: CosmeticCategory;
  label: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'MYTHIC';
}

export interface WeeklyQuestSpec {
  questId: string;
  title: string;
  source: BattlePassXpSource;
  targetCount: number;
  xpReward: number;
}

export interface BattlePassSnapshot {
  userId: string;
  seasonNumber: number;
  seasonTitle: string;
  totalXp: number;
  currentTier: number;
  maxTier: number;
  xpForCurrentTier: number;
  xpForNextTier: number;
  isEliteUnlocked: boolean;
  claimedFree: number[];
  claimedElite: number[];
  quests: Array<WeeklyQuestSpec & { progress: number; completed: boolean }>;
  inventory: BattlePassRewardSpec[];
}

export const MAX_BATTLE_PASS_TIER = 50;

export const XP_BY_SOURCE: Record<BattlePassXpSource, number> = {
  DAILY_CHALLENGE: 250,
  BATTLE_VICTORY: 400,
  CODE_REVIEW: 300,
  NSOC_PR_MERGE: 750,
};

export const WEEKLY_QUEST_ROTATION: WeeklyQuestSpec[] = [
  {
    questId: 'wq-daily-3',
    title: 'Solve 3 Daily Algorithmic Challenges',
    source: 'DAILY_CHALLENGE',
    targetCount: 3,
    xpReward: 600,
  },
  {
    questId: 'wq-battles-5',
    title: 'Win 5 Ranked Coding Battles',
    source: 'BATTLE_VICTORY',
    targetCount: 5,
    xpReward: 1000,
  },
  {
    questId: 'wq-reviews-4',
    title: 'Complete 4 Peer Code Reviews',
    source: 'CODE_REVIEW',
    targetCount: 4,
    xpReward: 750,
  },
  {
    questId: 'wq-nsoc-2',
    title: 'Merge 2 NSoC Open-Source Pull Requests',
    source: 'NSOC_PR_MERGE',
    targetCount: 2,
    xpReward: 1500,
  },
];

@Injectable()
export class BattlePassService {
  private readonly logger = new Logger(BattlePassService.name);
  private readonly memoryProgress = new Map<string, BattlePassSnapshot>();
  private readonly tierCatalog: BattlePassRewardSpec[];

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.tierCatalog = this.buildFiftyTierCatalog();
  }

  /**
   * 50-tier progressive linear + gentle exponential XP curve:
   * Tier 1 = 0 XP; each tier step grows smoothly from 500 XP up to ~1,725 XP at Tier 50.
   */
  computeXpRequiredForTier(tier: number): number {
    const clamped = Math.max(1, Math.min(MAX_BATTLE_PASS_TIER, Math.floor(tier)));
    if (clamped === 1) return 0;
    const n = clamped - 1;
    // Cumulative sum of (500 + 25 * (k - 1)) for k = 1..n
    return Math.round(n * 500 + 12.5 * n * (n - 1));
  }

  computeTierFromXp(totalXp: number): number {
    const safeXp = Math.max(0, Math.floor(totalXp));
    let tier = 1;
    for (let t = 2; t <= MAX_BATTLE_PASS_TIER; t++) {
      if (safeXp >= this.computeXpRequiredForTier(t)) {
        tier = t;
      } else {
        break;
      }
    }
    return tier;
  }

  getTierCatalog(): BattlePassRewardSpec[] {
    return this.tierCatalog;
  }

  getRewardSpec(tier: number, track: BattlePassTrack): BattlePassRewardSpec {
    const found = this.tierCatalog.find(
      (item) => item.tier === tier && item.track === track,
    );
    if (!found) {
      throw new BadRequestException(
        `No Battle Pass reward defined for Tier ${tier} (${track})`,
      );
    }
    return found;
  }

  private buildFiftyTierCatalog(): BattlePassRewardSpec[] {
    const catalog: BattlePassRewardSpec[] = [];
    for (let tier = 1; tier <= MAX_BATTLE_PASS_TIER; tier++) {
      const isMilestone = tier % 10 === 0;
      catalog.push({
        tier,
        track: 'FREE',
        cosmeticCode: `s1_free_t${tier}`,
        category: tier % 2 === 0 ? 'AVATAR_FRAME' : 'MONACO_THEME',
        label: isMilestone
          ? `Genesis Circuit Frame Mk.${tier / 10}`
          : `Syntax Pulse Theme v${tier}`,
        rarity: isMilestone ? 'EPIC' : tier >= 25 ? 'RARE' : 'COMMON',
      });

      catalog.push({
        tier,
        track: 'ELITE',
        cosmeticCode: `s1_elite_t${tier}`,
        category:
          tier % 3 === 0
            ? 'SFX_PACK'
            : tier % 2 === 0
              ? 'PROFILE_BANNER'
              : 'MONACO_THEME',
        label:
          tier === 50
            ? 'Mythic Sovereign Compiler Banner & Synth'
            : isMilestone
              ? `Overclocked Holo-Banner Tier ${tier}`
              : `Cyber-Neon Editor Theme #${tier}`,
        rarity: tier === 50 ? 'MYTHIC' : isMilestone ? 'EPIC' : 'RARE',
      });
    }
    return catalog;
  }

  getOrCreateProgress(
    userId: string,
    seasonNumber = 1,
    isEliteUnlocked = false,
  ): BattlePassSnapshot {
    const key = `${userId}:s${seasonNumber}`;
    let existing = this.memoryProgress.get(key);
    if (!existing) {
      // Carry forward permanent cosmetics from any prior season
      const priorInventory: BattlePassRewardSpec[] = [];
      for (const [entryKey, snap] of this.memoryProgress.entries()) {
        if (entryKey.startsWith(`${userId}:`)) {
          for (const item of snap.inventory) {
            if (!priorInventory.some((p) => p.cosmeticCode === item.cosmeticCode)) {
              priorInventory.push(item);
            }
          }
        }
      }

      existing = {
        userId,
        seasonNumber,
        seasonTitle: `Season ${seasonNumber}: Genesis Compiler`,
        totalXp: 0,
        currentTier: 1,
        maxTier: MAX_BATTLE_PASS_TIER,
        xpForCurrentTier: 0,
        xpForNextTier: this.computeXpRequiredForTier(2),
        isEliteUnlocked,
        claimedFree: [],
        claimedElite: [],
        quests: WEEKLY_QUEST_ROTATION.map((q) => ({
          ...q,
          progress: 0,
          completed: false,
        })),
        inventory: priorInventory,
      };
      this.memoryProgress.set(key, existing);
    } else if (isEliteUnlocked && !existing.isEliteUnlocked) {
      existing.isEliteUnlocked = true;
    }
    return existing;
  }

  /**
   * Records an XP gain event (daily challenge, battle victory, code review, NSoC PR merge),
   * updates matching weekly quests, and auto-levels the user's Battle Pass tier.
   */
  async recordXpEvent(params: {
    userId: string;
    source: BattlePassXpSource;
    seasonNumber?: number;
    count?: number;
    customXp?: number;
  }): Promise<{
    snapshot: BattlePassSnapshot;
    xpGranted: number;
    questBonusXp: number;
    leveledUp: boolean;
    previousTier: number;
    newTier: number;
  }> {
    const seasonNumber = params.seasonNumber ?? 1;
    const count = Math.max(1, params.count ?? 1);
    const snapshot = this.getOrCreateProgress(params.userId, seasonNumber);
    const previousTier = snapshot.currentTier;

    const baseXp = (params.customXp ?? XP_BY_SOURCE[params.source]) * count;
    let questBonusXp = 0;

    for (const quest of snapshot.quests) {
      if (quest.source === params.source && !quest.completed) {
        quest.progress = Math.min(quest.targetCount, quest.progress + count);
        if (quest.progress >= quest.targetCount) {
          quest.completed = true;
          questBonusXp += quest.xpReward;
        }
      }
    }

    const totalGranted = baseXp + questBonusXp;
    snapshot.totalXp += totalGranted;
    snapshot.currentTier = this.computeTierFromXp(snapshot.totalXp);
    snapshot.xpForCurrentTier = this.computeXpRequiredForTier(snapshot.currentTier);
    snapshot.xpForNextTier =
      snapshot.currentTier < MAX_BATTLE_PASS_TIER
        ? this.computeXpRequiredForTier(snapshot.currentTier + 1)
        : snapshot.xpForCurrentTier;

    await this.syncProgressToPrisma(snapshot);

    return {
      snapshot,
      xpGranted: baseXp,
      questBonusXp,
      leveledUp: snapshot.currentTier > previousTier,
      previousTier,
      newTier: snapshot.currentTier,
    };
  }

  /**
   * Claims an unlocked tier reward on the Free or Elite track and persists it into permanent inventory.
   */
  async claimTierReward(params: {
    userId: string;
    tier: number;
    track: BattlePassTrack;
    seasonNumber?: number;
  }): Promise<{
    snapshot: BattlePassSnapshot;
    claimedReward: BattlePassRewardSpec;
  }> {
    const seasonNumber = params.seasonNumber ?? 1;
    const snapshot = this.getOrCreateProgress(params.userId, seasonNumber);

    if (params.tier < 1 || params.tier > MAX_BATTLE_PASS_TIER) {
      throw new BadRequestException(`Invalid tier ${params.tier}`);
    }
    if (snapshot.currentTier < params.tier) {
      throw new BadRequestException(
        `Tier ${params.tier} is locked (current tier: ${snapshot.currentTier})`,
      );
    }
    if (params.track === 'ELITE' && !snapshot.isEliteUnlocked) {
      throw new ForbiddenException(
        'Elite Battle Pass track required to claim Elite rewards',
      );
    }

    const claimedList =
      params.track === 'FREE' ? snapshot.claimedFree : snapshot.claimedElite;
    if (claimedList.includes(params.tier)) {
      throw new BadRequestException(
        `Tier ${params.tier} (${params.track}) reward has already been claimed`,
      );
    }

    const reward = this.getRewardSpec(params.tier, params.track);
    claimedList.push(params.tier);
    if (!snapshot.inventory.some((i) => i.cosmeticCode === reward.cosmeticCode)) {
      snapshot.inventory.push(reward);
    }

    await this.syncProgressToPrisma(snapshot, reward);

    return {
      snapshot,
      claimedReward: reward,
    };
  }

  /**
   * Transitions a user to a new Battle Pass season (resetting XP & tier to 1)
   * while preserving 100% of permanently unlocked cosmetics in their inventory.
   */
  async resetSeasonPreservingCosmetics(
    userId: string,
    newSeasonNumber: number,
  ): Promise<BattlePassSnapshot> {
    const nextSnapshot = this.getOrCreateProgress(userId, newSeasonNumber, false);
    nextSnapshot.totalXp = 0;
    nextSnapshot.currentTier = 1;
    nextSnapshot.claimedFree = [];
    nextSnapshot.claimedElite = [];
    nextSnapshot.xpForCurrentTier = 0;
    nextSnapshot.xpForNextTier = this.computeXpRequiredForTier(2);
    await this.syncProgressToPrisma(nextSnapshot);
    return nextSnapshot;
  }

  private async syncProgressToPrisma(
    snapshot: BattlePassSnapshot,
    newlyClaimedReward?: BattlePassRewardSpec,
  ): Promise<void> {
    if (!this.prisma) return;
    try {
      const prismaAny = this.prisma as unknown as {
        userBattlePassProgress?: {
          upsert: (args: unknown) => Promise<unknown>;
        };
        userInventoryItem?: {
          upsert: (args: unknown) => Promise<unknown>;
        };
      };

      if (prismaAny.userBattlePassProgress) {
        await prismaAny.userBattlePassProgress.upsert({
          where: {
            userId_seasonNumber: {
              userId: snapshot.userId,
              seasonNumber: snapshot.seasonNumber,
            },
          },
          create: {
            userId: snapshot.userId,
            seasonNumber: snapshot.seasonNumber,
            totalXp: snapshot.totalXp,
            currentTier: snapshot.currentTier,
            isEliteUnlocked: snapshot.isEliteUnlocked,
            claimedFree: snapshot.claimedFree,
            claimedElite: snapshot.claimedElite,
          },
          update: {
            totalXp: snapshot.totalXp,
            currentTier: snapshot.currentTier,
            isEliteUnlocked: snapshot.isEliteUnlocked,
            claimedFree: snapshot.claimedFree,
            claimedElite: snapshot.claimedElite,
          },
        });
      }

      if (newlyClaimedReward && prismaAny.userInventoryItem) {
        await prismaAny.userInventoryItem.upsert({
          where: {
            userId_cosmeticCode: {
              userId: snapshot.userId,
              cosmeticCode: newlyClaimedReward.cosmeticCode,
            },
          },
          create: {
            userId: snapshot.userId,
            cosmeticCode: newlyClaimedReward.cosmeticCode,
            category: newlyClaimedReward.category,
            label: newlyClaimedReward.label,
            rarity: newlyClaimedReward.rarity,
            seasonNumber: snapshot.seasonNumber,
            isPermanent: true,
          },
          update: {},
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Non-blocking Battle Pass Prisma sync skipped: ${msg}`);
    }
  }
}
