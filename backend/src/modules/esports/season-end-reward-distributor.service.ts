import { Injectable, Logger } from '@nestjs/common';

export interface TierReward {
  tierName: string;
  badge: string;
  creditBonus: number;
}

@Injectable()
export class SeasonEndRewardDistributorService {
  private readonly logger = new Logger(SeasonEndRewardDistributorService.name);

  public determineReward(finalElo: number): TierReward {
    if (finalElo >= 2200) return { tierName: 'GRANDMASTER', badge: 'grandmaster-crest', creditBonus: 5000 };
    if (finalElo >= 1900) return { tierName: 'DIAMOND', badge: 'diamond-crest', creditBonus: 3000 };
    if (finalElo >= 1600) return { tierName: 'PLATINUM', badge: 'platinum-crest', creditBonus: 1500 };
    if (finalElo >= 1300) return { tierName: 'GOLD', badge: 'gold-crest', creditBonus: 800 };
    return { tierName: 'SILVER', badge: 'silver-crest', creditBonus: 300 };
  }
}
