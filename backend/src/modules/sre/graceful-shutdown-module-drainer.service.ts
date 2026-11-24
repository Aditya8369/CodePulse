import { Injectable, Logger } from '@nestjs/common';

export interface ShutdownTask {
  name: string;
  tier: number; // Tier 1 (ingress) -> Tier 2 (workers) -> Tier 3 (storage/db)
  drain: () => Promise<void>;
}

@Injectable()
export class GracefulShutdownModuleDrainerService {
  private readonly logger = new Logger(GracefulShutdownModuleDrainerService.name);
  private tasks: ShutdownTask[] = [];

  public register(task: ShutdownTask): void {
    this.tasks.push(task);
  }

  public async executeOrderedDrain(): Promise<string[]> {
    this.tasks.sort((a, b) => a.tier - b.tier);
    const completed: string[] = [];
    for (const t of this.tasks) {
      this.logger.log(`Draining Tier ${t.tier} module: ${t.name}`);
      await t.drain();
      completed.push(t.name);
    }
    return completed;
  }
}
