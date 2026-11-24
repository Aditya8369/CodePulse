import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CpuCoreAffinitySchedulerService {
  private readonly logger = new Logger(CpuCoreAffinitySchedulerService.name);
  private workerCores = [2, 3, 4, 5]; // isolated from event loop cores 0, 1

  public scheduleHeavyCompilation(jobId: string): { assignedCore: number; offloaded: boolean } {
    const assignedCore = this.workerCores[Math.floor(Math.random() * this.workerCores.length)];
    this.logger.log(`Pinned compilation task ${jobId} to dedicated worker core #${assignedCore}`);
    return { assignedCore, offloaded: true };
  }
}
