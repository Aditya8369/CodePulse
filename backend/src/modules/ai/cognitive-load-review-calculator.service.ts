import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CognitiveLoadReviewCalculatorService {
  private readonly logger = new Logger(CognitiveLoadReviewCalculatorService.name);

  public calculateReviewLoad(filesChanged: number, totalHunks: number, deletionsCount: number): number {
    const loadScore = filesChanged * 1.5 + totalHunks * 0.8 + deletionsCount * 0.1;
    this.logger.log(`Estimated PR cognitive review load score: ${loadScore.toFixed(1)}`);
    return Math.round(loadScore * 10) / 10;
  }
}
