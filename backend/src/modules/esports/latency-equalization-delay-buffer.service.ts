import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LatencyEqualizationDelayBufferService {
  private readonly logger = new Logger(LatencyEqualizationDelayBufferService.name);

  public calculateInjectedDelay(playerPingMs: number, targetLatencyMs = 120): number {
    if (playerPingMs >= targetLatencyMs) {
      return 0; // Already at or above target
    }
    const artificialDelayMs = targetLatencyMs - playerPingMs;
    return artificialDelayMs;
  }
}
