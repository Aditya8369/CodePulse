import { Injectable, Logger } from '@nestjs/common';

export interface RunnerContainer {
  containerId: string;
  lastActiveEpoch: number;
  status: 'IDLE' | 'BUSY';
}

@Injectable()
export class FinopsIdleRunnerReaperService {
  private readonly logger = new Logger(FinopsIdleRunnerReaperService.name);
  private readonly idleTtlMs = 15 * 60 * 1000; // 15 min idle TTL

  public reapIdleRunners(runners: RunnerContainer[]): { reapedCount: number; reapedIds: string[] } {
    const now = Date.now();
    const reapedIds = runners
      .filter((r) => r.status === 'IDLE' && now - r.lastActiveEpoch > this.idleTtlMs)
      .map((r) => r.containerId);

    if (reapedIds.length > 0) {
      this.logger.log(`FinOps: Pruned ${reapedIds.length} leaked/idle execution containers.`);
    }
    return { reapedCount: reapedIds.length, reapedIds };
  }
}
