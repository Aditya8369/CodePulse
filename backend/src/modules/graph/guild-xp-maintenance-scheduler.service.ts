import { Injectable, Logger } from '@nestjs/common';

export interface MaintenanceSettlement {
  isUpkeepPaid: boolean;
  treasuryAfterSettlement: number;
  xpAfterSettlement: number;
}

@Injectable()
export class GuildXpMaintenanceSchedulerService {
  private readonly logger = new Logger(GuildXpMaintenanceSchedulerService.name);

  public settleUpkeep(currentTreasury: number, currentXp: number, requiredUpkeep = 500, decayPenaltyXp = 100): MaintenanceSettlement {
    if (currentTreasury >= requiredUpkeep) {
      return {
        isUpkeepPaid: true,
        treasuryAfterSettlement: currentTreasury - requiredUpkeep,
        xpAfterSettlement: currentXp,
      };
    }

    // Default on upkeep -> apply XP decay
    const penalizedXp = Math.max(0, currentXp - decayPenaltyXp);
    return {
      isUpkeepPaid: false,
      treasuryAfterSettlement: currentTreasury,
      xpAfterSettlement: penalizedXp,
    };
  }
}
