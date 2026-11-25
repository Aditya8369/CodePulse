import { Injectable, Logger } from '@nestjs/common';

export interface CloudResource {
  id: string;
  type: 'CLUSTER' | 'DATABASE' | 'SANDBOX';
  lastActivityMinutesAgo: number;
  isPaused: boolean;
}

@Injectable()
export class FinopsIdleResourcePauserService {
  private readonly logger = new Logger(FinopsIdleResourcePauserService.name);

  public evaluateIdleResources(resources: CloudResource[], idleThresholdMinutes: number = 60): { pausedCount: number; resumedCount: number } {
    let pausedCount = 0;
    let resumedCount = 0;

    for (const r of resources) {
      if (!r.isPaused && r.lastActivityMinutesAgo >= idleThresholdMinutes) {
        r.isPaused = true;
        pausedCount++;
        this.logger.log(`FinOps: Auto-paused idle resource ${r.id} (Idle for ${r.lastActivityMinutesAgo}m)`);
      } else if (r.isPaused && r.lastActivityMinutesAgo === 0) {
        r.isPaused = false;
        resumedCount++;
        this.logger.log(`FinOps: Resumed active resource ${r.id}`);
      }
    }

    return { pausedCount, resumedCount };
  }
}
