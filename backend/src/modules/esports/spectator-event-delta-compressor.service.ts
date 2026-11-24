import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SpectatorEventDeltaCompressorService {
  private readonly logger = new Logger(SpectatorEventDeltaCompressorService.name);

  public extractDelta(prev: Record<string, number>, curr: Record<string, number>): Record<string, number> {
    const delta: Record<string, number> = {};
    for (const [key, value] of Object.entries(curr)) {
      if (prev[key] !== value) {
        delta[key] = value;
      }
    }
    return delta;
  }
}
