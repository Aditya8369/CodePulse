import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BackupKeyRotationAuditorService {
  private readonly logger = new Logger(BackupKeyRotationAuditorService.name);

  public auditSnapshotKey(snapshotId: string, keyAgeDays: number, checksumValid: boolean): { needsRotation: boolean; compliant: boolean } {
    const needsRotation = keyAgeDays > 90;
    const compliant = !needsRotation && checksumValid;

    if (needsRotation) {
      this.logger.warn(`Backup encryption key for ${snapshotId} is ${keyAgeDays} days old (> 90d limit). Rotation required.`);
    }
    return { needsRotation, compliant };
  }
}
