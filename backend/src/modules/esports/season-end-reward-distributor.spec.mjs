import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SeasonEndRewardDistributorService {
  reward(elo) {
    if (elo >= 2200) return { tier: 'GRANDMASTER', bonus: 5000 };
    if (elo >= 1900) return { tier: 'DIAMOND', bonus: 3000 };
    if (elo >= 1600) return { tier: 'PLATINUM', bonus: 1500 };
    return { tier: 'GOLD', bonus: 800 };
  }
}

describe('SeasonEndRewardDistributorService (#2344)', () => {
  test('allocates seasonal rewards and tier titles according to final MMR placement', () => {
    const distributor = new SeasonEndRewardDistributorService();
    assert.strictEqual(distributor.reward(2350).tier, 'GRANDMASTER');
    assert.strictEqual(distributor.reward(1750).tier, 'PLATINUM');
    assert.strictEqual(distributor.reward(1500).tier, 'GOLD');
  });
});
