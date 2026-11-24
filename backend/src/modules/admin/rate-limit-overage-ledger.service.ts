import { Injectable, Logger } from '@nestjs/common';

export interface OverageRecord {
  tenantId: string;
  overageRequests: number;
  costPerOverage: number;
  settledAmountUsd: number;
}

@Injectable()
export class RateLimitOverageLedgerService {
  private readonly logger = new Logger(RateLimitOverageLedgerService.name);
  private overages = new Map<string, number>(); // tenantId -> count

  public recordOverage(tenantId: string, count: number): number {
    const cur = (this.overages.get(tenantId) || 0) + count;
    this.overages.set(tenantId, cur);
    return cur;
  }

  public settleOverage(tenantId: string, costPerThousand: number = 0.50): OverageRecord {
    const count = this.overages.get(tenantId) || 0;
    const cost = (count / 1000) * costPerThousand;
    this.overages.set(tenantId, 0); // Clear after settlement

    return {
      tenantId,
      overageRequests: count,
      costPerOverage: costPerThousand,
      settledAmountUsd: Math.round(cost * 100) / 100
    };
  }
}
