import { Injectable, Logger } from '@nestjs/common';

export interface SegmentInspection {
  segmentId: string;
  hasCorruptedOffsets: boolean;
  quarantinedOffset?: number;
}

@Injectable()
export class TopicCompactionCleanerSentinelService {
  private readonly logger = new Logger(TopicCompactionCleanerSentinelService.name);
  private quarantinedOffsets = new Set<number>();

  public inspectSegment(segmentId: string, offsets: number[]): SegmentInspection {
    let lastOffset = -1;
    for (const offset of offsets) {
      if (offset <= lastOffset) {
        this.logger.error(`Non-monotonic offset anomaly in segment ${segmentId}: ${offset} <= ${lastOffset}`);
        this.quarantinedOffsets.add(offset);
        return { segmentId, hasCorruptedOffsets: true, quarantinedOffset: offset };
      }
      lastOffset = offset;
    }
    return { segmentId, hasCorruptedOffsets: false };
  }

  public isQuarantined(offset: number): boolean {
    return this.quarantinedOffsets.has(offset);
  }
}
