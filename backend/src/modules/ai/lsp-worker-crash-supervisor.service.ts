import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LspWorkerCrashSupervisorService {
  private readonly logger = new Logger(LspWorkerCrashSupervisorService.name);
  private restartCounts = new Map<string, number>();

  public onWorkerCrash(workerId: string): { shouldRestart: boolean; currentRestarts: number } {
    const count = (this.restartCounts.get(workerId) || 0) + 1;
    this.restartCounts.set(workerId, count);

    const shouldRestart = count <= 5;
    if (shouldRestart) {
      this.logger.warn(`LSP Worker ${workerId} crashed. Auto-restarting (attempt ${count}/5).`);
    } else {
      this.logger.error(`LSP Worker ${workerId} exceeded crash restart quota. Halting.`);
    }
    return { shouldRestart, currentRestarts: count };
  }
}
