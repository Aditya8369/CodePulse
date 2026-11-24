import { Injectable } from '@nestjs/common';

@Injectable()
export class HypertableChunkTunerService {
  public calculateOptimalChunkIntervalHours(dailyIngestionRows: number): number {
    // Target ~25% of server RAM (or ~1 million rows per chunk)
    if (dailyIngestionRows > 10000000) return 2;   // 2 hour chunks for ultra high scale
    if (dailyIngestionRows > 2000000) return 6;    // 6 hour chunks
    if (dailyIngestionRows > 500000) return 12;    // 12 hour chunks
    return 24;                                     // Daily chunks for moderate scale
  }
}
