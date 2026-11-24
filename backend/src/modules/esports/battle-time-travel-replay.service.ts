import { Injectable, Logger } from '@nestjs/common';

export interface ScrubTarget {
  targetTick: number;
  nearestKeyframeTick: number;
  deltaTicksToFastForward: number;
}

@Injectable()
export class BattleTimeTravelReplayService {
  private readonly logger = new Logger(BattleTimeTravelReplayService.name);
  private readonly keyframeStride = 100;

  public calculateScrub(targetTick: number): ScrubTarget {
    const nearestKeyframeTick = Math.floor(targetTick / this.keyframeStride) * this.keyframeStride;
    const deltaTicksToFastForward = targetTick - nearestKeyframeTick;

    return { targetTick, nearestKeyframeTick, deltaTicksToFastForward };
  }
}
