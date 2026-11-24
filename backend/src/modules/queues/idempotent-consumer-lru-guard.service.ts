import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class IdempotentConsumerLruGuardService {
  private readonly logger = new Logger(IdempotentConsumerLruGuardService.name);
  private l1Cache = new Set<string>();
  private readonly maxL1Size = 1000;

  public shouldProcess(messageId: string): boolean {
    if (this.l1Cache.has(messageId)) {
      return false; // Already processed
    }

    if (this.l1Cache.size >= this.maxL1Size) {
      const first = this.l1Cache.values().next().value;
      if (first) this.l1Cache.delete(first);
    }

    this.l1Cache.add(messageId);
    return true;
  }
}
