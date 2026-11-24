import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class KafkaPartitionRebalanceLockFixService {
  private readonly logger = new Logger(KafkaPartitionRebalanceLockFixService.name);
  private activeLocks = new Map<number, string>();

  public tryAcquireLock(partition: number, consumerId: string): boolean {
    if (this.activeLocks.has(partition)) {
      return false; // Lock contested
    }
    this.activeLocks.set(partition, consumerId);
    return true;
  }

  public releaseLock(partition: number, consumerId: string): boolean {
    if (this.activeLocks.get(partition) === consumerId) {
      this.activeLocks.delete(partition);
      return true;
    }
    return false;
  }

  public isLocked(partition: number): boolean {
    return this.activeLocks.has(partition);
  }
}
