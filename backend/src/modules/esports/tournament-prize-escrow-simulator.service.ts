import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TournamentPrizeEscrowSimulatorService {
  private readonly logger = new Logger(TournamentPrizeEscrowSimulatorService.name);

  public calculatePayouts(totalPoolUsd: number, sharePercentages: number[]): number[] {
    const payouts: number[] = [];
    let allocated = 0;

    for (let i = 0; i < sharePercentages.length; i++) {
      if (i === sharePercentages.length - 1) {
        // Last recipient gets remaining cents to ensure exact sum matching total pool
        payouts.push(Math.round((totalPoolUsd - allocated) * 100) / 100);
      } else {
        const amount = Math.round(totalPoolUsd * (sharePercentages[i] / 100) * 100) / 100;
        allocated += amount;
        payouts.push(amount);
      }
    }

    return payouts;
  }
}
