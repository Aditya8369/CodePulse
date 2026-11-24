import { Injectable, Logger } from '@nestjs/common';

export interface MatchmakingWindow {
  minRating: number;
  maxRating: number;
  expandedRadius: number;
}

@Injectable()
export class Glicko2StarvationRingSolverService {
  private readonly logger = new Logger(Glicko2StarvationRingSolverService.name);

  public getSearchWindow(rating: number, queueWaitSec: number, baseRadius = 50, expansionPerSec = 5, maxRadius = 300): MatchmakingWindow {
    const expansion = Math.min(maxRadius, baseRadius + (queueWaitSec * expansionPerSec));
    const minRating = Math.max(0, rating - expansion);
    const maxRating = rating + expansion;

    return { minRating, maxRating, expandedRadius: expansion };
  }
}
