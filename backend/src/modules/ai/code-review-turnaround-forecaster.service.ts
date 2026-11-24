import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CodeReviewTurnaroundForecasterService {
  private readonly logger = new Logger(CodeReviewTurnaroundForecasterService.name);

  public forecastHours(diffLines: number, reviewerCount: number): number {
    const baseHours = 4.0;
    const sizeFactor = diffLines / 100;
    const reviewerFactor = reviewerCount > 0 ? 1 / reviewerCount : 1;
    const estimated = Math.round((baseHours + sizeFactor * 2) * reviewerFactor * 10) / 10;
    this.logger.log(`Estimated PR review turnaround: ${estimated} hours`);
    return estimated;
  }
}
