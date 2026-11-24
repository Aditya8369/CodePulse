import { Injectable, Logger } from '@nestjs/common';

export interface TenantWorkload {
  tenantId: string;
  cpuUsagePercent: number;
}

@Injectable()
export class NoisyNeighborMitigatingSchedulerService {
  private readonly logger = new Logger(NoisyNeighborMitigatingSchedulerService.name);

  public scheduleTask(workload: TenantWorkload, totalClusterLoadPercent: number): { allowed: boolean; delayMs: number; priority: 'NORMAL' | 'THROTTLED' } {
    // If cluster is under high contention (>80%) and this tenant is consuming >40% CPU, throttle them
    if (totalClusterLoadPercent > 80 && workload.cpuUsagePercent > 40) {
      this.logger.warn(`Throttling noisy neighbor ${workload.tenantId} (Usage: ${workload.cpuUsagePercent}%, Cluster: ${totalClusterLoadPercent}%)`);
      return { allowed: true, delayMs: 500, priority: 'THROTTLED' };
    }

    return { allowed: true, delayMs: 0, priority: 'NORMAL' };
  }
}
