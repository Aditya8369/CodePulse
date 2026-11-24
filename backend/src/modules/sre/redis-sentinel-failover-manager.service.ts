import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RedisSentinelFailoverManagerService {
  private readonly logger = new Logger(RedisSentinelFailoverManagerService.name);

  public evaluateFailoverQuorum(sentinelAcks: number, totalSentinels: number): { quorumSatisfied: boolean; proceedWithPromotion: boolean } {
    const requiredQuorum = Math.floor(totalSentinels / 2) + 1;
    const quorumSatisfied = sentinelAcks >= requiredQuorum;

    if (!quorumSatisfied) {
      this.logger.error(`Sentinel failover aborted: insufficient quorum (${sentinelAcks}/${requiredQuorum} needed).`);
      return { quorumSatisfied: false, proceedWithPromotion: false };
    }
    this.logger.log(`Sentinel failover approved: quorum satisfied (${sentinelAcks}/${totalSentinels}).`);
    return { quorumSatisfied: true, proceedWithPromotion: true };
  }
}
