import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SpotInterruptionWatchdogService {
  private readonly logger = new Logger(SpotInterruptionWatchdogService.name);
  private draining = false;

  public processNotice(rawNotice: { action: string; time: string }): boolean {
    if (rawNotice && rawNotice.action) {
      this.draining = true;
      this.logger.warn('Spot termination notice received! Starting emergency state persistence.');
      return true;
    }
    return false;
  }

  public checkpointState(items: string[]): { count: number; ready: boolean } {
    return { count: items.length, ready: true };
  }

  public isDraining(): boolean {
    return this.draining;
  }
}
