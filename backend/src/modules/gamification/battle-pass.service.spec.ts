import { ForbiddenException } from '@nestjs/common';
import {
  BattlePassService,
  MAX_BATTLE_PASS_TIER,
} from './battle-pass.service';

describe('BattlePassService (50-Tier Seasonal Progression & Inventory)', () => {
  let service: BattlePassService;

  beforeEach(() => {
    service = new BattlePassService();
  });

  it('computes monotonically increasing 50-tier XP thresholds and auto-levels tiers on XP events', async () => {
    expect(service.getTierCatalog()).toHaveLength(MAX_BATTLE_PASS_TIER * 2);
    expect(service.computeXpRequiredForTier(1)).toBe(0);
    expect(service.computeXpRequiredForTier(2)).toBe(500);
    expect(service.computeXpRequiredForTier(50)).toBeGreaterThan(
      service.computeXpRequiredForTier(25),
    );

    // Completing 2 NSoC PR merges grants 2 * 750 = 1500 XP + 1500 weekly quest bonus = 3000 XP
    const outcome = await service.recordXpEvent({
      userId: 'user-sonia',
      source: 'NSOC_PR_MERGE',
      count: 2,
    });

    expect(outcome.xpGranted).toBe(1500);
    expect(outcome.questBonusXp).toBe(1500);
    expect(outcome.leveledUp).toBe(true);
    expect(outcome.newTier).toBeGreaterThanOrEqual(6);
  });

  it('enforces Free vs Elite track permissions and persists claimed cosmetics across seasonal resets', async () => {
    service.getOrCreateProgress('user-cosmetic', 1, false);
    await service.recordXpEvent({
      userId: 'user-cosmetic',
      source: 'NSOC_PR_MERGE',
      count: 1,
    });

    // Free track reward claims cleanly into inventory
    const freeClaim = await service.claimTierReward({
      userId: 'user-cosmetic',
      tier: 1,
      track: 'FREE',
    });
    expect(freeClaim.claimedReward.cosmeticCode).toBe('s1_free_t1');
    expect(freeClaim.snapshot.inventory).toHaveLength(1);

    // Elite track claim fails without Elite pass
    await expect(
      service.claimTierReward({
        userId: 'user-cosmetic',
        tier: 1,
        track: 'ELITE',
      }),
    ).rejects.toThrow(ForbiddenException);

    // Unlock Elite and claim Tier 2 Elite reward
    service.getOrCreateProgress('user-cosmetic', 1, true);
    const eliteClaim = await service.claimTierReward({
      userId: 'user-cosmetic',
      tier: 2,
      track: 'ELITE',
    });
    expect(eliteClaim.snapshot.inventory).toHaveLength(2);

    // Reset to Season 2: XP resets to 0 & Tier 1, but both permanent cosmetics remain in inventory
    const season2 = await service.resetSeasonPreservingCosmetics(
      'user-cosmetic',
      2,
    );
    expect(season2.seasonNumber).toBe(2);
    expect(season2.totalXp).toBe(0);
    expect(season2.currentTier).toBe(1);
    expect(season2.inventory).toHaveLength(2);
  });
});
