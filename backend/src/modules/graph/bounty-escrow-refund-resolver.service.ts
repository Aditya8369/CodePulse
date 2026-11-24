import { Injectable, Logger } from '@nestjs/common';

export type BountyStatus = 'ACTIVE' | 'CLAIMED' | 'REFUNDED_EXPIRED';

@Injectable()
export class BountyEscrowRefundResolverService {
  private readonly logger = new Logger(BountyEscrowRefundResolverService.name);

  public checkExpiration(isClaimed: boolean, expirationEpochMs: number, currentEpochMs = Date.now()): { shouldRefund: boolean; status: BountyStatus } {
    if (isClaimed) {
      return { shouldRefund: false, status: 'CLAIMED' };
    }
    if (currentEpochMs >= expirationEpochMs) {
      return { shouldRefund: true, status: 'REFUNDED_EXPIRED' };
    }
    return { shouldRefund: false, status: 'ACTIVE' };
  }
}
