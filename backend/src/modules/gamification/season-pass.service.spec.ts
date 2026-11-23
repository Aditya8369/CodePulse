import { SeasonPassService } from './season-pass.service';
import { XpMatrixCalculator } from './xp-matrix';

describe('SeasonPassService & XpMatrixCalculator (Anti-Grind Season Pass)', () => {
  let service: SeasonPassService;

  beforeEach(() => {
    service = new SeasonPassService();
  });

  it('applies anti-grind diminishing returns to curtail excessive grinding/botting', () => {
    // First match of the day
    const match1 = service.awardMatchXp('user-1', {
      difficulty: 'HARD',
      isVictory: true,
      accuracyScore: 1.0,
    });
    expect(match1.actualXp).toBe(match1.rawXp);
    expect(match1.decayPenaltyPercentage).toBe(0);

    // Simulate 15 matches on the same day
    for (let i = 2; i <= 15; i++) {
      service.awardMatchXp('user-1', {
        difficulty: 'HARD',
        isVictory: true,
        accuracyScore: 1.0,
      });
    }

    // 16th match of the day
    const match16 = service.awardMatchXp('user-1', {
      difficulty: 'HARD',
      isVictory: true,
      accuracyScore: 1.0,
    });

    expect(match16.actualXp).toBeLessThan(match1.actualXp * 0.35); // Over 65% reduction
    expect(match16.decayPenaltyPercentage).toBeGreaterThan(60);
  });

  it('atomically claims milestone rewards and blocks double-claim attempts', async () => {
    const userId = 'user-champion';
    // Award sufficient XP to reach level 5
    for (let i = 0; i < 5; i++) {
      service.awardMatchXp(userId, {
        difficulty: 'EXPERT',
        isVictory: true,
        accuracyScore: 1.0,
      });
    }

    const state = service.getOrCreateUserState(userId);
    expect(state.currentLevel).toBeGreaterThanOrEqual(5);

    // 1. Claim valid milestone reward
    const claimResult = await service.claimMilestoneReward(userId, 5, 'FREE');
    expect(claimResult.reward.level).toBe(5);
    expect(claimResult.reward.tier).toBe('FREE');

    // 2. Attempt duplicate claim (should throw ConflictException)
    await expect(service.claimMilestoneReward(userId, 5, 'FREE')).rejects.toThrow(
      'already been claimed',
    );
  });

  it('prevents claiming unearned milestone levels', async () => {
    const userId = 'user-newbie';
    service.getOrCreateUserState(userId);

    await expect(service.claimMilestoneReward(userId, 50, 'FREE')).rejects.toThrow(
      'Cannot claim reward for level 50',
    );
  });

  it('mathematically verifies progression curve monotonicity across 10,000 simulated players', () => {
    const simulation = service.simulateProgression(10000);
    expect(simulation.verifiedMonotonic).toBe(true);
    expect(simulation.minLevel).toBeGreaterThanOrEqual(1);
    expect(simulation.maxLevel).toBeLessThanOrEqual(100);
  });
});
