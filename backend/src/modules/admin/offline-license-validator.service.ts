import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface EnterpriseLicense {
  tenantId: string;
  tier: 'ENTERPRISE' | 'PRO';
  maxSeats: number;
  validUntil: number;
  signature: string;
}

@Injectable()
export class OfflineLicenseValidatorService {
  private readonly logger = new Logger(OfflineLicenseValidatorService.name);

  public signLicense(tenantId: string, tier: string, maxSeats: number, validUntil: number, secretKey: string): string {
    const payload = `${tenantId}:${tier}:${maxSeats}:${validUntil}`;
    return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
  }

  public validateLicense(license: EnterpriseLicense, secretKey: string, now: number = Date.now()): boolean {
    if (license.validUntil <= now) {
      this.logger.warn(`License for ${license.tenantId} has expired.`);
      return false;
    }

    const expected = this.signLicense(license.tenantId, license.tier, license.maxSeats, license.validUntil, secretKey);
    return license.signature === expected;
  }
}
