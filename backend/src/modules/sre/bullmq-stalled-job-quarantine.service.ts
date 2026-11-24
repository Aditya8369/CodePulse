import { Injectable, Logger } from '@nestjs/common';

export interface StalledJobRecord {
  jobId: string;
  queueName: string;
  stallCount: number;
  lastStallTimestamp: number;
  quarantined: boolean;
  quarantineReason?: string;
  deadLetterQueue?: string;
}

@Injectable()
export class BullmqStalledJobQuarantineService {
  private readonly logger = new Logger(BullmqStalledJobQuarantineService.name);
  private readonly stallTracker = new Map<string, number>();
  private readonly quarantineList = new Map<string, StalledJobRecord>();
  private readonly maxStallLimit = 3;

  public handleJobStall(queueName: string, jobId: string, meta: Record<string, unknown> = {}): StalledJobRecord {
    const key = `${queueName}:${jobId}`;
    const count = (this.stallTracker.get(key) || 0) + 1;
    this.stallTracker.set(key, count);

    if (count >= this.maxStallLimit) {
      const record: StalledJobRecord = {
        jobId,
        queueName,
        stallCount: count,
        lastStallTimestamp: Date.now(),
        quarantined: true,
        quarantineReason: `Job exceeded max stall threshold (${count}/${this.maxStallLimit})`,
        deadLetterQueue: `dlq:${queueName}:stalled`,
      };
      this.quarantineList.set(key, record);
      this.logger.warn(`Quarantined stalled job ${key} to DLQ.`);
      return record;
    }

    return {
      jobId,
      queueName,
      stallCount: count,
      lastStallTimestamp: Date.now(),
      quarantined: false,
    };
  }

  public getQuarantineList(): StalledJobRecord[] {
    return Array.from(this.quarantineList.values());
  }

  public purgeFromQuarantine(queueName: string, jobId: string): boolean {
    const key = `${queueName}:${jobId}`;
    this.stallTracker.delete(key);
    return this.quarantineList.delete(key);
  }
}
