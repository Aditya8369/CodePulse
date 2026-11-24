import { Injectable } from '@nestjs/common';

export interface SnapshotMetadata {
  snapshotId: string;
  walStartLsn: string;
  walEndLsn: string;
  isConsistent: boolean;
  timestamp: number;
}

@Injectable()
export class PitrSnapshotAuditorService {
  public verifySnapshotConsistency(snapshot: SnapshotMetadata): { valid: boolean; ageHours: number } {
    const ageHours = (Date.now() - snapshot.timestamp) / (1000 * 3600);
    // Snapshot must have contiguous LSN markers and not be older than 24 hours
    const valid = snapshot.isConsistent && snapshot.walStartLsn.length > 0 && ageHours <= 24;
    return { valid, ageHours: Math.round(ageHours) };
  }
}
