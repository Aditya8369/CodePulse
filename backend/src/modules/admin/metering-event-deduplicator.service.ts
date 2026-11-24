import { Injectable, Logger } from '@nestjs/common';

export interface UsageEvent {
  idempotencyKey: string;
  tenantId: string;
  units: number;
}

@Injectable()
export class MeteringEventDeduplicatorService {
  private readonly logger = new Logger(MeteringEventDeduplicatorService.name);
  private processedKeys = new Set<string>();

  public processUsageEvent(event: UsageEvent): { ingested: boolean; unitsApplied: number } {
    if (this.processedKeys.has(event.idempotencyKey)) {
      this.logger.warn(`Duplicate billing usage event rejected: ${event.idempotencyKey}`);
      return { ingested: false, unitsApplied: 0 };
    }

    this.processedKeys.add(event.idempotencyKey);
    return { ingested: true, unitsApplied: event.units };
  }
}
