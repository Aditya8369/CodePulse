import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MmrVolatilityDampenerService {
  private readonly logger = new Logger(MmrVolatilityDampenerService.name);

  public dampenDelta(rawDelta: number, calibrationMatchesLeft: number, dampeningFactor = 0.5): number {
    if (calibrationMatchesLeft <= 0) {
      return rawDelta; // Calibration finished
    }
    // Dampen rating swings during initial calibration
    const adjusted = Math.round(rawDelta * dampeningFactor);
    return adjusted;
  }
}
