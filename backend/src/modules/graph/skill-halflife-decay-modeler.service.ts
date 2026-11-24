import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SkillHalflifeDecayModelerService {
  private readonly logger = new Logger(SkillHalflifeDecayModelerService.name);

  public calculateRetainedSkill(initialScore: number, daysInactive: number, halfLifeDays = 365): number {
    if (daysInactive <= 0) return initialScore;
    const decayFactor = Math.pow(0.5, daysInactive / halfLifeDays);
    const retained = Math.round(initialScore * decayFactor * 10) / 10;
    return retained;
  }
}
