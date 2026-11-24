import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AcmeSslRenewalWatchtowerService {
  private readonly logger = new Logger(AcmeSslRenewalWatchtowerService.name);

  public checkCertificateExpiration(domain: string, validUntilEpoch: number): { needsRenewal: boolean; daysRemaining: number } {
    const daysRemaining = Math.floor((validUntilEpoch - Date.now()) / (1000 * 60 * 60 * 24));
    const needsRenewal = daysRemaining <= 30;

    if (needsRenewal) {
      this.logger.warn(`Certificate for ${domain} expires in ${daysRemaining} days. Triggering ACME renewal challenge.`);
    }
    return { needsRenewal, daysRemaining };
  }
}
